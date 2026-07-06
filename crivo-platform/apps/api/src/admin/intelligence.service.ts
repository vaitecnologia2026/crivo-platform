import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };
type Period = { from?: string; to?: string };

/**
 * INTELIGÊNCIA CRIVO (Caderno §10) — camada ANALÍTICA da CRIVO, SEPARADA do
 * Dashboard operacional e da Base CRIVO. Cruza, para UM cliente/CNPJ identificável,
 * os dados gerados em contratos, ciclos, diagnóstico, plano, evidências, ICD/
 * liderança, custos invisíveis e People Analytics — mostrando resultado, risco,
 * pendências, nível de evidência e evolução.
 *
 * Isolamento por CNPJ: cada empresa = um Organization (data-plane id = organizationId).
 * Toda leitura de dado do cliente passa por `forTenant(organizationId)` (RLS forçada),
 * então NÃO há como misturar dados de CNPJs diferentes. O acesso e os filtros
 * sensíveis são registrados em Auditoria (controle de finalidade §11).
 *
 * O que esta camada NÃO faz: não vira dashboard operacional, não expõe ranking
 * individual (ICD só agregado/§11), não edita contrato/metodologia/IA, e não
 * alimenta a Base CRIVO — a fronteira "individual identificável × agregado
 * anonimizado" é explicitada (baseCrivoBoundary) mas a agregação só ocorre na
 * Base CRIVO, com opt-in/anonimização.
 */
@Injectable()
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Empresas selecionáveis (control plane) — o filtro por CNPJ começa aqui. */
  async listCompanies() {
    const [tenants, groups] = await Promise.all([
      this.prisma.admin.tenant.findMany({
        where: { status: { not: 'DELETED' } },
        select: {
          id: true, organizationId: true, name: true, cnpj: true,
          groupId: true, status: true, headquarterType: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.admin.businessGroup.findMany({ select: { id: true, name: true } }),
    ]);
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    return tenants.map((t) => ({
      tenantId: t.id,
      organizationId: t.organizationId,
      name: t.name,
      cnpj: t.cnpj ?? null,
      status: t.status,
      headquarterType: t.headquarterType ?? null,
      groupId: t.groupId ?? null,
      groupName: t.groupId ? groupName.get(t.groupId) ?? null : null,
    }));
  }

  /** Visão analítica cruzada de UM cliente (por organizationId). */
  async overview(tenantId: string, actor: Actor, period: Period = {}) {
    // tenantId aqui = Tenant.id (control plane). Resolvemos o organizationId (data plane).
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, organizationId: true, name: true, cnpj: true, groupId: true,
        status: true, headquarterType: true, internalResponsible: true,
        consentBenchmark: true, consentCase: true, consentLogo: true,
        consentTestimonial: true, consentAnonymized: true,
      },
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    const orgId = tenant.organizationId;
    const from = period.from ? new Date(period.from) : null;
    const to = period.to ? new Date(period.to) : null;
    const dateWhere = (field: string) =>
      from || to ? { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    // ── Control plane: contrato + módulos habilitados + grupo ──
    const [contract, modules, group] = await Promise.all([
      this.prisma.admin.contract.findFirst({
        where: { OR: [{ organizationId: orgId }, ...(tenant.groupId ? [{ groupId: tenant.groupId }] : [])] },
        orderBy: { updatedAt: 'desc' },
        select: { status: true, solutionIds: true, optionalModules: true, endDate: true, groupId: true },
      }),
      this.prisma.admin.tenantModule.findMany({
        where: { tenantId: orgId, enabled: true },
        select: { moduleCode: true },
      }),
      tenant.groupId
        ? this.prisma.admin.businessGroup.findUnique({ where: { id: tenant.groupId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    // ── Data plane (RLS por organizationId): tudo isolado ao CNPJ ──
    const data = await this.prisma.forTenant(orgId, async (tx) => {
      const [psy, items, evidences, plans, quarterly, cycles, invisible, people, pocket, parecer] = await Promise.all([
        tx.psychosocialResponse.findMany({
          where: { ...dateWhere('submittedAt') },
          select: { sector: true, score: true, byDimension: true, level: true, methodologyVersionId: true },
        }),
        tx.actionItem.findMany({
          where: { ...dateWhere('createdAt') },
          select: { id: true, point: true, action: true, status: true, responsible: true, dueDate: true, riskLevel: true },
          orderBy: { createdAt: 'desc' },
        }),
        tx.evidence.findMany({
          where: { ...dateWhere('createdAt') },
          select: { id: true, itemId: true, kind: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        tx.actionPlan.findMany({ select: { id: true, validatedAt: true } }),
        tx.companyQuarterlyIcd.findMany({
          where: { ...dateWhere('computedAt') },
          select: { cycleId: true, score: true, suppressed: true, eligibleLeaders: true, distribution: true, axesAverage: true, computedAt: true },
          orderBy: { computedAt: 'asc' },
        }),
        tx.assessmentCycle.findMany({ select: { id: true, name: true } }),
        tx.invisibleCostEstimate.findFirst({ orderBy: { updatedAt: 'desc' }, select: { scenarios: true, confidence: true, items: true, updatedAt: true } }),
        tx.peopleAnalyticsData.findFirst({ orderBy: { updatedAt: 'desc' }, select: { periods: true, analysis: true, analysisAt: true } }),
        tx.pocketSession.findMany({ where: { ...dateWhere('createdAt') }, select: { status: true } }),
        tx.parecer.findFirst({ where: { status: 'PUBLICADO' }, orderBy: { publishedAt: 'desc' }, select: { title: true, publishedAt: true, priorities: true } }),
      ]);
      return { psy, items, evidences, plans, quarterly, cycles, invisible, people, pocket, parecer };
    });

    // ── Diagnóstico psicossocial (org-wide) + trilha MET1 ──
    const respondents = data.psy.length;
    const psyScore = respondents ? Math.round(data.psy.reduce((s, r) => s + r.score, 0) / respondents) : null;
    const byDim: Record<string, number> = {};
    if (respondents) {
      const keys = new Set<string>();
      data.psy.forEach((r) => Object.keys((r.byDimension as Record<string, number>) ?? {}).forEach((k) => keys.add(k)));
      for (const k of keys) {
        const vals = data.psy.map((r) => Number((r.byDimension as Record<string, number>)?.[k] ?? 0));
        byDim[k] = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
      }
    }
    const methodologyVersionIds = Array.from(new Set(data.psy.map((r) => r.methodologyVersionId).filter((v): v is string => !!v)));
    const MIN = 3;
    const psySuppressed = respondents > 0 && respondents < MIN;

    // ── Plano + nível de evidência (real: ações com ≥1 evidência) ──
    const totalAcoes = data.items.length;
    const concluidas = data.items.filter((i) => i.status === 'CONCLUIDA').length;
    const emAndamento = data.items.filter((i) => i.status === 'EM_ANDAMENTO').length;
    const itemsComEvidencia = new Set(data.evidences.map((e) => e.itemId).filter(Boolean));
    const acoesComEvidencia = data.items.filter((i) => itemsComEvidencia.has(i.id)).length;
    const planosValidados = data.plans.filter((p) => p.validatedAt).length;
    const nivelEvidenciaPct = totalAcoes ? Math.round((acoesComEvidencia / totalAcoes) * 100) : 0;
    const planoPct = totalAcoes ? Math.round((concluidas / totalAcoes) * 100) : 0;

    // ── Pendências ──
    const now = new Date();
    const acoesAtrasadas = data.items.filter((i) => i.dueDate && new Date(i.dueDate) < now && i.status !== 'CONCLUIDA').length;
    const acoesSemEvidencia = data.items.filter((i) => !itemsComEvidencia.has(i.id) && i.status !== 'SUGERIDA').length;
    const planosNaoValidados = data.plans.filter((p) => !p.validatedAt).length;

    // ── ICD agregado (§11: sem ranking individual) + evolução ──
    const cycleName = new Map(data.cycles.map((c) => [c.id, c.name]));
    const icdSeries = data.quarterly.map((q) => ({
      cycleName: cycleName.get(q.cycleId) ?? '—',
      score: q.suppressed ? null : q.score,
      suppressed: q.suppressed,
      eligibleLeaders: q.eligibleLeaders,
      distribution: q.distribution,
      computedAt: q.computedAt,
    }));
    const lastIcd = data.quarterly[data.quarterly.length - 1] ?? null;

    // ── Custos invisíveis ──
    const scen = (data.invisible?.scenarios as Record<string, number> | undefined) ?? null;

    // ── People Analytics (último período + alertas) ──
    const peoplePeriods = (data.people?.periods as { period: string; values?: Record<string, number | null> }[]) ?? [];
    const lastPeople = peoplePeriods.length
      ? [...peoplePeriods].sort((a, b) => String(a.period).localeCompare(String(b.period)))[peoplePeriods.length - 1]
      : null;
    const peopleAlerts = ((data.people?.analysis as { alerts?: unknown[] } | null)?.alerts ?? []).length;

    // ── Auditoria: acesso + filtros sensíveis (§11) ──
    await this.audit.record({
      action: 'intelligence.view',
      actor,
      target: tenant.cnpj ?? orgId,
      meta: { tenantId, organizationId: orgId, company: tenant.name, from: period.from ?? null, to: period.to ?? null },
    });

    return {
      company: {
        tenantId: tenant.id,
        organizationId: orgId,
        name: tenant.name,
        cnpj: tenant.cnpj ?? null,
        status: tenant.status,
        headquarterType: tenant.headquarterType ?? null,
        internalResponsible: tenant.internalResponsible ?? null,
        groupId: tenant.groupId ?? null,
        groupName: group?.name ?? null,
      },
      contract: contract
        ? {
            hasContract: true,
            status: contract.status,
            byGroup: !!contract.groupId,
            solutionIds: contract.solutionIds,
            optionalModules: contract.optionalModules,
            endDate: contract.endDate,
          }
        : { hasContract: false },
      modules: modules.map((m) => m.moduleCode),
      period: from || to ? { from: period.from ?? null, to: period.to ?? null } : null,
      cards: {
        protecao: respondents ? { score: psyScore, suppressed: psySuppressed, respondents } : null,
        icd: lastIcd ? { score: lastIcd.suppressed ? null : lastIcd.score, suppressed: lastIcd.suppressed, eligibleLeaders: lastIcd.eligibleLeaders, cyclesClosed: data.quarterly.length } : null,
        plano: { total: totalAcoes, concluidas, emAndamento, pct: planoPct },
        nivelEvidencia: { totalAcoes, acoesComEvidencia, pct: nivelEvidenciaPct, evidenciasRegistradas: data.evidences.length, planosValidados },
        custos: scen ? { moderado: scen.moderado ?? null, confidence: data.invisible?.confidence ?? null } : null,
        pendencias: { acoesAtrasadas, acoesSemEvidencia, planosNaoValidados },
      },
      diagnostico: respondents
        ? { psychosocial: { respondents, suppressed: psySuppressed, score: psyScore, byDimension: byDim, methodologyVersionIds, methodologyMixed: methodologyVersionIds.length > 1 } }
        : { psychosocial: null },
      planoEvidencias: {
        items: data.items.map((i) => ({
          point: i.point, action: i.action, status: i.status, responsible: i.responsible ?? null,
          dueDate: i.dueDate, riskLevel: i.riskLevel ?? null, evidenceCount: data.evidences.filter((e) => e.itemId === i.id).length,
        })),
        evidenciasRegistradas: data.evidences.length,
      },
      lideranca: {
        icdCycles: icdSeries,
        pocket: { total: data.pocket.length, completed: data.pocket.filter((p) => p.status === 'CONCLUIDA').length },
      },
      custos: data.invisible ? { scenarios: data.invisible.scenarios, confidence: data.invisible.confidence, updatedAt: data.invisible.updatedAt } : null,
      peopleAnalytics: lastPeople ? { period: lastPeople.period, values: lastPeople.values ?? {}, alerts: peopleAlerts, analysisAt: data.people?.analysisAt ?? null } : null,
      parecer: data.parecer ? { title: data.parecer.title, publishedAt: data.parecer.publishedAt } : null,
      evolucao: { icd: icdSeries.map((c) => ({ cycleName: c.cycleName, score: c.score, computedAt: c.computedAt })) },
      baseCrivoBoundary: {
        consentBenchmark: tenant.consentBenchmark, consentCase: tenant.consentCase,
        consentLogo: tenant.consentLogo, consentTestimonial: tenant.consentTestimonial,
        consentAnonymized: tenant.consentAnonymized,
      },
    };
  }
}
