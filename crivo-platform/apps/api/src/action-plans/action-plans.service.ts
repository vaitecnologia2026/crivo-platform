import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MIN_LEADERS_FOR_DISCLOSURE,
  actionTermDays,
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
import { RiskSuggestionsService, riskOriginLabel } from './risk-suggestions.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskSuggestions: RiskSuggestionsService,
  ) {}

  async list(tenantId: string): Promise<ActionPlanData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const plans = await tx.actionPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: { evidences: { orderBy: { createdAt: 'desc' } }, sourceInstrument: { select: { name: true } } },
          },
          sourceInstrument: { select: { name: true } },
        },
      });
      return plans.map((p) => this.toPlan(p));
    });
  }

  /**
   * A4 — valida a PROVENIÊNCIA estruturada: o slug precisa existir e estar
   * ativo no catálogo do Motor E ser RELEVANTE para o tenant (built-in ou
   * diagnóstico que a empresa tem link de aplicação) — mesma regra do select
   * do portal (/me/diagnostic-context). Sem isso, qualquer empresa carimbaria
   * como origem um diagnóstico que nunca aplicou.
   */
  private async assertInstrumentSlug(slug: string, tenantId: string): Promise<void> {
    // rls-allow: diagnostic_instruments é catálogo GLOBAL (control-plane).
    const inst = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug } });
    if (!inst || !inst.active) {
      throw new NotFoundException('Diagnóstico de origem não encontrado no catálogo do Motor.');
    }
    if (inst.builtIn) return;
    const link = await this.prisma.forTenant(tenantId, (tx) =>
      tx.diagnosticLink.findFirst({ where: { instrumentSlug: slug }, select: { id: true } }),
    );
    if (!link) {
      throw new NotFoundException(
        'Este diagnóstico não está vinculado à sua empresa — a origem precisa ser um diagnóstico aplicado por vocês.',
      );
    }
  }

  async createPlan(tenantId: string, dto: CreateActionPlanRequest): Promise<ActionPlanData> {
    // '' vira null (senão fura o guard e estoura a FK como 500).
    const planSlug = dto.sourceInstrumentSlug?.trim() || null;
    if (planSlug) await this.assertInstrumentSlug(planSlug, tenantId);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const p = await tx.actionPlan.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          source: dto.source ?? null,
          sourceInstrumentSlug: planSlug,
        },
        include: { items: { include: { evidences: true } }, sourceInstrument: { select: { name: true } } },
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
    const itemSlug = dto.sourceInstrumentSlug?.trim() || null;
    if (itemSlug) await this.assertInstrumentSlug(itemSlug, tenantId);
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
          sourceInstrumentSlug: itemSlug,
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
        include: { evidences: true, sourceInstrument: { select: { name: true } } },
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
        include: { evidences: true, sourceInstrument: { select: { name: true } } },
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

  /**
   * ACEITE das sugestões da matriz de risco: a organização escolhe quais ações
   * entram no plano. Cria com status SUGERIDA (default do schema) — a ação passa
   * a existir e a ser editável, mas `dossierBlockers` continua barrando a emissão
   * do dossiê final até a empresa APROVAR. É a regra da Orientação NR-1: somente
   * ações aceitas, editadas ou inseridas pela organização entram no plano.
   */
  async acceptRiskSuggestions(
    tenantId: string,
    planId: string,
    keys: string[],
    actor?: string,
  ): Promise<ActionItemData[]> {
    const escolhidas = new Set(keys.filter((k) => k.trim()));
    if (!escolhidas.size) throw new BadRequestException('Selecione ao menos uma ação para adicionar.');

    const { suggestions } = await this.riskSuggestions.list(tenantId, planId);
    const aceitas = suggestions.filter((x) => escolhidas.has(x.key) && !x.alreadyInPlan);
    if (!aceitas.length) {
      throw new BadRequestException(
        'As ações selecionadas já estão no plano ou não constam mais entre as sugestões do diagnóstico.',
      );
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const plan = await tx.actionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado');
      const out: ActionItemData[] = [];
      for (const x of aceitas) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + actionTermDays(x.prazo));
        const item = await tx.actionItem.create({
          data: {
            tenantId,
            planId,
            point: x.factorLabel,
            // Título + passo a passo: sem isto as etapas da biblioteca se
            // perderiam (o item não tem campo de descrição).
            action: `${x.title} — ${x.etapas}`.slice(0, 600),
            origin: 'questionário',
            sourceInstrumentSlug: 'PSYCHOSOCIAL',
            dueDate,
            indicator: x.indicadores,
            // Retrato do cálculo que originou a ação. severity/probability (a
            // matriz 3x3, em texto) ficam VAZIOS de propósito: a classificação
            // técnica do dossiê é decisão da empresa e as duas réguas não
            // derivam uma da outra (Anexo D `important_separation`).
            riskFactorSlug: x.factorSlug,
            riskProbability: x.probability,
            riskSeverity: x.severity,
            suggestionKey: x.key,
          },
          include: { evidences: true, sourceInstrument: { select: { name: true } } },
        });
        await tx.actionItemHistory.create({
          data: {
            tenantId,
            actionItemId: item.id,
            change: `Ação sugerida pela matriz de risco e aceita (${riskOriginLabel(x)})`,
            changedBy: actor ?? null,
          },
        });
        out.push(this.toItem(item));
      }
      return out;
    });
  }

  async updateItem(
    tenantId: string,
    itemId: string,
    dto: UpdateActionItemRequest,
    actor?: string,
  ): Promise<ActionItemData> {
    // undefined preserva; ''/null limpam o vínculo; valor válido é validado.
    const updSlug =
      dto.sourceInstrumentSlug === undefined ? undefined : dto.sourceInstrumentSlug?.trim() || null;
    if (updSlug) await this.assertInstrumentSlug(updSlug, tenantId);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.actionItem.findUnique({ where: { id: itemId } });
      if (!existing) throw new NotFoundException('Ação não encontrada');
      const item = await tx.actionItem.update({
        where: { id: itemId },
        data: {
          point: dto.point ?? existing.point,
          action: dto.action ?? existing.action,
          origin: dto.origin === undefined ? existing.origin : dto.origin,
          sourceInstrumentSlug: updSlug === undefined ? existing.sourceInstrumentSlug : updSlug,
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
        include: { evidences: { orderBy: { createdAt: 'desc' } }, sourceInstrument: { select: { name: true } } },
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
      track('diagnóstico de origem', existing.sourceInstrumentSlug, updSlug);
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
        include: { items: { include: { evidences: true, sourceInstrument: { select: { name: true } } } }, sourceInstrument: { select: { name: true } } },
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
    sourceInstrumentSlug?: string | null; sourceInstrument?: { name: string } | null;
  }): ActionPlanData {
    return {
      id: p.id,
      title: p.title,
      source: p.source,
      sourceInstrumentSlug: p.sourceInstrumentSlug ?? null,
      sourceInstrumentName: p.sourceInstrument?.name ?? null,
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
    sourceInstrumentSlug?: string | null; sourceInstrument?: { name: string } | null;
    riskFactorSlug?: string | null; riskProbability?: number | null; riskSeverity?: number | null;
    createdAt: Date; evidences?: Parameters<ActionPlansService['toEvidence']>[0][];
  }): ActionItemData {
    return {
      id: i.id,
      planId: i.planId,
      point: i.point,
      origin: i.origin,
      sourceInstrumentSlug: i.sourceInstrumentSlug ?? null,
      sourceInstrumentName: i.sourceInstrument?.name ?? null,
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
      riskFactorSlug: i.riskFactorSlug ?? null,
      riskProbability: i.riskProbability ?? null,
      riskSeverity: i.riskSeverity ?? null,
      createdAt: i.createdAt.toISOString(),
      evidences: (i.evidences ?? []).map((e) => this.toEvidence(e)),
    };
  }

  private toEvidence(e: {
    id: string; itemId: string | null; kind: string; title: string; url: string | null;
    note: string | null; status?: string | null; fileName?: string | null; fileMime?: string | null;
    fileSize?: number | null; createdAt: Date;
  }): EvidenceData {
    return {
      id: e.id,
      itemId: e.itemId,
      kind: e.kind,
      title: e.title,
      url: e.url,
      note: e.note,
      status: e.status ?? 'ENVIADA',
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
