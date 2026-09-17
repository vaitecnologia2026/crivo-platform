import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AI_DECISION_TO_STATUS,
  AI_RISK_LEVELS,
  AI_USE_CASE_STATUSES,
  type AddAiUseCaseLinkRequest,
  type AiGovernanceSummary,
  type AiIncidentData,
  type AiLinkKind,
  type AiPolicyData,
  type AiReviewDue,
  type AiReviewEntry,
  type AiRiskLevel,
  type AiUseCaseData,
  type AiUseCaseDecisionData,
  type AiUseCaseDetail,
  type AiUseCaseLinkData,
  type AiUseCaseStatus,
  type CreateAiIncidentRequest,
  type DecideAiUseCaseRequest,
  type UpdateAiIncidentRequest,
  type UpdateAiPolicyRequest,
  type UpsertAiPolicyRequest,
  type UpsertAiUseCaseRequest,
} from '@crivo/types';
import type { PrismaClient } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin/audit.service';

/** Quem cadastra/decide no portal (req.user). */
export interface AiGovernanceActor {
  id: string;
  name: string;
  email: string;
}

export interface UseCaseFilters {
  area?: string;
  risk?: string;
  status?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_WINDOW_DAYS = 30;

/** Mensagem de 404 por tipo de vínculo quando o alvo não existe (mais) no tenant. */
const NOT_FOUND_BY_KIND: Record<AiLinkKind, string> = {
  EVIDENCE: 'Evidência não encontrada.',
  ACTION_ITEM: 'Ação do Plano de Evolução não encontrada.',
  WORKFORCE: 'Tarefa do Workforce não encontrada.',
};

/** Linha crua do caso + agregados que a listagem já traz (evita N+1). */
type UseCaseRow = {
  id: string; code: string; name: string; purpose: string; area: string; ownerName: string;
  ownerUserId: string | null; technology: string; vendor: string | null; dataUsed: string;
  audience: string; inherentRisk: string; residualRisk: string; controls: string[]; status: string;
  justification: string | null; nextReviewAt: Date | null; createdBy: string; createdAt: Date; updatedAt: Date;
  decisions?: DecisionRow[];
  _count?: { incidents: number; links: number };
};
type DecisionRow = {
  id: string; useCaseId: string; decision: string; justification: string;
  decidedByUserId: string; decidedByName: string; decidedAt: Date;
  useCase?: { code: string; name: string } | null;
};
type LinkRow = { id: string; useCaseId: string; kind: string; targetId: string };
type IncidentRow = {
  id: string; useCaseId: string | null; severity: string; occurredAt: Date; description: string;
  status: string; createdAt: Date; updatedAt: Date; useCase?: { code: string; name: string } | null;
};
type PolicyRow = {
  id: string; title: string; version: string; status: string; publishedAt: Date | null; url: string | null;
  createdAt: Date; updatedAt: Date;
};

/**
 * Governança de IA (módulo 'govia') — serviço do CLIENTE para governar as
 * PRÓPRIAS IAs. Todo método recebe o tenantId EXPLÍCITO: o portal passa o da
 * sessão; o Super Admin (Módulos › Governança de IA) passa o organizationId
 * resolvido de Tenant.id e chama SÓ as leituras. Data plane via forTenant.
 *
 * Regras que vivem aqui (e não na tela):
 *  - código IA-NN sequencial por empresa, gerado dentro da transação;
 *  - o status APROVADO/CONDICIONADO/RESTRITO/REJEITADO só nasce de uma decisão
 *    humana (decide) com justificativa obrigatória — cada decisão grava uma
 *    linha própria (AiUseCaseDecision) + AuditLog ('ai_governance.decision');
 *  - a classificação de risco é julgamento do cliente, não score CRIVO —
 *    nenhum motor de pontuação é consultado ("avaliação não certificadora");
 *  - a agenda de revisões é DERIVADA de nextReviewAt (não há tabela).
 */
@Injectable()
export class AiGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Visão geral ──────────────────────────────────────────────────────

  async summary(tenantId: string): Promise<AiGovernanceSummary> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const now = new Date();
      const since12m = new Date(now.getTime());
      since12m.setMonth(since12m.getMonth() - 12);
      const in30d = new Date(now.getTime() + REVIEW_WINDOW_DAYS * DAY_MS);

      const [cases, incidents12m, openIncidents, decisions, policies, policiesApproved] = await Promise.all([
        tx.aiUseCase.findMany({
          select: { status: true, inherentRisk: true, residualRisk: true, nextReviewAt: true, area: true },
        }),
        // Filtro REAL por data (occurredAt), não "tudo que existe".
        tx.aiIncident.count({ where: { occurredAt: { gte: since12m } } }),
        tx.aiIncident.count({ where: { status: 'ABERTO' } }),
        tx.aiUseCaseDecision.count(),
        tx.aiPolicy.count(),
        tx.aiPolicy.count({ where: { status: 'APROVADO' } }),
      ]);

      const byStatus = Object.fromEntries(AI_USE_CASE_STATUSES.map((s) => [s, 0])) as Record<AiUseCaseStatus, number>;
      const byInherentRisk = Object.fromEntries(AI_RISK_LEVELS.map((r) => [r, 0])) as Record<AiRiskLevel, number>;
      const byResidualRisk = Object.fromEntries(AI_RISK_LEVELS.map((r) => [r, 0])) as Record<AiRiskLevel, number>;
      let reviewsOverdue = 0;
      let reviewsNext30d = 0;
      const areas = new Set<string>();
      for (const c of cases) {
        byStatus[c.status as AiUseCaseStatus] = (byStatus[c.status as AiUseCaseStatus] ?? 0) + 1;
        byInherentRisk[c.inherentRisk as AiRiskLevel] = (byInherentRisk[c.inherentRisk as AiRiskLevel] ?? 0) + 1;
        byResidualRisk[c.residualRisk as AiRiskLevel] = (byResidualRisk[c.residualRisk as AiRiskLevel] ?? 0) + 1;
        areas.add(c.area);
        // Caso rejeitado não tem revisão pendente — saiu do ciclo.
        if (c.nextReviewAt && c.status !== 'REJEITADO') {
          if (c.nextReviewAt < now) reviewsOverdue += 1;
          else if (c.nextReviewAt <= in30d) reviewsNext30d += 1;
        }
      }

      return {
        useCases: cases.length,
        byStatus,
        byInherentRisk,
        byResidualRisk,
        approved: byStatus.APROVADO,
        highInherentRisk: byInherentRisk.ALTO,
        incidents12m,
        openIncidents,
        reviewsOverdue,
        reviewsNext30d,
        decisions,
        policies: { total: policies, approved: policiesApproved },
        areas: [...areas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      };
    });
  }

  // ── Casos de uso ────────────────────────────────────────────────────

  async listUseCases(tenantId: string, filters: UseCaseFilters = {}): Promise<AiUseCaseData[]> {
    const where: Record<string, unknown> = {};
    if (filters.area) where.area = filters.area;
    if (filters.risk && (AI_RISK_LEVELS as readonly string[]).includes(filters.risk)) where.inherentRisk = filters.risk;
    if (filters.status && (AI_USE_CASE_STATUSES as readonly string[]).includes(filters.status)) where.status = filters.status;

    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.aiUseCase.findMany({
        where,
        orderBy: { code: 'asc' },
        include: {
          decisions: { orderBy: { decidedAt: 'desc' }, take: 1 },
          _count: { select: { incidents: true, links: true } },
        },
      });
      return rows.map((r) => this.toUseCase(r));
    });
  }

  async getUseCase(tenantId: string, id: string): Promise<AiUseCaseDetail> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.aiUseCase.findUnique({
        where: { id },
        include: {
          decisions: { orderBy: { decidedAt: 'desc' } },
          links: { orderBy: { createdAt: 'asc' } },
          incidents: { orderBy: { occurredAt: 'desc' } },
          _count: { select: { incidents: true, links: true } },
        },
      });
      if (!row) throw new NotFoundException('Caso de uso não encontrado.');
      const links = await this.resolveLinks(tx, row.links);
      return {
        ...this.toUseCase(row),
        decisions: row.decisions.map((d) => this.toDecision(d)),
        links,
        incidents: row.incidents.map((i) => this.toIncident({ ...i, useCase: { code: row.code, name: row.name } })),
      };
    });
  }

  async createUseCase(tenantId: string, dto: UpsertAiUseCaseRequest, actor: AiGovernanceActor): Promise<AiUseCaseData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const code = await this.nextCode(tx);
      const row = await tx.aiUseCase.create({
        data: {
          tenantId,
          code,
          name: dto.name.trim(),
          purpose: dto.purpose.trim(),
          area: dto.area.trim(),
          ownerName: dto.ownerName.trim(),
          ownerUserId: dto.ownerUserId ?? null,
          technology: dto.technology.trim(),
          vendor: dto.vendor?.trim() || null,
          dataUsed: dto.dataUsed.trim(),
          audience: dto.audience.trim(),
          inherentRisk: dto.inherentRisk,
          residualRisk: dto.residualRisk,
          controls: cleanControls(dto.controls),
          status: dto.status ?? 'RASCUNHO',
          justification: dto.justification?.trim() || null,
          nextReviewAt: parseDate(dto.nextReviewAt),
          createdBy: actor.name || actor.email,
        },
        include: { _count: { select: { incidents: true, links: true } } },
      });
      return this.toUseCase(row);
    });
  }

  async updateUseCase(tenantId: string, id: string, dto: UpsertAiUseCaseRequest): Promise<AiUseCaseData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.aiUseCase.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Caso de uso não encontrado.');
      // Um caso já decidido só muda de status por NOVA decisão (trilha). A
      // edição preserva o status atual quando ele veio de uma decisão.
      const decidedStatus = existing.status !== 'RASCUNHO' && existing.status !== 'EM_AVALIACAO';
      const row = await tx.aiUseCase.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          purpose: dto.purpose.trim(),
          area: dto.area.trim(),
          ownerName: dto.ownerName.trim(),
          ownerUserId: dto.ownerUserId === undefined ? existing.ownerUserId : dto.ownerUserId,
          technology: dto.technology.trim(),
          vendor: dto.vendor === undefined ? existing.vendor : dto.vendor?.trim() || null,
          dataUsed: dto.dataUsed.trim(),
          audience: dto.audience.trim(),
          inherentRisk: dto.inherentRisk,
          residualRisk: dto.residualRisk,
          controls: dto.controls === undefined ? existing.controls : cleanControls(dto.controls),
          status: decidedStatus ? existing.status : dto.status ?? existing.status,
          justification: dto.justification === undefined ? existing.justification : dto.justification?.trim() || null,
          nextReviewAt: dto.nextReviewAt === undefined ? existing.nextReviewAt : parseDate(dto.nextReviewAt),
        },
        include: {
          decisions: { orderBy: { decidedAt: 'desc' }, take: 1 },
          _count: { select: { incidents: true, links: true } },
        },
      });
      return this.toUseCase(row);
    });
  }

  /**
   * Decisão humana. Justificativa obrigatória (o DTO valida o formato; aqui
   * vale a REGRA: vazio/só espaço não decide). Grava a linha de trilha, muda o
   * status conforme AI_DECISION_TO_STATUS e registra na auditoria com o ator.
   */
  async decide(tenantId: string, id: string, dto: DecideAiUseCaseRequest, actor: AiGovernanceActor): Promise<AiUseCaseDetail> {
    const justification = (dto.justification ?? '').trim();
    if (!justification) {
      throw new BadRequestException('A decisão exige uma justificativa — ela fica na trilha do caso.');
    }
    const status = AI_DECISION_TO_STATUS[dto.decision];
    if (!status) throw new BadRequestException('Decisão inválida.');

    const decided = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.aiUseCase.findUnique({ where: { id }, select: { id: true, code: true, name: true, status: true } });
      if (!existing) throw new NotFoundException('Caso de uso não encontrado.');
      const decision = await tx.aiUseCaseDecision.create({
        data: {
          tenantId,
          useCaseId: id,
          decision: dto.decision,
          justification,
          decidedByUserId: actor.id,
          decidedByName: actor.name || actor.email,
        },
      });
      await tx.aiUseCase.update({
        where: { id },
        data: {
          status,
          justification,
          ...(dto.nextReviewAt !== undefined ? { nextReviewAt: parseDate(dto.nextReviewAt) } : {}),
        },
      });
      return { existing, decision };
    });

    await this.audit.record({
      action: 'ai_governance.decision',
      actor: { id: actor.id, email: actor.email },
      target: decided.existing.code,
      tenantId,
      meta: {
        useCaseId: id,
        code: decided.existing.code,
        name: decided.existing.name,
        decision: dto.decision,
        from: decided.existing.status,
        to: status,
        decisionId: decided.decision.id,
      },
    });

    return this.getUseCase(tenantId, id);
  }

  // ── Vínculos (Evidências / Plano de Evolução / Workforce) ───────────

  async addLink(tenantId: string, useCaseId: string, dto: AddAiUseCaseLinkRequest): Promise<AiUseCaseLinkData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const useCase = await tx.aiUseCase.findUnique({ where: { id: useCaseId }, select: { id: true } });
      if (!useCase) throw new NotFoundException('Caso de uso não encontrado.');
      // O alvo precisa existir NO TENANT (a RLS já limita; o 404 é explícito).
      const label = await this.labelOf(tx, dto.kind, dto.targetId);
      if (label === null) {
        throw new NotFoundException(NOT_FOUND_BY_KIND[dto.kind]);
      }
      const existing = await tx.aiUseCaseLink.findFirst({ where: { useCaseId, kind: dto.kind, targetId: dto.targetId } });
      if (existing) return { id: existing.id, useCaseId, kind: dto.kind, targetId: dto.targetId, label };
      const row = await tx.aiUseCaseLink.create({ data: { tenantId, useCaseId, kind: dto.kind, targetId: dto.targetId } });
      return { id: row.id, useCaseId, kind: dto.kind, targetId: dto.targetId, label };
    });
  }

  async removeLink(tenantId: string, useCaseId: string, linkId: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const link = await tx.aiUseCaseLink.findFirst({ where: { id: linkId, useCaseId } });
      if (!link) throw new NotFoundException('Vínculo não encontrado.');
      await tx.aiUseCaseLink.delete({ where: { id: linkId } });
      return { ok: true } as const;
    });
  }

  // ── Incidentes ──────────────────────────────────────────────────────

  async listIncidents(tenantId: string): Promise<AiIncidentData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.aiIncident.findMany({
        orderBy: { occurredAt: 'desc' },
        include: { useCase: { select: { code: true, name: true } } },
      });
      return rows.map((r) => this.toIncident(r));
    });
  }

  async createIncident(tenantId: string, dto: CreateAiIncidentRequest): Promise<AiIncidentData> {
    const occurredAt = parseDate(dto.occurredAt);
    if (!occurredAt) throw new BadRequestException('Data do incidente inválida.');
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (dto.useCaseId) {
        const uc = await tx.aiUseCase.findUnique({ where: { id: dto.useCaseId }, select: { id: true } });
        if (!uc) throw new NotFoundException('Caso de uso não encontrado.');
      }
      const row = await tx.aiIncident.create({
        data: {
          tenantId,
          useCaseId: dto.useCaseId ?? null,
          severity: dto.severity,
          occurredAt,
          description: dto.description.trim(),
        },
        include: { useCase: { select: { code: true, name: true } } },
      });
      return this.toIncident(row);
    });
  }

  async updateIncident(tenantId: string, id: string, dto: UpdateAiIncidentRequest): Promise<AiIncidentData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.aiIncident.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Incidente não encontrado.');
      const occurredAt = dto.occurredAt === undefined ? existing.occurredAt : parseDate(dto.occurredAt);
      if (!occurredAt) throw new BadRequestException('Data do incidente inválida.');
      const row = await tx.aiIncident.update({
        where: { id },
        data: {
          severity: dto.severity ?? existing.severity,
          occurredAt,
          description: dto.description === undefined ? existing.description : dto.description.trim(),
          status: dto.status ?? existing.status,
        },
        include: { useCase: { select: { code: true, name: true } } },
      });
      return this.toIncident(row);
    });
  }

  // ── Políticas ───────────────────────────────────────────────────────

  async listPolicies(tenantId: string): Promise<AiPolicyData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.aiPolicy.findMany({ orderBy: { updatedAt: 'desc' } });
      return rows.map((r) => this.toPolicy(r));
    });
  }

  async createPolicy(tenantId: string, dto: UpsertAiPolicyRequest): Promise<AiPolicyData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const status = dto.status ?? 'RASCUNHO';
      const row = await tx.aiPolicy.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          version: dto.version.trim(),
          status,
          // Aprovada sem data explícita: publicada agora.
          publishedAt: parseDate(dto.publishedAt) ?? (status === 'APROVADO' ? new Date() : null),
          url: dto.url?.trim() || null,
        },
      });
      return this.toPolicy(row);
    });
  }

  async updatePolicy(tenantId: string, id: string, dto: UpdateAiPolicyRequest): Promise<AiPolicyData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.aiPolicy.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Política não encontrada.');
      const status = dto.status ?? existing.status;
      let publishedAt = dto.publishedAt === undefined ? existing.publishedAt : parseDate(dto.publishedAt);
      if (status === 'APROVADO' && !publishedAt) publishedAt = new Date();
      const row = await tx.aiPolicy.update({
        where: { id },
        data: {
          title: dto.title === undefined ? existing.title : dto.title.trim(),
          version: dto.version === undefined ? existing.version : dto.version.trim(),
          status,
          publishedAt,
          url: dto.url === undefined ? existing.url : dto.url?.trim() || null,
        },
      });
      return this.toPolicy(row);
    });
  }

  // ── Revisões (derivadas de nextReviewAt) ────────────────────────────

  async reviews(tenantId: string, due: AiReviewDue = 'all'): Promise<AiReviewEntry[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const now = new Date();
      const rows = await tx.aiUseCase.findMany({
        where: { nextReviewAt: { not: null }, status: { not: 'REJEITADO' } },
        orderBy: { nextReviewAt: 'asc' },
        select: { id: true, code: true, name: true, area: true, ownerName: true, status: true, nextReviewAt: true },
      });
      const entries: AiReviewEntry[] = rows.flatMap((r) => {
        if (!r.nextReviewAt) return [];
        const daysUntil = Math.ceil((r.nextReviewAt.getTime() - now.getTime()) / DAY_MS);
        return [{
          useCaseId: r.id,
          code: r.code,
          name: r.name,
          area: r.area,
          ownerName: r.ownerName,
          status: r.status as AiUseCaseStatus,
          nextReviewAt: r.nextReviewAt.toISOString(),
          daysUntil,
          overdue: daysUntil < 0,
        }];
      });
      if (due === 'overdue') return entries.filter((e) => e.overdue);
      if (due === '30d') return entries.filter((e) => !e.overdue && e.daysUntil <= REVIEW_WINDOW_DAYS);
      return entries;
    });
  }

  /** Trilha de decisões da empresa (aba Aprovações), mais recente primeiro. */
  async listDecisions(tenantId: string): Promise<AiUseCaseDecisionData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.aiUseCaseDecision.findMany({
        orderBy: { decidedAt: 'desc' },
        include: { useCase: { select: { code: true, name: true } } },
      });
      return rows.map((d) => this.toDecision(d));
    });
  }

  // ── Internos ────────────────────────────────────────────────────────

  /** Próximo "IA-NN" da empresa: maior número já usado + 1 (nunca reaproveita). */
  private async nextCode(tx: PrismaClient): Promise<string> {
    const rows = await tx.aiUseCase.findMany({ select: { code: true } });
    let max = 0;
    for (const r of rows) {
      const m = /^IA-(\d+)$/.exec(r.code);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `IA-${String(max + 1).padStart(2, '0')}`;
  }

  /** Título do alvo do vínculo; null quando não existe (mais) no tenant. */
  private async labelOf(tx: PrismaClient, kind: string, targetId: string): Promise<string | null> {
    if (kind === 'EVIDENCE') {
      const ev = await tx.evidence.findUnique({ where: { id: targetId }, select: { title: true } });
      return ev?.title ?? null;
    }
    if (kind === 'ACTION_ITEM') {
      const it = await tx.actionItem.findUnique({ where: { id: targetId }, select: { action: true, point: true } });
      return it ? it.action || it.point : null;
    }
    if (kind === 'WORKFORCE') {
      // WorkTask (módulo Workforce) — a RLS de tx já limita ao tenant.
      const t = await tx.workTask.findUnique({ where: { id: targetId }, select: { code: true, name: true } });
      return t ? `${t.code} · ${t.name}` : null;
    }
    return null;
  }

  private async resolveLinks(tx: PrismaClient, links: LinkRow[]): Promise<AiUseCaseLinkData[]> {
    return Promise.all(
      links.map(async (l) => ({
        id: l.id,
        useCaseId: l.useCaseId,
        kind: l.kind as AiUseCaseLinkData['kind'],
        targetId: l.targetId,
        label: await this.labelOf(tx, l.kind, l.targetId),
      })),
    );
  }

  private toUseCase(r: UseCaseRow): AiUseCaseData {
    const last = r.decisions?.[0] ?? null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      purpose: r.purpose,
      area: r.area,
      ownerName: r.ownerName,
      ownerUserId: r.ownerUserId,
      technology: r.technology,
      vendor: r.vendor,
      dataUsed: r.dataUsed,
      audience: r.audience,
      inherentRisk: r.inherentRisk as AiRiskLevel,
      residualRisk: r.residualRisk as AiRiskLevel,
      controls: r.controls ?? [],
      status: r.status as AiUseCaseStatus,
      justification: r.justification,
      nextReviewAt: r.nextReviewAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lastDecision: last ? this.toDecision(last) : null,
      incidentsCount: r._count?.incidents ?? 0,
      linksCount: r._count?.links ?? 0,
    };
  }

  private toDecision(d: DecisionRow): AiUseCaseDecisionData {
    return {
      id: d.id,
      useCaseId: d.useCaseId,
      useCaseCode: d.useCase?.code,
      useCaseName: d.useCase?.name,
      decision: d.decision as AiUseCaseDecisionData['decision'],
      justification: d.justification,
      decidedByUserId: d.decidedByUserId,
      decidedByName: d.decidedByName,
      decidedAt: d.decidedAt.toISOString(),
    };
  }

  private toIncident(i: IncidentRow): AiIncidentData {
    return {
      id: i.id,
      useCaseId: i.useCaseId,
      useCaseCode: i.useCase?.code ?? null,
      useCaseName: i.useCase?.name ?? null,
      severity: i.severity as AiIncidentData['severity'],
      occurredAt: i.occurredAt.toISOString(),
      description: i.description,
      status: i.status as AiIncidentData['status'],
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }

  private toPolicy(p: PolicyRow): AiPolicyData {
    return {
      id: p.id,
      title: p.title,
      version: p.version,
      status: p.status as AiPolicyData['status'],
      publishedAt: p.publishedAt?.toISOString() ?? null,
      url: p.url,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}

function cleanControls(controls?: string[] | null): string[] {
  return (controls ?? []).map((c) => c.trim()).filter(Boolean);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
