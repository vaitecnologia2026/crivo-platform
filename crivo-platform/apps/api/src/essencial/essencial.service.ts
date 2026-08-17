import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computePreDiagnostic,
  scoreWithMethodology,
  PRE_DIAGNOSTIC_QUESTIONS,
  PRE_DIAGNOSTIC_SCALE,
  type AppliedDiagnosticData,
  type CreateEssentialRecordRequest,
  type EssentialRecordData,
  type EssentialRecordKind,
  type SelfAssessmentData,
  type SelfAssessmentInstrument,
  type SelfAssessmentResult,
  type SubmitSelfAssessmentRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveMethodology } from '../admin/methodology.service';

/** Instrumento built-in que o Motor chama de "Diagnóstico Executivo". É ELE que
 *  a autoavaliação do portal aplica — o mesmo slug que a LP e o dossiê já leem. */
const SELF_ASSESSMENT_INSTRUMENT = 'PRE_DIAGNOSTIC';

/** Escala do instrumento quando a versão publicada não define a sua. NÃO é a
 *  `DEFAULT_SCALE_LABELS` (concordância): este diagnóstico lê MATURIDADE, e a
 *  coluna `scale_labels` nasce vazia (migração 20260715110000), então a v1
 *  semeada cairia aqui — usar a genérica trocaria a escala que o portal mostra. */
const SELF_ASSESSMENT_SCALE = PRE_DIAGNOSTIC_SCALE.map((s) => s.label);

/**
 * Diagnóstico Essencial (Briefing §5) — jornada guiada para empresas pequenas.
 * Autoavaliação (reusa o instrumento de maturidade do pré-diagnóstico) +
 * registros de escuta/observação. Os achados alimentam o Plano de Ação e o
 * dossiê AEP/AEP+PGR. Data plane: tudo sob forTenant (RLS).
 */
@Injectable()
export class EssencialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Perguntas e escala da autoavaliação, lidas da metodologia ATIVA do
   * Diagnóstico Executivo — que é exatamente o que o Super Admin cadastra no
   * Motor. Antes esta tela era a ÚNICA do sistema que não consultava o Motor:
   * a LP (`getLpInstrument`), o psicossocial (`getQuestions`) e o dossiê
   * (`mapaSource`) já liam a versão publicada, e só o portal do cliente seguia
   * com as 10 perguntas fixas do `@crivo/types`. Por isso o diagnóstico
   * cadastrado não aparecia correto para o cliente. Sem versão ativa, cai no
   * padrão embutido — o comportamento anterior, byte a byte.
   */
  async getInstrument(): Promise<SelfAssessmentInstrument> {
    const active = await resolveActiveMethodology(this.prisma, SELF_ASSESSMENT_INSTRUMENT);
    if (active) {
      const cfg = active.config;
      return {
        questions: cfg.questions.map((q, i) => ({
          id: i + 1,
          dimension: q.dimensionSlug,
          text: q.text,
        })),
        scaleLabels:
          cfg.scaleLabels && cfg.scaleLabels.length === 5
            ? cfg.scaleLabels
            : [...SELF_ASSESSMENT_SCALE],
        source: 'methodology',
      };
    }
    return {
      questions: PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({
        id: q.id,
        dimension: q.dimension,
        text: q.text,
      })),
      scaleLabels: [...SELF_ASSESSMENT_SCALE],
      source: 'default',
    };
  }

  async submitSelfAssessment(
    tenantId: string,
    dto: SubmitSelfAssessmentRequest,
  ): Promise<SelfAssessmentData> {
    // Pontua pela metodologia ATIVA do Diagnóstico Executivo — o MESMO desenho
    // do intake da LP (`intakeDiagnostic`) e do psicossocial (`submit`): se há
    // versão publicada é ela que manda, e o `versionId` fica pinado no resultado
    // (MET1) para uma republicação depois não repontuar o que já foi respondido.
    // Sem versão ativa, o cálculo embutido de antes.
    const active = await resolveActiveMethodology(this.prisma, SELF_ASSESSMENT_INSTRUMENT);
    let result: SelfAssessmentResult;
    try {
      if (active) {
        const s = scoreWithMethodology(dto.answers ?? [], active.config);
        const byDimension: Record<string, number> = {};
        const dimensionLabels: Record<string, string> = {};
        for (const d of s.byDimension) {
          byDimension[d.slug] = d.value;
          dimensionLabels[d.slug] = d.label;
        }
        result = {
          score: s.score,
          level: s.levelCode,
          levelLabel: s.levelLabel,
          byDimension,
          dimensionLabels,
          topAttention: s.topAttentions[0] ?? '',
          topAttentions: s.topAttentions,
          methodologyVersionId: active.versionId,
        };
      } else {
        const r = computePreDiagnostic(dto.answers ?? []);
        result = {
          score: r.score,
          level: r.level,
          byDimension: r.byDimension as Record<string, number>,
          topAttention: r.topAttention,
          topAttentions: r.topAttentions ?? [r.topAttention],
          methodologyVersionId: null,
        };
      }
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sa = await tx.selfAssessment.create({
        data: {
          tenantId,
          answers: dto.answers as unknown as object,
          // A coluna `score` é Int e o motor v3.1 pode pontuar com casa decimal
          // (rounding 1/2 na aba "Escalas e regras"). Arredonda AQUI para não
          // estourar a coluna; o valor cheio segue dentro de `result.score`.
          score: Math.round(result.score),
          result: result as unknown as object,
        },
      });
      return { id: sa.id, score: sa.score, result, createdAt: sa.createdAt.toISOString() };
    });
  }

  /**
   * Diagnósticos do CATÁLOGO aplicados a ESTA empresa (motor dinâmico): é o que
   * o Super Admin cadastra em Metodologia → Aplicação, gerando o link /d/<slug>.
   * Até aqui essa lista só existia no painel do Super Admin — o portal do
   * cliente não exibia nada, então o diagnóstico cadastrado para a empresa
   * simplesmente não aparecia para ela. Lido sob RLS: uma empresa só enxerga os
   * próprios links. Instrumento desativado no catálogo some da lista.
   */
  async listAppliedDiagnostics(tenantId: string): Promise<AppliedDiagnosticData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const links = await tx.diagnosticLink.findMany({
        include: {
          instrument: { select: { name: true, description: true, bandKind: true, active: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      // Contagem por instrumento — mesma regra do painel do Super Admin
      // (`listLinks`): só o VOLUME de respostas, nenhuma resposta individual.
      const counts = await tx.diagnosticResponse.groupBy({
        by: ['instrumentSlug'],
        _count: { _all: true },
      });
      const byInstrument = new Map(counts.map((c) => [c.instrumentSlug, c._count._all]));
      return links
        .filter((l) => l.instrument.active)
        .map((l) => ({
          id: l.id,
          slug: l.slug,
          instrumentSlug: l.instrumentSlug,
          name: l.instrument.name,
          description: l.instrument.description,
          bandKind: l.instrument.bandKind as 'MATURITY' | 'RISK',
          active: l.active,
          respondents: byInstrument.get(l.instrumentSlug) ?? 0,
          createdAt: l.createdAt.toISOString(),
        }));
    });
  }

  async latestSelfAssessment(tenantId: string): Promise<SelfAssessmentData | null> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sa = await tx.selfAssessment.findFirst({ orderBy: { createdAt: 'desc' } });
      if (!sa) return null;
      return {
        id: sa.id,
        score: sa.score,
        result: sa.result as unknown as SelfAssessmentData['result'],
        createdAt: sa.createdAt.toISOString(),
      };
    });
  }

  async listRecords(tenantId: string): Promise<EssentialRecordData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.essentialRecord.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((r) => this.toRecord(r));
    });
  }

  async createRecord(
    tenantId: string,
    dto: CreateEssentialRecordRequest,
  ): Promise<EssentialRecordData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const r = await tx.essentialRecord.create({
        data: {
          tenantId,
          kind: dto.kind,
          title: dto.title.trim(),
          recordDate: dto.recordDate ? new Date(dto.recordDate) : null,
          participants: dto.participants ?? null,
          notes: dto.notes ?? null,
          points: dto.points ?? null,
        },
      });
      return this.toRecord(r);
    });
  }

  private toRecord(r: {
    id: string; kind: string; title: string; recordDate: Date | null;
    participants: string | null; notes: string | null; points: string | null; createdAt: Date;
  }): EssentialRecordData {
    return {
      id: r.id,
      kind: r.kind as EssentialRecordKind,
      title: r.title,
      recordDate: r.recordDate?.toISOString() ?? null,
      participants: r.participants,
      notes: r.notes,
      points: r.points,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
