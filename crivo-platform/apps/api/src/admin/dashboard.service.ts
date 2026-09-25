import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLATFORM_LEAD_LOST_REASON_LABEL,
  PLATFORM_LEAD_STAGES,
  PLATFORM_LEAD_STAGE_LABEL,
  type DashboardData,
  type PlatformLeadLostReason,
  type PlatformLeadStage,
} from '@crivo/types';

/** Filtros globais do dashboard (Caderno Tela 01 · [6]). Período sempre; os
 *  demais são opcionais e compõem o recorte. `groupId`/`tenantId` recortam a
 *  carteira (contratos/entregas/clientes); `origem` e `status` (etapa do lead)
 *  recortam o comercial; `consultor` recorta leads (responsável comercial) e
 *  contratos (responsável CRIVO). */
export interface DashboardFilters {
  origem?: string;
  groupId?: string;
  tenantId?: string;
  consultor?: string;
  status?: string;
}

/** Máximo de registros por lista de detalhamento (drill-down). */
const DETALHE_MAX = 200;

/** Etapas pós-onboarding só entram no "Funil por etapa" quando têm lead. */
const ETAPAS_FIXAS = new Set<PlatformLeadStage>([
  'NOVO', 'PRE_DIAGNOSTICO', 'REUNIAO', 'OPORTUNIDADE', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'CONTRATO', 'ONBOARDING',
]);

/** dd/mm/aaaa. `utc` para datas sem hora (vencimento de contrato). */
function fmtData(d: Date, utc = false): string {
  return d.toLocaleDateString('pt-BR', { timeZone: utc ? 'UTC' : 'America/Sao_Paulo' });
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
    const stageFilter = (PLATFORM_LEAD_STAGES as readonly string[]).includes(filters.status ?? '')
      ? (filters.status as PlatformLeadStage)
      : undefined;
    const originWhere = {
      ...(filters.origem ? { origin: filters.origem } : {}),
      ...(filters.consultor ? { commercialOwner: filters.consultor } : {}),
      ...(stageFilter ? { stage: stageFilter } : {}),
    };
    const nowDateQ = new Date(now);

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
      acoesAtrasadasRows,
      acoesAtrasadasTotal,
      evidenciasRejeitadas,
      emRenovacao,
      donosComerciais,
    ] = await Promise.all([
      this.prisma.admin.product.findMany({ select: { id: true, name: true, monthlyPriceCents: true } }),
      this.prisma.admin.platformLead.findMany({
        where: { createdAt: { gte: since }, ...originWhere },
        orderBy: { createdAt: 'desc' },
        select: {
          name: true,
          company: true,
          commercialOwner: true,
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
          startDate: true,
          createdAt: true,
        },
      }),
      this.prisma.admin.tenant.findMany({ select: { id: true, organizationId: true, name: true, createdAt: true } }),
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
      // Ações adotadas (aprovadas/em andamento) com prazo vencido.
      this.prisma.admin.actionItem.findMany({
        where: { status: { in: ['APROVADA', 'EM_ANDAMENTO'] }, dueDate: { lt: nowDateQ }, ...orgWhere },
        orderBy: { dueDate: 'asc' },
        take: DETALHE_MAX,
        select: { action: true, responsible: true, dueDate: true, tenantId: true },
      }),
      this.prisma.admin.actionItem.count({
        where: { status: { in: ['APROVADA', 'EM_ANDAMENTO'] }, dueDate: { lt: nowDateQ }, ...orgWhere },
      }),
      this.prisma.admin.evidence.count({ where: { status: 'REJEITADA', ...orgWhere } }),
      this.prisma.admin.platformLead.count({ where: { stage: 'RENOVACAO', archivedAt: null } }),
      this.prisma.admin.platformLead.findMany({
        where: { commercialOwner: { not: null } },
        distinct: ['commercialOwner'],
        select: { commercialOwner: true },
      }),
    ]);
    const addonPrice = new Map(addonRows.map((a) => [a.moduleCode, a.monthlyPriceCents]));

    const priceOf = new Map(products.map((p) => [p.id, p]));
    const nameOfOrg = new Map(tenants.map((t) => [t.organizationId, t.name]));
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    // ── Comercial (recortado por período + origem/consultor/etapa) ──
    const totalLeads = leadsPeriod.length;
    const fechadas = leadsPeriod.filter((l) => l.convertedTenantId).length;
    const propostas = leadsPeriod.filter((l) => l.stage === 'PROPOSTA').length;
    const conversao = totalLeads ? Math.round((fechadas / totalLeads) * 100) : 0;
    const leadsAtendidos = leadsPeriod.filter((l) => l.firstContactedAt).length;

    const funnel = DashboardService.FUNNEL.map((g) => ({
      key: g.key,
      label: g.label,
      count: leadsPeriod.filter((l) => g.stages.includes(l.stage)).length,
    }));
    const funilEtapas = PLATFORM_LEAD_STAGES.filter((s) => s !== 'PERDIDO')
      .map((s) => ({ key: s, label: PLATFORM_LEAD_STAGE_LABEL[s], count: leadsPeriod.filter((l) => l.stage === s).length }))
      .filter((e) => ETAPAS_FIXAS.has(e.key) || e.count > 0);

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
    const scopedContracts = (
      orgIds
        ? contractsAll.filter(
            (c) =>
              (c.organizationId && orgIds!.includes(c.organizationId)) ||
              (!!filters.groupId && c.groupId === filters.groupId),
          )
        : contractsAll
    ).filter((c) => !filters.consultor || c.responsible === filters.consultor);
    const ativos = scopedContracts.filter((c) => c.status === 'ATIVO');
    // MRR de um contrato: solução principal + adicionais recorrentes (Tela 05 · modelo Adicional).
    const mrrDe = (c: (typeof ativos)[number]) => {
      let v = c.productId ? (priceOf.get(c.productId)?.monthlyPriceCents ?? 0) : 0;
      for (const code of Array.isArray(c.optionalModules) ? (c.optionalModules as string[]) : []) {
        v += addonPrice.get(code) ?? 0;
      }
      return v;
    };
    let mrrCents = 0;
    let novoMrrCents = 0;
    const solMap = new Map<string, { count: number; receita: number }>();
    for (const c of ativos) {
      const p = c.productId ? priceOf.get(c.productId) : null;
      mrrCents += mrrDe(c);
      if ((c.startDate ?? c.createdAt) >= since) novoMrrCents += mrrDe(c);
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

    // ── Central de Pendências (sinais reais; cada uma aponta a tela que resolve) ──
    type Pend = DashboardData['pendencias'][number];
    const pendencias: Pend[] = [];
    const empresaDoContrato = (c: { organizationId: string | null }) =>
      (c.organizationId ? nameOfOrg.get(c.organizationId) : 'Grupo') ?? '—';
    for (const c of scopedContracts) {
      if (c.status !== 'RASCUNHO') continue;
      const empresa = empresaDoContrato(c);
      pendencias.push({
        empresa, tipo: 'Contrato em rascunho', prazo: null, severidade: 'ATENCAO',
        texto: `Contrato de ${empresa} em rascunho aguardando ativação`, area: 'Contratos', secao: 'contratos',
      });
    }
    for (const c of ativos) {
      if (c.endDate && c.endDate >= nowDate && c.endDate <= in30) {
        const dias = Math.round((c.endDate.getTime() - now) / 86_400_000);
        const empresa = empresaDoContrato(c);
        pendencias.push({
          empresa, tipo: 'Contrato vencendo', prazo: c.endDate.toISOString(),
          severidade: dias <= 7 ? 'CRITICO' : 'ATENCAO',
          texto: `Contrato de ${empresa} vence em ${fmtData(c.endDate, true)}`, area: 'Contratos', secao: 'contratos',
        });
      }
    }
    for (const m of mentorias) {
      if (m.scheduledAt < nowDate) {
        const empresa = nameOfOrg.get(m.tenantId) ?? '—';
        pendencias.push({
          empresa, tipo: 'Mentoria atrasada', prazo: m.scheduledAt.toISOString(), severidade: 'CRITICO',
          texto: `Mentoria de ${empresa} atrasada (agendada para ${fmtData(m.scheduledAt)})`,
          area: 'Mentorias', secao: 'extras',
        });
      }
    }
    for (const c of semResponsavel) {
      const empresa = empresaDoContrato(c);
      pendencias.push({
        empresa, tipo: 'Contrato sem responsável', prazo: null, severidade: 'ATENCAO',
        texto: `Contrato de ${empresa} sem responsável CRIVO`, area: 'Contratos', secao: 'contratos',
      });
    }
    if (acoesAtrasadasTotal > 0) {
      pendencias.push({
        empresa: '—', tipo: 'Ações atrasadas', prazo: null, severidade: 'CRITICO',
        texto: `${acoesAtrasadasTotal} ${acoesAtrasadasTotal === 1 ? 'ação do Plano de Ação atrasada' : 'ações do Plano de Ação atrasadas'}`,
        area: 'Motor de Evolução', secao: 'evolucao',
      });
    }
    if (evidenciasRejeitadas > 0) {
      pendencias.push({
        empresa: '—', tipo: 'Evidência rejeitada', prazo: null, severidade: 'ATENCAO',
        texto: `${evidenciasRejeitadas} ${evidenciasRejeitadas === 1 ? 'evidência rejeitada aguardando reenvio' : 'evidências rejeitadas aguardando reenvio'}`,
        area: 'Evidências', secao: 'evidencias',
      });
    }
    if (leadsSemPrimeiroContato > 0) {
      pendencias.push({
        empresa: '—', tipo: 'Lead sem 1º contato', prazo: null, severidade: 'ATENCAO',
        texto: `${leadsSemPrimeiroContato} ${leadsSemPrimeiroContato === 1 ? 'lead sem 1º contato' : 'leads sem 1º contato'} no período`,
        area: 'CRM', secao: 'crm',
      });
    }
    const sevRank: Record<Pend['severidade'], number> = { CRITICO: 0, ATENCAO: 1, OK: 2 };
    pendencias.sort((a, b) => sevRank[a.severidade] - sevRank[b.severidade]);

    // ── Detalhamento (drill-down dos KPIs clicáveis) ──
    const detalheLeads = leadsPeriod.slice(0, DETALHE_MAX).map((l) => ({
      empresa: l.company?.trim() || l.name,
      origem: l.origin?.trim() || null,
      responsavel: l.commercialOwner?.trim() || null,
      etapa: PLATFORM_LEAD_STAGE_LABEL[l.stage as PlatformLeadStage] ?? l.stage,
      criadoEm: l.createdAt.toISOString(),
      atendido: !!l.firstContactedAt,
    }));
    const contratacoes = leadsPeriod
      .filter((l) => l.convertedTenantId)
      .slice(0, DETALHE_MAX)
      .map((l) => {
        const t = tenantById.get(l.convertedTenantId!);
        const p = l.productId ? priceOf.get(l.productId) : undefined;
        return {
          empresa: t?.name ?? (l.company?.trim() || l.name),
          solucao: p?.name ?? null,
          valorMensalCents: p?.monthlyPriceCents ?? 0,
          consultor: l.commercialOwner?.trim() || null,
          data: (t?.createdAt ?? l.createdAt).toISOString(),
        };
      });
    const acoesAtrasadas = acoesAtrasadasRows.map((a) => ({
      acao: a.action,
      empresa: nameOfOrg.get(a.tenantId) ?? '—',
      responsavel: a.responsible?.trim() || null,
      prazo: a.dueDate!.toISOString(),
      diasAtraso: Math.max(1, Math.floor((now - a.dueDate!.getTime()) / 86_400_000)),
    }));

    const consultores = [
      ...new Set(
        [...donosComerciais.map((d) => d.commercialOwner), ...contractsAll.map((c) => c.responsible)]
          .map((v) => v?.trim())
          .filter((v): v is string => !!v),
      ),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

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
        leadsAtendidos,
        funilEtapas,
      },
      contratos: {
        rascunho: scopedContracts.filter((c) => c.status === 'RASCUNHO').length,
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
        acoesAtrasadas: acoesAtrasadasTotal,
      },
      financeiro: {
        receitaContratadaCents: faturamentoEstimadoCents,
        novoMrrCents,
        contratosVencer60: vencendo(nowDate, in60),
        emRenovacao,
      },
      executivo: {
        clientesAtivos,
        clientesBloqueados,
        novosClientes,
      },
      pendencias: pendencias.slice(0, 30),
      detalhe: { leads: detalheLeads, contratacoes, acoesAtrasadas },
      consultores,
      naoModelado: DashboardService.NAO_MODELADO,
    };
  }
}
