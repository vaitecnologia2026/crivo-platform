import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_LEAD_LOST_REASON_LABEL, type DashboardData, type PlatformLeadLostReason } from '@crivo/types';

/** Filtros globais do dashboard (Caderno Tela 01 · [6]). Período sempre; os
 *  demais são opcionais e compõem o recorte. `groupId`/`tenantId` recortam a
 *  carteira (contratos/entregas/clientes); `origem` recorta o comercial. */
export interface DashboardFilters {
  origem?: string;
  groupId?: string;
  tenantId?: string;
}

/** Dashboard de Gestão CRIVO (Caderno Tela 01) — central operacional do Super
 *  Admin. Agrega dados REAIS via prisma.admin (control plane, BYPASSRLS). Onde o
 *  schema não tem o dado (comissões, NPS, tempo de resposta…), NÃO inventa —
 *  devolve em `naoModelado`. Valores monetários em centavos. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly NAO_MODELADO = [
    'Meta de faturamento',
    'Comissões (pendentes/pagas)',
    'Cobranças e inadimplência',
    'Churn / cancelamentos',
    'NPS / satisfação',
    'CAC / LTV / ROI',
    'Dossiês e jornadas (documentos derivados)',
  ];

  private static readonly FUNNEL = [
    { key: 'captacao', label: 'Captação', stages: ['NOVO', 'PRE_DIAGNOSTICO', 'REUNIAO'] },
    { key: 'oportunidade', label: 'Oportunidade', stages: ['OPORTUNIDADE'] },
    { key: 'proposta', label: 'Proposta', stages: ['PROPOSTA', 'NEGOCIACAO'] },
    {
      key: 'ganho',
      label: 'Fechado / pós-venda',
      stages: ['FECHADO', 'CONTRATO', 'ONBOARDING', 'IMPLANTACAO', 'ENTREGA', 'SUSTENTACAO', 'RENOVACAO', 'UPSELL'],
    },
    { key: 'perdido', label: 'Perdido', stages: ['PERDIDO'] },
  ];

  async build(days: number, filters: DashboardFilters = {}): Promise<DashboardData> {
    const now = Date.now();
    const since = new Date(now - days * 86_400_000);
    const prevSince = new Date(now - 2 * days * 86_400_000);
    const in30 = new Date(now + 30 * 86_400_000);
    const in60 = new Date(now + 60 * 86_400_000);
    const in90 = new Date(now + 90 * 86_400_000);
    const nowDate = new Date(now);

    // ── Recorte por grupo/empresa (afeta carteira: contratos, entregas, clientes) ──
    // O tenantId do DATA PLANE é o organizationId (não o tenant.id).
    let orgIds: string[] | null = null;
    if (filters.tenantId) {
      const t = await this.prisma.admin.tenant.findUnique({
        where: { id: filters.tenantId },
        select: { organizationId: true },
      });
      orgIds = t ? [t.organizationId] : [];
    } else if (filters.groupId) {
      const ts = await this.prisma.admin.tenant.findMany({
        where: { groupId: filters.groupId },
        select: { organizationId: true },
      });
      orgIds = ts.map((t) => t.organizationId);
    }
    const orgWhere = orgIds ? { tenantId: { in: orgIds } } : {};
    const tenantWhere = filters.tenantId
      ? { id: filters.tenantId }
      : filters.groupId
        ? { groupId: filters.groupId }
        : {};
    const originWhere = filters.origem ? { origin: filters.origem } : {};

    const [
      products,
      leadsPeriod,
      leadsPrev,
      contractsAll,
      tenants,
      cyclesOpen,
      avaliacoes,
      planosPendentes,
      acoesGrouped,
      evidencias,
      mentorias,
      clientesAtivos,
      clientesBloqueados,
      novosClientes,
      activeTenantOrgs,
      assessmentOrgs,
      addonRows,
    ] = await Promise.all([
      this.prisma.admin.product.findMany({ select: { id: true, name: true, monthlyPriceCents: true } }),
      this.prisma.admin.platformLead.findMany({
        where: { createdAt: { gte: since }, ...originWhere },
        select: {
          stage: true,
          origin: true,
          convertedTenantId: true,
          productId: true,
          lostReason: true,
          firstContactedAt: true,
          createdAt: true,
          proposedValueCents: true,
          proposalSentAt: true,
        },
      }),
      this.prisma.admin.platformLead.count({
        where: { createdAt: { gte: prevSince, lt: since }, ...originWhere },
      }),
      this.prisma.admin.contract.findMany({
        select: {
          productId: true,
          status: true,
          endDate: true,
          optionalModules: true,
          responsible: true,
          organizationId: true,
          groupId: true,
        },
      }),
      this.prisma.admin.tenant.findMany({ select: { organizationId: true, name: true } }),
      this.prisma.admin.assessmentCycle.count({ where: { status: 'OPEN', ...orgWhere } }),
      this.prisma.admin.assessment.count({ where: orgWhere }),
      this.prisma.admin.actionPlan.count({ where: { validatedAt: null, ...orgWhere } }),
      this.prisma.admin.actionItem.groupBy({ by: ['status'], where: orgWhere, _count: { _all: true } }),
      this.prisma.admin.evidence.count({ where: orgWhere }),
      this.prisma.admin.mentoria.findMany({
        where: { status: 'AGENDADA', ...orgWhere },
        select: { scheduledAt: true, tenantId: true },
      }),
      this.prisma.admin.tenant.count({ where: { ...tenantWhere, status: 'ACTIVE' } }),
      this.prisma.admin.tenant.count({ where: { ...tenantWhere, status: 'SUSPENDED' } }),
      this.prisma.admin.tenant.count({ where: { ...tenantWhere, createdAt: { gte: since } } }),
      this.prisma.admin.tenant.findMany({
        where: { ...tenantWhere, status: 'ACTIVE' },
        select: { organizationId: true },
      }),
      this.prisma.admin.assessment.groupBy({ by: ['tenantId'], where: orgWhere, _count: { _all: true } }),
      this.prisma.admin.addon.findMany({
        where: { active: true, recurring: true },
        select: { moduleCode: true, monthlyPriceCents: true },
      }),
    ]);
    const addonPrice = new Map(addonRows.map((a) => [a.moduleCode, a.monthlyPriceCents]));

    const priceOf = new Map(products.map((p) => [p.id, p]));
    const nameOfOrg = new Map(tenants.map((t) => [t.organizationId, t.name]));

    // ── Comercial (recortado por período + origem) ──
    const totalLeads = leadsPeriod.length;
    const fechadas = leadsPeriod.filter((l) => l.convertedTenantId).length;
    const propostas = leadsPeriod.filter((l) => l.stage === 'PROPOSTA').length;
    const conversao = totalLeads ? Math.round((fechadas / totalLeads) * 100) : 0;

    const funnel = DashboardService.FUNNEL.map((g) => ({
      key: g.key,
      label: g.label,
      count: leadsPeriod.filter((l) => g.stages.includes(l.stage)).length,
    }));

    const origemMap = new Map<string, number>();
    for (const l of leadsPeriod) {
      const o = (l.origin ?? '').trim() || '(não informado)';
      origemMap.set(o, (origemMap.get(o) ?? 0) + 1);
    }
    const porOrigem = [...origemMap.entries()]
      .map(([origem, count]) => ({ origem, count }))
      .sort((a, b) => b.count - a.count);

    let faturamentoEstimadoCents = 0;
    for (const l of leadsPeriod) {
      if (l.convertedTenantId && l.productId) {
        faturamentoEstimadoCents += priceOf.get(l.productId)?.monthlyPriceCents ?? 0;
      }
    }
    const ticketMedioCents = fechadas ? Math.round(faturamentoEstimadoCents / fechadas) : 0;

    // Motivos de perda (leads PERDIDO no período, por motivo estruturado).
    const motivoMap = new Map<string, number>();
    for (const l of leadsPeriod) {
      if (l.stage !== 'PERDIDO') continue;
      const label = l.lostReason
        ? (PLATFORM_LEAD_LOST_REASON_LABEL[l.lostReason as PlatformLeadLostReason] ?? l.lostReason)
        : '(não informado)';
      motivoMap.set(label, (motivoMap.get(label) ?? 0) + 1);
    }
    const motivosPerda = [...motivoMap.entries()]
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count);

    // Tempo de resposta: lead → 1º contato (só quem tem firstContactedAt).
    const contatados = leadsPeriod.filter((l) => l.firstContactedAt);
    const somaMin = contatados.reduce(
      (s, l) => s + (l.firstContactedAt!.getTime() - l.createdAt.getTime()) / 60_000,
      0,
    );
    const tempoRespostaMedioMin = contatados.length ? Math.round(somaMin / contatados.length) : null;
    const leadsSemPrimeiroContato = leadsPeriod.filter(
      (l) => !l.firstContactedAt && !l.convertedTenantId,
    ).length;

    // Valor proposto em aberto (pipeline: não convertido, não perdido) + propostas enviadas.
    const valorPropostoCents = leadsPeriod
      .filter((l) => !l.convertedTenantId && l.stage !== 'PERDIDO')
      .reduce((s, l) => s + (l.proposedValueCents ?? 0), 0);
    const propostasEnviadas = leadsPeriod.filter((l) => l.proposalSentAt).length;

    // Clientes sem avanço: ativos (no recorte) sem nenhum diagnóstico iniciado.
    const assessedOrgs = new Set(assessmentOrgs.map((a) => a.tenantId));
    const clientesSemAvanco = activeTenantOrgs.filter((t) => !assessedOrgs.has(t.organizationId)).length;

    // ── Contratos (recortados por grupo/empresa) ──
    // No recorte por grupo, inclui também o contrato do PRÓPRIO grupo (Tela 05 [5]).
    const scopedContracts = orgIds
      ? contractsAll.filter(
          (c) =>
            (c.organizationId && orgIds!.includes(c.organizationId)) ||
            (!!filters.groupId && c.groupId === filters.groupId),
        )
      : contractsAll;
    const ativos = scopedContracts.filter((c) => c.status === 'ATIVO');
    let mrrCents = 0;
    const solMap = new Map<string, { count: number; receita: number }>();
    for (const c of ativos) {
      const p = c.productId ? priceOf.get(c.productId) : null;
      mrrCents += p?.monthlyPriceCents ?? 0;
      // Receita recorrente dos adicionais contratados (Tela 05 · modelo Adicional).
      for (const code of Array.isArray(c.optionalModules) ? (c.optionalModules as string[]) : []) {
        mrrCents += addonPrice.get(code) ?? 0;
      }
      const name = p?.name ?? '(sem solução)';
      const s = solMap.get(name) ?? { count: 0, receita: 0 };
      s.count += 1;
      s.receita += p?.monthlyPriceCents ?? 0;
      solMap.set(name, s);
    }
    const porSolucao = [...solMap.entries()]
      .map(([produto, v]) => ({ produto, count: v.count, receitaMensalCents: v.receita }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const vencendo = (lo: Date, hi: Date) =>
      ativos.filter((c) => c.endDate && c.endDate >= lo && c.endDate <= hi).length;
    const comAdicionais = ativos.filter(
      (c) => Array.isArray(c.optionalModules) && (c.optionalModules as unknown[]).length > 0,
    ).length;

    const statusMap = new Map<string, number>();
    for (const c of scopedContracts) statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1);
    const porStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

    const semResponsavel = ativos.filter((c) => !c.responsible || !c.responsible.trim());

    // ── Entregas (recortadas por grupo/empresa via orgWhere) ──
    const acoesPendentes = acoesGrouped
      .filter((a) => a.status !== 'CONCLUIDA' && a.status !== 'REAVALIADA')
      .reduce((s, a) => s + a._count._all, 0);
    const mentoriasAtrasadas = mentorias.filter((m) => m.scheduledAt < nowDate).length;

    // ── Central de Pendências (sinais reais) ──
    type Pend = DashboardData['pendencias'][number];
    const pendencias: Pend[] = [];
    for (const c of ativos) {
      if (c.endDate && c.endDate >= nowDate && c.endDate <= in30) {
        const dias = Math.round((c.endDate.getTime() - now) / 86_400_000);
        pendencias.push({
          empresa: (c.organizationId ? nameOfOrg.get(c.organizationId) : "Grupo") ?? "—",
          tipo: 'Contrato vencendo',
          prazo: c.endDate.toISOString(),
          severidade: dias <= 7 ? 'CRITICO' : 'ATENCAO',
        });
      }
    }
    for (const m of mentorias) {
      if (m.scheduledAt < nowDate) {
        pendencias.push({
          empresa: nameOfOrg.get(m.tenantId) ?? '—',
          tipo: 'Mentoria atrasada',
          prazo: m.scheduledAt.toISOString(),
          severidade: 'CRITICO',
        });
      }
    }
    for (const c of semResponsavel) {
      pendencias.push({
        empresa: (c.organizationId ? nameOfOrg.get(c.organizationId) : "Grupo") ?? "—",
        tipo: 'Contrato sem responsável',
        prazo: null,
        severidade: 'ATENCAO',
      });
    }
    const sevRank: Record<Pend['severidade'], number> = { CRITICO: 0, ATENCAO: 1, OK: 2 };
    pendencias.sort((a, b) => sevRank[a.severidade] - sevRank[b.severidade]);

    return {
      periodDays: days,
      comercial: {
        leads: totalLeads,
        leadsPrev,
        propostas,
        fechadas,
        conversao,
        faturamentoEstimadoCents,
        ticketMedioCents,
        funnel,
        porOrigem,
        porSolucao,
        motivosPerda,
        tempoRespostaMedioMin,
        leadsSemPrimeiroContato,
        valorPropostoCents,
        propostasEnviadas,
      },
      contratos: {
        ativos: ativos.length,
        mrrCents,
        arrCents: mrrCents * 12,
        vencendo30: vencendo(nowDate, in30),
        vencendo60: vencendo(nowDate, in60),
        vencendo90: vencendo(nowDate, in90),
        comAdicionais,
        porStatus,
      },
      entregas: {
        diagnosticosAndamento: cyclesOpen,
        avaliacoes,
        planosPendentes,
        acoesPendentes,
        evidencias,
        mentoriasAgendadas: mentorias.length,
        mentoriasAtrasadas,
        clientesSemResponsavel: semResponsavel.length,
        clientesSemAvanco,
      },
      executivo: {
        clientesAtivos,
        clientesBloqueados,
        novosClientes,
      },
      pendencias: pendencias.slice(0, 30),
      naoModelado: DashboardService.NAO_MODELADO,
    };
  }
}
