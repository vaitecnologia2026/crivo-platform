import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MethodologyConfig, ScoreAggregationMode } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { getEngineConfig } from './engine-config';

// O instrumento agora é um SLUG do catálogo diagnostic_instruments (motor
// dinâmico). Os built-in preservam os valores históricos do enum.
export type Instrument = string;
const BUILTIN_INSTRUMENTS = ['PRE_DIAGNOSTIC', 'PSYCHOSOCIAL'];

type Actor = { id: string; email: string };

const CONTENT_INCLUDE = {
  dimensions: { orderBy: { order: 'asc' as const } },
  questions: { orderBy: { order: 'asc' as const } },
  bands: { orderBy: { order: 'asc' as const } },
};

type VersionWithContent = {
  scaleLabels?: string[];
  rounding?: number | null;
  minValidCompletionPercent?: number | null;
  dimensions: { slug: string; label: string; weight: number; parentSlug?: string | null; aggregation?: ScoreAggregationMode | null }[];
  questions: {
    dimensionSlug: string; text: string; weight: number; inverse: boolean; required?: boolean;
    scored?: boolean;
    showWhenQuestionId?: number | null;
    showWhenOperator?: string | null;
    showWhenValue?: number | null;
  }[];
  bands: { code: string; label: string; min: number; max: number }[];
};

const SHOW_WHEN_OPS = ['>=', '>', '<=', '<', '==', '!='] as const;
type ShowWhenOp = (typeof SHOW_WHEN_OPS)[number];

/** Mapeia uma versão (com conteúdo incluído) para o formato do motor de score. */
function toConfig(v: VersionWithContent, aggregation?: ScoreAggregationMode): MethodologyConfig {
  return {
    dimensions: v.dimensions.map((d) => ({
      slug: d.slug,
      label: d.label,
      weight: d.weight,
      parentSlug: d.parentSlug ?? null,
      ...(d.aggregation ? { aggregation: d.aggregation } : {}),
    })),
    questions: v.questions.map((q) => {
      const op = SHOW_WHEN_OPS.includes(q.showWhenOperator as ShowWhenOp)
        ? (q.showWhenOperator as ShowWhenOp)
        : null;
      const hasCond = q.showWhenQuestionId != null && op != null && q.showWhenValue != null;
      return {
        dimensionSlug: q.dimensionSlug,
        text: q.text,
        weight: q.weight,
        inverse: q.inverse,
        required: q.required ?? true,
        ...(q.scored === false ? { scored: false } : {}),
        ...(hasCond
          ? { showWhen: { questionId: q.showWhenQuestionId!, operator: op!, value: q.showWhenValue! } }
          : {}),
      };
    }),
    bands: v.bands.map((b) => ({ code: b.code, label: b.label, min: b.min, max: b.max })),
    ...(aggregation ? { aggregation } : {}),
    ...(v.scaleLabels && v.scaleLabels.length ? { scaleLabels: v.scaleLabels } : {}),
    ...(v.rounding != null ? { rounding: v.rounding } : {}),
    ...(v.minValidCompletionPercent != null
      ? { minimumValidCompletionPercent: v.minValidCompletionPercent }
      : {}),
  };
}

/**
 * Resolve a metodologia ATIVA de um instrumento, retornando o `versionId` junto
 * com a config — para que o consumidor PIN E a versão que efetivamente pontuou
 * (rastreabilidade / comparabilidade, MET1). Retorna null se não houver ativa.
 */
export async function resolveActiveMethodology(
  prisma: PrismaService,
  instrument: Instrument,
): Promise<{ versionId: string; config: MethodologyConfig } | null> {
  const v = await prisma.admin.methodologyVersion.findFirst({
    where: { instrument, status: 'ACTIVE' },
    include: { ...CONTENT_INCLUDE, instrumentRef: true },
  });
  if (!v) return null;
  return { versionId: v.id, config: toConfig(v, v.instrumentRef?.aggregation as ScoreAggregationMode | undefined) };
}

/**
 * Carrega a config de uma versão ESPECÍFICA (qualquer status), pelo id pinado.
 * Usado para re-pontuar/auditar contra a metodologia que de fato foi aplicada,
 * mesmo que a versão já tenha sido arquivada por uma republicação. Null se sumiu.
 */
export async function loadMethodologyConfigByVersion(
  prisma: PrismaService,
  versionId: string,
): Promise<MethodologyConfig | null> {
  const v = await prisma.admin.methodologyVersion.findUnique({
    where: { id: versionId },
    include: CONTENT_INCLUDE,
  });
  return v ? toConfig(v) : null;
}

/**
 * Carrega a metodologia ATIVA de um instrumento no formato `MethodologyConfig`
 * (consumido por `scoreWithMethodology`). Standalone para o motor (intake/LP/
 * psicossocial) usar sem injetar o service. Retorna null se não houver ativa.
 */
export async function loadActiveMethodologyConfig(
  prisma: PrismaService,
  instrument: Instrument,
): Promise<MethodologyConfig | null> {
  const r = await resolveActiveMethodology(prisma, instrument);
  return r?.config ?? null;
}

/**
 * Metodologia configurável (Fase 1): dimensões, perguntas, pesos e faixas dos
 * instrumentos de diagnóstico vivem em dados versionados. O Super Admin edita um
 * RASCUNHO e publica → vira a versão ATIVA (a anterior é arquivada). O motor lê
 * a versão ativa (Fase 1C). Tudo auditado.
 */
@Injectable()
export class MethodologyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Valida o instrumento contra o CATÁLOGO (motor dinâmico). Fallback defensivo
   *  aos 2 built-in se a consulta falhar (janela de migração). */
  private async resolveInstrument(slug: string) {
    try {
      const i = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug } });
      if (!i || !i.active) throw new BadRequestException('Instrumento inválido ou inativo.');
      return i;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if (BUILTIN_INSTRUMENTS.includes(slug)) return null; // catálogo indisponível: aceita built-in
      throw new BadRequestException('Instrumento inválido.');
    }
  }

  /** Versões de um instrumento (resumo, sem o conteúdo). */
  async listVersions(instrument: string) {
    await this.resolveInstrument(instrument);
    return this.prisma.admin.methodologyVersion.findMany({
      where: { instrument },
      orderBy: { version: 'desc' },
      select: {
        id: true, instrument: true, version: true, label: true, status: true,
        notes: true, createdBy: true, createdAt: true, publishedAt: true,
        _count: { select: { dimensions: true, questions: true, bands: true } },
      },
    });
  }

  /** Versão ATIVA (com conteúdo) de um instrumento — pode ser null. */
  async getActive(instrument: string) {
    await this.resolveInstrument(instrument);
    return this.prisma.admin.methodologyVersion.findFirst({
      where: { instrument, status: 'ACTIVE' },
      include: CONTENT_INCLUDE,
    });
  }

  /** Uma versão específica (com conteúdo). */
  async getVersion(id: string) {
    const v = await this.prisma.admin.methodologyVersion.findUnique({ where: { id }, include: CONTENT_INCLUDE });
    if (!v) throw new NotFoundException('Versão de metodologia não encontrada.');
    return v;
  }

  /** Cria um RASCUNHO clonando a versão ativa (próximo número de versão). */
  async createDraft(instrument: string, actor: Actor) {
    await this.resolveInstrument(instrument);
    const active = await this.getActive(instrument);
    // Escala padrão DEFINIDA na Configuração do Motor semeia a 1ª versão de um
    // diagnóstico novo (sem versão ativa da qual clonar). Só se for válida (5 âncoras).
    const cfg = await getEngineConfig(this.prisma);
    const seedScale = cfg.defaultScaleLabels.length === 5 ? cfg.defaultScaleLabels : [];
    const max = await this.prisma.admin.methodologyVersion.aggregate({
      where: { instrument },
      _max: { version: true },
    });
    const nextVersion = (max._max.version ?? 0) + 1;
    const draft = await this.prisma.admin.methodologyVersion.create({
      data: {
        instrument,
        version: nextVersion,
        label: `Rascunho v${nextVersion}`,
        status: 'DRAFT',
        createdBy: actor.email,
        scaleLabels: active?.scaleLabels ?? seedScale,
        // Motor v3.1: precisão e cobertura herdam da versão ativa ou da
        // Configuração do Motor (padrão 1 casa decimal / 70%).
        rounding: active?.rounding ?? cfg.defaultRounding,
        minValidCompletionPercent:
          active?.minValidCompletionPercent ?? cfg.defaultMinValidCompletionPercent,
        dimensions: active
          ? { create: active.dimensions.map((d) => ({ slug: d.slug, label: d.label, weight: d.weight, order: d.order, parentSlug: d.parentSlug, aggregation: d.aggregation })) }
          : undefined,
        questions: active
          ? { create: active.questions.map((qq) => ({ dimensionSlug: qq.dimensionSlug, text: qq.text, weight: qq.weight, inverse: qq.inverse, required: qq.required, scored: qq.scored, showWhenQuestionId: qq.showWhenQuestionId, showWhenOperator: qq.showWhenOperator, showWhenValue: qq.showWhenValue, order: qq.order })) }
          : undefined,
        bands: active
          ? { create: active.bands.map((b) => ({ kind: b.kind, code: b.code, label: b.label, min: b.min, max: b.max, color: b.color, order: b.order })) }
          : undefined,
      },
      include: CONTENT_INCLUDE,
    });
    await this.audit.record({ action: 'methodology.draft', actor, target: `${instrument} v${nextVersion}` });
    return draft;
  }

  /** Substitui o conteúdo de um RASCUNHO (dimensões/perguntas/faixas + rótulo/notas). */
  async updateDraft(
    id: string,
    dto: {
      label?: string;
      notes?: string;
      scaleLabels?: string[];
      dimensions?: { slug: string; label: string; weight?: number; parentSlug?: string | null; aggregation?: ScoreAggregationMode | null }[];
      questions?: { dimensionSlug: string; text: string; weight?: number; inverse?: boolean; required?: boolean }[];
      bands?: { kind: 'MATURITY' | 'RISK'; code: string; label: string; min: number; max: number; color?: string }[];
    },
    actor: Actor,
  ) {
    const v = await this.prisma.admin.methodologyVersion.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Versão não encontrada.');
    if (v.status !== 'DRAFT') throw new BadRequestException('Apenas rascunhos podem ser editados. Crie um novo rascunho.');

    await this.prisma.admin.$transaction(async (tx) => {
      if (dto.label !== undefined || dto.notes !== undefined || dto.scaleLabels !== undefined) {
        await tx.methodologyVersion.update({
          where: { id },
          data: {
            label: dto.label ?? v.label,
            notes: dto.notes ?? v.notes,
            ...(dto.scaleLabels !== undefined ? { scaleLabels: dto.scaleLabels } : {}),
          },
        });
      }
      if (dto.dimensions) {
        await tx.methodologyDimension.deleteMany({ where: { versionId: id } });
        await tx.methodologyDimension.createMany({
          data: dto.dimensions.map((d, i) => ({ versionId: id, slug: d.slug, label: d.label, weight: d.weight ?? 1, order: i, parentSlug: d.parentSlug ?? null, aggregation: d.aggregation ?? null })),
        });
      }
      if (dto.questions) {
        await tx.methodologyQuestion.deleteMany({ where: { versionId: id } });
        await tx.methodologyQuestion.createMany({
          data: dto.questions.map((qq, i) => ({ versionId: id, dimensionSlug: qq.dimensionSlug, text: qq.text, weight: qq.weight ?? 1, inverse: qq.inverse ?? false, required: qq.required ?? true, order: i })),
        });
      }
      if (dto.bands) {
        await tx.methodologyBand.deleteMany({ where: { versionId: id } });
        await tx.methodologyBand.createMany({
          data: dto.bands.map((b, i) => ({ versionId: id, kind: b.kind, code: b.code, label: b.label, min: b.min, max: b.max, color: b.color ?? null, order: i })),
        });
      }
    });
    await this.audit.record({ action: 'methodology.update', actor, target: `${v.instrument} v${v.version}` });
    return this.getVersion(id);
  }

  /** Publica um RASCUNHO → ATIVA (arquiva a ativa anterior do mesmo instrumento). */
  async publish(id: string, actor: Actor) {
    const v = await this.prisma.admin.methodologyVersion.findUnique({
      where: { id },
      include: { _count: { select: { dimensions: true, questions: true, bands: true } } },
    });
    if (!v) throw new NotFoundException('Versão não encontrada.');
    if (v.status === 'ACTIVE') return this.getVersion(id);
    if (v.status === 'ARCHIVED') throw new BadRequestException('Versão arquivada não pode ser publicada.');
    if (v._count.dimensions === 0 || v._count.questions === 0 || v._count.bands === 0) {
      throw new BadRequestException('Defina ao menos uma dimensão, uma pergunta e uma faixa antes de publicar.');
    }
    // Régua coerente com o instrumento: faixas de maturidade num instrumento de
    // risco (ou vice-versa) confundem a leitura — bloqueia na publicação.
    const inst = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug: v.instrument } });
    if (inst) {
      const wrong = await this.prisma.admin.methodologyBand.count({
        where: { versionId: id, NOT: { kind: inst.bandKind } },
      });
      if (wrong > 0) {
        throw new BadRequestException(
          `As faixas desta versão precisam ser do tipo ${inst.bandKind === 'RISK' ? 'risco' : 'maturidade'} (definido pelo instrumento).`,
        );
      }
    }
    await this.prisma.admin.$transaction([
      this.prisma.admin.methodologyVersion.updateMany({
        where: { instrument: v.instrument, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      }),
      this.prisma.admin.methodologyVersion.update({
        where: { id },
        data: { status: 'ACTIVE', publishedAt: new Date() },
      }),
    ]);
    await this.audit.record({ action: 'methodology.publish', actor, target: `${v.instrument} v${v.version}` });
    return this.getVersion(id);
  }

  /** Apaga um RASCUNHO (nunca ativa/arquivada). */
  async deleteDraft(id: string, actor: Actor) {
    const v = await this.prisma.admin.methodologyVersion.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Versão não encontrada.');
    if (v.status !== 'DRAFT') throw new BadRequestException('Só rascunhos podem ser apagados.');
    await this.prisma.admin.methodologyVersion.delete({ where: { id } });
    await this.audit.record({ action: 'methodology.delete-draft', actor, target: `${v.instrument} v${v.version}` });
    return { ok: true };
  }
}
