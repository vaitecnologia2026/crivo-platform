import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MIN_LEADERS_FOR_DISCLOSURE,
  TENSION_TO_TEMPLATE_CATEGORIES,
  type ActionItemData,
  type ActionPlanData,
  type ActionStatus,
  type CreateActionItemRequest,
  type CreateActionPlanRequest,
  type CreateEvidenceRequest,
  type DominantPattern,
  type EvidenceData,
  type SuggestedActionsData,
  type UpdateActionItemRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

const TENSION_LABEL: Record<DominantPattern, string> = {
  REATIVIDADE: 'Reatividade',
  RIGIDEZ: 'Rigidez',
  REPERCUSSAO: 'Repercussão',
  RISCO: 'Risco',
  EQUILIBRADO: 'Equilibrado',
};

type ActorName = string;

/**
 * Plano de Ação + Evidências do tenant (Briefing §8/§9). CORE de todo
 * diagnóstico: ponto → ação → responsável → prazo → status → evidência. O plano
 * só vira documento após validação humana (validatePlan). Data plane: todas as
 * operações sob forTenant (RLS por tenant).
 */
@Injectable()
export class ActionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ActionPlanData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const plans = await tx.actionPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: { evidences: { orderBy: { createdAt: 'desc' } } },
          },
        },
      });
      return plans.map((p) => this.toPlan(p));
    });
  }

  async createPlan(tenantId: string, dto: CreateActionPlanRequest): Promise<ActionPlanData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const p = await tx.actionPlan.create({
        data: { tenantId, title: dto.title.trim(), source: dto.source ?? null },
        include: { items: { include: { evidences: true } } },
      });
      return this.toPlan(p);
    });
  }

  async addItem(
    tenantId: string,
    planId: string,
    dto: CreateActionItemRequest,
    actor?: string,
  ): Promise<ActionItemData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const plan = await tx.actionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado');
      const item = await tx.actionItem.create({
        data: {
          tenantId,
          planId,
          point: dto.point.trim(),
          action: dto.action.trim(),
          origin: dto.origin ?? null,
          responsible: dto.responsible ?? null,
          dueDate: parseDate(dto.dueDate),
          expectedEvidence: dto.expectedEvidence ?? null,
          exposedGroup: dto.exposedGroup ?? null,
          severity: dto.severity ?? null,
          probability: dto.probability ?? null,
          riskLevel: dto.riskLevel ?? null,
          areaProcess: dto.areaProcess ?? null,
          existingMeasure: dto.existingMeasure ?? null,
          indicator: dto.indicator ?? null,
        },
        include: { evidences: true },
      });
      // F2 — trilha por ação (TPL-004 §2): registra a criação.
      await tx.actionItemHistory.create({
        data: { tenantId, actionItemId: item.id, change: 'Ação criada', changedBy: actor ?? null },
      });
      return this.toItem(item);
    });
  }

  /** #61 — Importa um ActionTemplate (catálogo global) como ActionItem
   *  do plano. Calcula dueDate = today + defaultReviewDays. */
  async addItemFromTemplate(
    tenantId: string,
    planId: string,
    templateId: string,
    actor?: string,
  ): Promise<ActionItemData> {
    // rls-allow: actionTemplate é catálogo GLOBAL (control-plane, sem RLS).
    const template = await this.prisma.admin.actionTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Ação modelo não encontrada.');
    if (!template.active) {
      throw new NotFoundException('Esta ação modelo foi desativada pelo Super Admin.');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.defaultReviewDays);

    return this.prisma.forTenant(tenantId, async (tx) => {
      const plan = await tx.actionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado.');
      const item = await tx.actionItem.create({
        data: {
          tenantId,
          planId,
          point: template.category, // categoria vira o "ponto identificado"
          action: template.title,
          origin: `template:${template.id}`,
          responsible: template.suggestedResponsible,
          dueDate,
          expectedEvidence: template.expectedEvidence,
        },
        include: { evidences: true },
      });
      await tx.actionItemHistory.create({
        data: {
          tenantId,
          actionItemId: item.id,
          change: 'Ação criada (importada do catálogo)',
          changedBy: actor ?? null,
        },
      });
      return this.toItem(item);
    });
  }

  async updateItem(
    tenantId: string,
    itemId: string,
    dto: UpdateActionItemRequest,
    actor?: string,
  ): Promise<ActionItemData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.actionItem.findUnique({ where: { id: itemId } });
      if (!existing) throw new NotFoundException('Ação não encontrada');
      const item = await tx.actionItem.update({
        where: { id: itemId },
        data: {
          point: dto.point ?? existing.point,
          action: dto.action ?? existing.action,
          origin: dto.origin === undefined ? existing.origin : dto.origin,
          responsible: dto.responsible === undefined ? existing.responsible : dto.responsible,
          dueDate: dto.dueDate === undefined ? existing.dueDate : parseDate(dto.dueDate),
          status: (dto.status ?? existing.status) as ActionStatus,
          expectedEvidence:
            dto.expectedEvidence === undefined ? existing.expectedEvidence : dto.expectedEvidence,
          reviewDate: dto.reviewDate === undefined ? existing.reviewDate : parseDate(dto.reviewDate),
          exposedGroup: dto.exposedGroup === undefined ? existing.exposedGroup : dto.exposedGroup,
          severity: dto.severity === undefined ? existing.severity : dto.severity,
          probability: dto.probability === undefined ? existing.probability : dto.probability,
          riskLevel: dto.riskLevel === undefined ? existing.riskLevel : dto.riskLevel,
          areaProcess: dto.areaProcess === undefined ? existing.areaProcess : dto.areaProcess,
          existingMeasure:
            dto.existingMeasure === undefined ? existing.existingMeasure : dto.existingMeasure,
          indicator: dto.indicator === undefined ? existing.indicator : dto.indicator,
        },
        include: { evidences: { orderBy: { createdAt: 'desc' } } },
      });
      // F2 — trilha por ação: resumo legível dos campos que mudaram.
      const changed: string[] = [];
      const track = (label: string, before: unknown, after: unknown) => {
        if (after !== undefined && String(after ?? '') !== String(before ?? '')) changed.push(label);
      };
      // Campos gravados com `??` mantêm o valor quando o cliente manda null —
      // então null também NÃO é mudança para a trilha (dto.x ?? undefined).
      track('ponto', existing.point, dto.point ?? undefined);
      track('ação', existing.action, dto.action ?? undefined);
      track('responsável', existing.responsible, dto.responsible);
      // Prazo: comparar DATA normalizada com DATA normalizada — o cliente manda
      // 'AAAA-MM-DD' e o banco guarda ISO completo; comparar cru gerava
      // "Alterado: prazo" falso na trilha oficial.
      track(
        'prazo',
        existing.dueDate?.toISOString() ?? '',
        dto.dueDate === undefined ? undefined : (parseDate(dto.dueDate)?.toISOString() ?? ''),
      );
      track('status', existing.status, dto.status ?? undefined);
      track('evidência esperada', existing.expectedEvidence, dto.expectedEvidence);
      track('severidade', existing.severity, dto.severity);
      track('probabilidade', existing.probability, dto.probability);
      track('área/processo', existing.areaProcess, dto.areaProcess);
      track('medida existente', existing.existingMeasure, dto.existingMeasure);
      track('indicador', existing.indicator, dto.indicator);
      if (changed.length) {
        await tx.actionItemHistory.create({
          data: {
            tenantId,
            actionItemId: itemId,
            change: `Alterado: ${changed.join(', ')}`,
            changedBy: actor ?? null,
          },
        });
      }
      return this.toItem(item);
    });
  }

  /** F2 — Registro de comunicação e devolutiva (TPL-002 §10). */
  async listDevolutivas(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.devolutivaRecord.findMany({ orderBy: { date: 'desc' } });
      return rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        format: r.format,
        audience: r.audience,
        topics: r.topics,
        confirmedPoints: r.confirmedPoints,
        communicatedMeasures: r.communicatedMeasures,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  async createDevolutiva(
    tenantId: string,
    dto: {
      date: string;
      format: string;
      audience?: string;
      topics?: string;
      confirmedPoints?: string;
      communicatedMeasures?: string;
    },
    actor?: string,
  ) {
    const date = parseDate(dto.date);
    if (!date) throw new BadRequestException('Data da devolutiva inválida.');
    if (!dto.format?.trim()) throw new BadRequestException('Informe o formato da comunicação.');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const r = await tx.devolutivaRecord.create({
        data: {
          tenantId,
          date,
          format: dto.format.trim(),
          audience: dto.audience?.trim() || null,
          topics: dto.topics?.trim() || null,
          confirmedPoints: dto.confirmedPoints?.trim() || null,
          communicatedMeasures: dto.communicatedMeasures?.trim() || null,
          createdBy: actor ?? null,
        },
      });
      return {
        id: r.id,
        date: r.date.toISOString(),
        format: r.format,
        audience: r.audience,
        topics: r.topics,
        confirmedPoints: r.confirmedPoints,
        communicatedMeasures: r.communicatedMeasures,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async removeItem(tenantId: string, itemId: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.actionItem.delete({ where: { id: itemId } }).catch(() => {
        throw new NotFoundException('Ação não encontrada');
      });
      return { ok: true } as const;
    });
  }

  /** Validação humana — sem ela o plano é minuta; com ela vira documento final. */
  async validatePlan(tenantId: string, planId: string, by: ActorName): Promise<ActionPlanData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const plan = await tx.actionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado');
      await tx.actionPlan.update({
        where: { id: planId },
        data: { validatedAt: new Date(), validatedBy: by },
      });
      const full = await tx.actionPlan.findUnique({
        where: { id: planId },
        include: { items: { include: { evidences: true } } },
      });
      return this.toPlan(full!);
    });
  }

  async addEvidence(
    tenantId: string,
    itemId: string,
    dto: CreateEvidenceRequest,
  ): Promise<EvidenceData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const item = await tx.actionItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Ação não encontrada');
      const ev = await tx.evidence.create({
        data: {
          tenantId,
          itemId,
          kind: dto.kind.trim(),
          title: dto.title.trim(),
          url: dto.url ?? null,
          note: dto.note ?? null,
        },
      });
      return this.toEvidence(ev);
    });
  }

  /** Evidência com ARQUIVO (upload). Metadados em Evidence, bytes em EvidenceFile. */
  async addFileEvidence(
    tenantId: string,
    itemId: string,
    meta: { kind: string; title: string; note?: string },
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<EvidenceData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const item = await tx.actionItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Ação não encontrada');
      const ev = await tx.evidence.create({
        data: {
          tenantId,
          itemId,
          kind: meta.kind.trim(),
          title: meta.title.trim() || file.originalname,
          note: meta.note ?? null,
          fileName: file.originalname,
          fileMime: file.mimetype,
          fileSize: file.size,
        },
      });
      await tx.evidenceFile.create({
        data: { tenantId, evidenceId: ev.id, data: file.buffer },
      });
      return this.toEvidence(ev);
    });
  }

  /** Bytes do arquivo de uma evidência (download). Sob RLS — só do próprio tenant. */
  async getEvidenceFile(
    tenantId: string,
    evidenceId: string,
  ): Promise<{ fileName: string; fileMime: string; data: Buffer }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ev = await tx.evidence.findUnique({
        where: { id: evidenceId },
        include: { file: true },
      });
      if (!ev || !ev.file) throw new NotFoundException('Arquivo não encontrado');
      return {
        fileName: ev.fileName ?? 'evidencia',
        fileMime: ev.fileMime ?? 'application/octet-stream',
        data: Buffer.from(ev.file.data),
      };
    });
  }

  /** §8 — Sugestão AUTOMÁTICA de ações a partir do diagnóstico: a tensão dominante
   *  da liderança (4 Rs) prioriza ActionTemplates das categorias afins; fallback no
   *  catálogo completo. Respeita §14: sem tensão se < 5 líderes (não vaza agregado). */
  async suggestedActions(tenantId: string): Promise<SuggestedActionsData> {
    const tension = await this.prisma.forTenant(tenantId, async (tx) => {
      const scores = await tx.icdScore.findMany({
        orderBy: { computedAt: 'desc' },
        select: { leaderId: true, dominantPattern: true },
      });
      const latest = new Map<string, string>();
      for (const s of scores) if (!latest.has(s.leaderId)) latest.set(s.leaderId, s.dominantPattern);
      if (latest.size < MIN_LEADERS_FOR_DISCLOSURE) return null; // §14 — supressão
      const counts: Record<string, number> = {};
      for (const p of latest.values()) if (p !== 'EQUILIBRADO') counts[p] = (counts[p] ?? 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return (top ? top[0] : null) as DominantPattern | null;
    });

    // rls-allow: actionTemplate é catálogo GLOBAL (control-plane, sem RLS).
    const all = await this.prisma.admin.actionTemplate.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    const cats = tension ? TENSION_TO_TEMPLATE_CATEGORIES[tension] : [];
    const matched = cats.length ? all.filter((t) => cats.includes(t.category)) : [];
    const chosen = matched.length ? matched : all;

    const reason = !tension
      ? 'Catálogo completo — sem leitura agregada suficiente (mín. 5 respondentes) para priorizar por tensão.'
      : matched.length
        ? `Priorizadas para a tensão dominante da liderança: ${TENSION_LABEL[tension]}.`
        : `Tensão dominante: ${TENSION_LABEL[tension]} — catálogo completo (sem ação modelo na categoria afim).`;

    return {
      tension,
      reason,
      templates: chosen.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        description: t.description,
        suggestedResponsible: t.suggestedResponsible,
        expectedEvidence: t.expectedEvidence,
        defaultReviewDays: t.defaultReviewDays,
      })),
    };
  }

  // ── mappers ──
  private toPlan(p: {
    id: string; title: string; source: string | null; validatedAt: Date | null;
    validatedBy: string | null; createdAt: Date; items: Parameters<ActionPlansService['toItem']>[0][];
  }): ActionPlanData {
    return {
      id: p.id,
      title: p.title,
      source: p.source,
      validatedAt: p.validatedAt?.toISOString() ?? null,
      validatedBy: p.validatedBy,
      createdAt: p.createdAt.toISOString(),
      items: (p.items ?? []).map((i) => this.toItem(i)),
    };
  }

  private toItem(i: {
    id: string; planId: string; point: string; origin: string | null; action: string;
    responsible: string | null; dueDate: Date | null; status: string; expectedEvidence: string | null;
    reviewDate: Date | null; exposedGroup?: string | null;
    severity?: string | null; probability?: string | null; riskLevel?: string | null;
    areaProcess?: string | null; existingMeasure?: string | null; indicator?: string | null;
    createdAt: Date; evidences?: Parameters<ActionPlansService['toEvidence']>[0][];
  }): ActionItemData {
    return {
      id: i.id,
      planId: i.planId,
      point: i.point,
      origin: i.origin,
      action: i.action,
      responsible: i.responsible,
      dueDate: i.dueDate?.toISOString() ?? null,
      status: i.status as ActionStatus,
      expectedEvidence: i.expectedEvidence,
      exposedGroup: i.exposedGroup ?? null,
      severity: i.severity ?? null,
      probability: i.probability ?? null,
      riskLevel: i.riskLevel ?? null,
      areaProcess: i.areaProcess ?? null,
      existingMeasure: i.existingMeasure ?? null,
      indicator: i.indicator ?? null,
      reviewDate: i.reviewDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      evidences: (i.evidences ?? []).map((e) => this.toEvidence(e)),
    };
  }

  private toEvidence(e: {
    id: string; itemId: string | null; kind: string; title: string; url: string | null;
    note: string | null; fileName?: string | null; fileMime?: string | null;
    fileSize?: number | null; createdAt: Date;
  }): EvidenceData {
    return {
      id: e.id,
      itemId: e.itemId,
      kind: e.kind,
      title: e.title,
      url: e.url,
      note: e.note,
      fileName: e.fileName ?? null,
      fileMime: e.fileMime ?? null,
      fileSize: e.fileSize ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
