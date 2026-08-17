import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { classifyTechnicalRisk, RISK_LEVELS_3, type RiskLevel3 } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import {
  getEngineConfig,
  MIN_RESPONDENTS_FLOOR,
  MIN_RESPONDENTS_CEIL,
  type EngineConfigValues,
} from './engine-config';

type Actor = { id: string; email: string };

export type EngineConfigInput = {
  minRespondents?: number;
  defaultAggregation?: 'MEDIA_PONDERADA' | 'MEDIA_SIMPLES' | 'SOMA_NORMALIZADA';
  defaultBandKind?: 'MATURITY' | 'RISK';
  defaultScaleLabels?: string[];
  defaultRounding?: number;
  defaultMinValidCompletionPercent?: number;
};

/**
 * Classificação técnica do fator a partir do que a empresa informou. MESMA
 * regra do Portal (`RiskCell` em PlanoAcaoScreen) e do dossiê (doc 09 §6):
 * matriz 3x3 Probabilidade × Severidade. Null quando a empresa ainda não
 * preencheu os dois eixos — nesse caso quem vale é o `riskLevel` legado.
 */
function derivedRisk(severity: string | null, probability: string | null): string | null {
  const sev = severity as RiskLevel3 | null;
  const prob = probability as RiskLevel3 | null;
  if (!sev || !prob) return null;
  if (!RISK_LEVELS_3.includes(sev) || !RISK_LEVELS_3.includes(prob)) return null;
  return classifyTechnicalRisk(prob, sev);
}

/**
 * Motores CRIVO (Configuração do Motor — mockup do cliente 14/07). Visão de
 * SUPER ADMIN sobre os motores: Enquadramento, Diagnósticos, Evolução (ações) e
 * Evidências. Leitura cross-tenant pelo owner (BYPASSRLS); a operação do cliente
 * (envio de evidência, composição do plano) vive no Portal do Cliente.
 */
@Injectable()
export class EngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Configuração do Motor — LÊ as regras globais que definem como o motor funciona.
   * Estes valores tomam efeito de verdade: supressão de anonimato e padrões dos
   * diagnósticos novos. (Feedback do cliente 15/07: a tela DEFINE o motor.)
   */
  async getConfig(): Promise<EngineConfigValues & { floor: number; ceil: number }> {
    const cfg = await getEngineConfig(this.prisma);
    return { ...cfg, floor: MIN_RESPONDENTS_FLOOR, ceil: MIN_RESPONDENTS_CEIL };
  }

  /** GRAVA as regras do motor (com validação e auditoria). Upsert do singleton global. */
  async saveConfig(dto: EngineConfigInput, actor: Actor) {
    const data: EngineConfigInput = {};

    if (dto.minRespondents !== undefined) {
      const n = Math.trunc(dto.minRespondents);
      if (!Number.isFinite(n) || n < MIN_RESPONDENTS_FLOOR || n > MIN_RESPONDENTS_CEIL) {
        throw new BadRequestException(
          `O mínimo de respondentes deve ficar entre ${MIN_RESPONDENTS_FLOOR} e ${MIN_RESPONDENTS_CEIL} (piso de anonimato).`,
        );
      }
      data.minRespondents = n;
    }
    if (dto.defaultAggregation !== undefined) data.defaultAggregation = dto.defaultAggregation;
    if (dto.defaultBandKind !== undefined) data.defaultBandKind = dto.defaultBandKind;
    if (dto.defaultRounding !== undefined) {
      const n = Math.trunc(dto.defaultRounding);
      if (!Number.isFinite(n) || n < 0 || n > 3) {
        throw new BadRequestException('Casas decimais do resultado devem ficar entre 0 e 3.');
      }
      data.defaultRounding = n;
    }
    if (dto.defaultMinValidCompletionPercent !== undefined) {
      const n = Math.trunc(dto.defaultMinValidCompletionPercent);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        throw new BadRequestException('A cobertura mínima deve ficar entre 1% e 100%.');
      }
      data.defaultMinValidCompletionPercent = n;
    }
    if (dto.defaultScaleLabels !== undefined) {
      const labels = dto.defaultScaleLabels.map((s) => s.trim()).filter(Boolean);
      if (labels.length !== 0 && labels.length !== 5) {
        throw new BadRequestException(
          'A escala padrão precisa ter exatamente 5 rótulos — ou nenhum, para usar a escala CRIVO.',
        );
      }
      data.defaultScaleLabels = labels;
    }

    await this.prisma.admin.engineConfig.upsert({
      where: { scope: 'global' },
      update: data,
      create: { scope: 'global', ...data },
    });
    await this.audit.record({ action: 'engine.config.update', actor, target: 'global', meta: data });
    return this.getConfig();
  }

  /** Panorama do "Configuração do Motor": o que cada motor configura + números reais. */
  async overview() {
    const [
      instruments,
      activeMethodologies,
      cnaeRules,
      actionsTotal,
      evidencesTotal,
      evidencesApproved,
      diagnosticResponses,
    ] = await Promise.all([
      this.prisma.admin.diagnosticInstrument.count({ where: { active: true } }),
      this.prisma.admin.methodologyVersion.count({ where: { status: 'ACTIVE' } }),
      this.prisma.admin.cnaeDivisionRule.count(),
      this.prisma.admin.actionItem.count(),
      this.prisma.admin.evidence.count(),
      this.prisma.admin.evidence.count({ where: { status: 'APROVADA' } }),
      this.prisma.admin.diagnosticResponse.count(),
    ]);
    return {
      enquadramento: { cnaeRules },
      diagnosticos: { instruments, activeMethodologies, responses: diagnosticResponses },
      evolucao: { actions: actionsTotal },
      evidencias: { total: evidencesTotal, approved: evidencesApproved },
    };
  }

  /** Motor de Evolução: ações de todos os clientes (governança). */
  async listActions(filters: { status?: string; withoutEvidence?: boolean; q?: string }) {
    const items = await this.prisma.admin.actionItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        org: { select: { name: true } },
        plan: { select: { title: true, source: true, validatedAt: true, validatedBy: true } },
        evidences: { select: { id: true, status: true } },
        // A4 — proveniência estruturada (nome do diagnóstico do Motor).
        sourceInstrument: { select: { slug: true, name: true } },
        // F2 — trilha de alteração POR AÇÃO: a última mexida do cliente no
        // portal. É o "o que o cliente está fazendo" em forma de evento.
        history: {
          orderBy: { at: 'desc' },
          take: 1,
          select: { change: true, changedBy: true, at: true },
        },
      },
      take: 500,
    });
    const now = Date.now();
    let rows = items.map((i) => {
      const evCount = i.evidences.length;
      const overdue =
        i.dueDate != null && i.dueDate.getTime() < now && i.status !== 'CONCLUIDA';
      const last = i.history[0] ?? null;
      return {
        id: i.id,
        action: i.action,
        point: i.point,
        tenantName: i.org.name,
        origin: i.origin,
        planSource: i.plan?.source ?? null,
        sourceInstrumentSlug: i.sourceInstrument?.slug ?? null,
        sourceInstrumentName: i.sourceInstrument?.name ?? null,
        responsible: i.responsible,
        dueDate: i.dueDate ? i.dueDate.toISOString() : null,
        status: i.status,
        expectedEvidence: i.expectedEvidence,
        evidenceCount: evCount,
        riskLevel: i.riskLevel,
        overdue,
        // ── O que o CLIENTE preenche no Portal e até aqui não chegava ──
        // O plano: o título que ele deu e se já validou (minuta × documento
        // final). `validatedAt` já vinha no include e era descartado no map.
        planTitle: i.plan?.title ?? null,
        planValidatedAt: i.plan?.validatedAt ? i.plan.validatedAt.toISOString() : null,
        planValidatedBy: i.plan?.validatedBy ?? null,
        // Matriz de risco do dossiê (doc 09 §6): severidade e probabilidade são
        // as ENTRADAS que o cliente informa; a classificação técnica é DERIVADA
        // pela mesma matriz 3x3 que o Portal usa — nunca digitada. `riskLevel`
        // acima segue como valor legado/manual dos registros antigos.
        severity: i.severity,
        probability: i.probability,
        riskDerived: derivedRisk(i.severity, i.probability),
        // Inventário de fatores e campos F2 informados pela empresa.
        exposedGroup: i.exposedGroup,
        areaProcess: i.areaProcess,
        existingMeasure: i.existingMeasure,
        indicator: i.indicator,
        reviewDate: i.reviewDate ? i.reviewDate.toISOString() : null,
        updatedAt: i.updatedAt.toISOString(),
        lastChange: last
          ? { change: last.change, changedBy: last.changedBy, at: last.at.toISOString() }
          : null,
      };
    });
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.withoutEvidence) rows = rows.filter((r) => r.evidenceCount === 0);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.action.toLowerCase().includes(q) ||
          (r.responsible ?? '').toLowerCase().includes(q) ||
          r.tenantName.toLowerCase().includes(q),
      );
    }
    const stats = {
      total: rows.length,
      emAndamento: rows.filter((r) => r.status === 'EM_ANDAMENTO').length,
      emRevisao: rows.filter((r) => r.status === 'EM_REVISAO' || r.status === 'SUGERIDA').length,
      atrasadas: rows.filter((r) => r.overdue).length,
      semEvidencia: rows.filter((r) => r.evidenceCount === 0).length,
    };
    return { stats, rows };
  }

  /**
   * O que o CLIENTE registra no Portal do Cliente e que não é uma ação — e por
   * isso não aparecia em lugar nenhum do Motor de Evolução, que só listava
   * `action_items`:
   *
   *  - **Ciclos de diagnóstico** (`CyclesCard` do Portal): a aplicação formal
   *    que ele abre e encerra. O encerramento CONGELA os fatores do plano e é
   *    o que habilita o comparativo do Relatório de Evolução (TPL-003) — logo,
   *    saber quem abriu/encerrou e quando é governança do Motor de Evolução.
   *  - **Comunicação e devolutiva** (`DevolutivaCard` do Portal, TPL-002 §10):
   *    quando e como a empresa comunicou resultados e medidas aos
   *    trabalhadores. É obrigação da empresa e prova de conformidade.
   *
   * Leitura cross-tenant do owner, como o resto desta classe (SuperAdminGuard).
   */
  async listClientActivity() {
    const [cycles, devolutivas] = await Promise.all([
      // rls-allow: governança cross-tenant do super admin (owner-only).
      this.prisma.admin.diagnosticCycle.findMany({
        orderBy: { openedAt: 'desc' },
        take: 200,
        include: { org: { select: { name: true } } },
      }),
      // rls-allow: governança cross-tenant do super admin (owner-only).
      this.prisma.admin.devolutivaRecord.findMany({
        orderBy: { date: 'desc' },
        take: 200,
        include: { org: { select: { name: true } } },
      }),
    ]);
    return {
      cycles: cycles.map((c) => ({
        id: c.id,
        tenantName: c.org.name,
        label: c.label,
        status: c.status,
        openedAt: c.openedAt.toISOString(),
        openedBy: c.openedBy,
        closedAt: c.closedAt ? c.closedAt.toISOString() : null,
        closedBy: c.closedBy,
        method: c.method,
        methodologyVersion: c.methodologyVersion,
      })),
      devolutivas: devolutivas.map((d) => ({
        id: d.id,
        tenantName: d.org.name,
        date: d.date.toISOString(),
        format: d.format,
        audience: d.audience,
        topics: d.topics,
        confirmedPoints: d.confirmedPoints,
        communicatedMeasures: d.communicatedMeasures,
        createdBy: d.createdBy,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  /** Evidências: governança cross-tenant (aprovar/rejeitar/substituir). */
  async listEvidences(filters: { status?: string; kind?: string }) {
    const evs = await this.prisma.admin.evidence.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        org: { select: { name: true } },
        item: { select: { action: true } },
      },
      take: 500,
    });
    let rows = evs.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      tenantName: e.org.name,
      linkedAction: e.item?.action ?? null,
      author: e.author,
      status: e.status,
      rejectionReason: e.rejectionReason,
      createdAt: e.createdAt.toISOString(),
      reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
      hasFile: !!e.fileName,
    }));
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    const stats = {
      total: rows.length,
      aprovadas: rows.filter((r) => r.status === 'APROVADA').length,
      pendentes: rows.filter((r) => r.status === 'ENVIADA' || r.status === 'PENDENTE').length,
      rejeitadas: rows.filter((r) => r.status === 'REJEITADA').length,
    };
    return { stats, rows };
  }

  /** Aprova / rejeita (com motivo) / marca como substituída uma evidência. */
  async reviewEvidence(
    id: string,
    action: 'approve' | 'reject' | 'supersede',
    actor: Actor,
    reason?: string,
  ) {
    const ev = await this.prisma.admin.evidence.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evidência não encontrada.');
    if (action === 'reject' && !reason?.trim()) {
      throw new BadRequestException('Informe o motivo da rejeição.');
    }
    const status =
      action === 'approve' ? 'APROVADA' : action === 'reject' ? 'REJEITADA' : 'SUBSTITUIDA';
    const updated = await this.prisma.admin.evidence.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: actor.email,
        rejectionReason: action === 'reject' ? reason!.trim() : null,
      },
    });
    await this.audit.record({
      action: `evidence.${action}`,
      actor,
      target: id,
      meta: { title: ev.title },
    });
    return { id: updated.id, status: updated.status };
  }
}
