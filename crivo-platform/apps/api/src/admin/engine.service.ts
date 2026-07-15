import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
};

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
        plan: { select: { title: true, source: true, validatedAt: true } },
        evidences: { select: { id: true, status: true } },
      },
      take: 500,
    });
    const now = Date.now();
    let rows = items.map((i) => {
      const evCount = i.evidences.length;
      const overdue =
        i.dueDate != null && i.dueDate.getTime() < now && i.status !== 'CONCLUIDA';
      return {
        id: i.id,
        action: i.action,
        point: i.point,
        tenantName: i.org.name,
        origin: i.origin,
        planSource: i.plan?.source ?? null,
        responsible: i.responsible,
        dueDate: i.dueDate ? i.dueDate.toISOString() : null,
        status: i.status,
        expectedEvidence: i.expectedEvidence,
        evidenceCount: evCount,
        riskLevel: i.riskLevel,
        overdue,
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
