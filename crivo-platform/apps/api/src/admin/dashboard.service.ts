import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardData } from '@crivo/types';

/** Dashboard de Gestão CRIVO (Caderno Tela 01) — central operacional do Super
 *  Admin. Agrega dados REAIS via prisma.admin (control plane, BYPASSRLS), no
 *  mesmo padrão de GroupsService/BenchmarksService. Onde o schema não tem o
 *  dado (comissões, NPS, tempo de resposta…), NÃO inventa — devolve em
 *  `naoModelado`. Valores monetários em centavos. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly NAO_MODELADO = [
    'Tempo médio de resposta (sem timestamp de primeiro contato)',
    'Valor negociado por lead / proposta',
    'Motivo de perda (sem campo estruturado)',
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
    { key: 'proposta', label: 'Proposta', stages: ['PROPOSTA'] },
    {
      key: 'ganho',
      label: 'Fechado / pós-venda',
      stages: ['FECHADO', 'CONTRATO', 'ONBOARDING', 'IMPLANTACAO', 'ENTREGA', 'SUSTENTACAO', 'RENOVACAO', 'UPSELL'],
    },
    { key: 'perdido', label: 'Perdido', stages: ['PERDIDO'] },
  ];

  async build(days: number): Promise<DashboardData> {
    const now = Date.now();
    const since = new Date(now - days * 86_400_000);
    const prevSince = new Date(now - 2 * days * 86_400_000);
    const in30 = new Date(now + 30 * 86_400_000);
    const in60 = new Date(now + 60 * 86_400_000);
    const in90 = new Date(now + 90 * 86_400_000);
    const nowDate = new Date(now);

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
    ] = await Promise.all([
      this.prisma.admin.product.findMany({ select: { id: true, name: true, monthlyPriceCents: true } }),
      this.prisma.admin.platformLead.findMany({
        where: { createdAt: { gte: since } },
        select: { stage: true, origin: true, convertedTenantId: true, productId: true },
      }),
      this.prisma.admin.platformLead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
      this.prisma.admin.contract.findMany({
        select: {
          productId: true,
          status: true,
          endDate: true,
          optionalModules: true,
          responsible: true,
          organizationId: true,
        },
      }),
      this.prisma.admin.tenant.findMany({ select: { organizationId: true, name: true } }),
      this.prisma.admin.assessmentCycle.count({ where: { status: 'OPEN' } }),
      this.prisma.admin.assessment.count(),
      this.prisma.admin.actionPlan.count({ where: { validatedAt: null } }),
      this.prisma.admin.actionItem.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.admin.evidence.count(),
      this.prisma.admin.mentoria.findMany({
        where: { status: 'AGENDADA' },
        select: { scheduledAt: true, tenantId: true },
      }),
      this.prisma.admin.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.admin.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.admin.tenant.count({ where: { createdAt: { gte: since } } }),
    ]);

    const priceOf = new Map(products.map((p) => [p.id, p]));
    const nameOfOrg = new Map(tenants.map((t) => [t.organizationId, t.name]));

    // ── Comercial ──
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

    // ── Contratos ──
    const ativos = contractsAll.filter((c) => c.status === 'ATIVO');
    let mrrCents = 0;
    const solMap = new Map<string, { count: number; receita: number }>();
    for (const c of ativos) {
      const p = c.productId ? priceOf.get(c.productId) : null;
      mrrCents += p?.monthlyPriceCents ?? 0;
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
    for (const c of contractsAll) statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1);
    const porStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

    const semResponsavel = ativos.filter((c) => !c.responsible || !c.responsible.trim());

    // ── Entregas ──
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
          empresa: nameOfOrg.get(c.organizationId) ?? '—',
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
        empresa: nameOfOrg.get(c.organizationId) ?? '—',
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
