import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MethodologyConfig } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

export type Instrument = 'PRE_DIAGNOSTIC' | 'PSYCHOSOCIAL';
const INSTRUMENTS: Instrument[] = ['PRE_DIAGNOSTIC', 'PSYCHOSOCIAL'];

type Actor = { id: string; email: string };

const CONTENT_INCLUDE = {
  dimensions: { orderBy: { order: 'asc' as const } },
  questions: { orderBy: { order: 'asc' as const } },
  bands: { orderBy: { order: 'asc' as const } },
};

/**
 * Carrega a metodologia ATIVA de um instrumento no formato `MethodologyConfig`
 * (consumido por `scoreWithMethodology`). Standalone para o motor (intake/LP/
 * psicossocial) usar sem injetar o service. Retorna null se não houver ativa.
 */
export async function loadActiveMethodologyConfig(
  prisma: PrismaService,
  instrument: Instrument,
): Promise<MethodologyConfig | null> {
  const v = await prisma.admin.methodologyVersion.findFirst({
    where: { instrument, status: 'ACTIVE' },
    include: CONTENT_INCLUDE,
  });
  if (!v) return null;
  return {
    dimensions: v.dimensions.map((d) => ({ slug: d.slug, label: d.label, weight: d.weight })),
    questions: v.questions.map((q) => ({
      dimensionSlug: q.dimensionSlug,
      text: q.text,
      weight: q.weight,
      inverse: q.inverse,
    })),
    bands: v.bands.map((b) => ({ code: b.code, label: b.label, min: b.min, max: b.max })),
  };
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

  private assertInstrument(i: string): asserts i is Instrument {
    if (!INSTRUMENTS.includes(i as Instrument)) throw new BadRequestException('Instrumento inválido.');
  }

  /** Versões de um instrumento (resumo, sem o conteúdo). */
  listVersions(instrument: string) {
    this.assertInstrument(instrument);
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
  getActive(instrument: string) {
    this.assertInstrument(instrument);
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
    this.assertInstrument(instrument);
    const active = await this.getActive(instrument);
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
        dimensions: active
          ? { create: active.dimensions.map((d) => ({ slug: d.slug, label: d.label, weight: d.weight, order: d.order })) }
          : undefined,
        questions: active
          ? { create: active.questions.map((qq) => ({ dimensionSlug: qq.dimensionSlug, text: qq.text, weight: qq.weight, inverse: qq.inverse, order: qq.order })) }
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
      dimensions?: { slug: string; label: string; weight?: number }[];
      questions?: { dimensionSlug: string; text: string; weight?: number; inverse?: boolean }[];
      bands?: { kind: 'MATURITY' | 'RISK'; code: string; label: string; min: number; max: number; color?: string }[];
    },
    actor: Actor,
  ) {
    const v = await this.prisma.admin.methodologyVersion.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Versão não encontrada.');
    if (v.status !== 'DRAFT') throw new BadRequestException('Apenas rascunhos podem ser editados. Crie um novo rascunho.');

    await this.prisma.admin.$transaction(async (tx) => {
      if (dto.label !== undefined || dto.notes !== undefined) {
        await tx.methodologyVersion.update({
          where: { id },
          data: { label: dto.label ?? v.label, notes: dto.notes ?? v.notes },
        });
      }
      if (dto.dimensions) {
        await tx.methodologyDimension.deleteMany({ where: { versionId: id } });
        await tx.methodologyDimension.createMany({
          data: dto.dimensions.map((d, i) => ({ versionId: id, slug: d.slug, label: d.label, weight: d.weight ?? 1, order: i })),
        });
      }
      if (dto.questions) {
        await tx.methodologyQuestion.deleteMany({ where: { versionId: id } });
        await tx.methodologyQuestion.createMany({
          data: dto.questions.map((qq, i) => ({ versionId: id, dimensionSlug: qq.dimensionSlug, text: qq.text, weight: qq.weight ?? 1, inverse: qq.inverse ?? false, order: i })),
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
