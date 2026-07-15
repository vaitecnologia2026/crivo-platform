import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  computePsychosocial,
  scoreWithMethodology,
  psychosocialLevel,
  PSYCHOSOCIAL_DIMENSIONS,
  PSYCHOSOCIAL_DIMENSION_LABEL,
  PSYCHOSOCIAL_QUESTIONS,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { loadActiveMethodologyConfig, resolveActiveMethodology } from '../admin/methodology.service';
import { getEngineConfig } from '../admin/engine-config';
import { SubmitPsychosocialDto } from './dto';

// Resultado psicossocial em formato "superset" — compatível com o storage/telas
// antigos (level/byDimension) + rótulos da metodologia ATIVA (Fase 1C).
type PsyResult = {
  score: number;
  level: string;
  levelLabel?: string;
  byDimension: Record<string, number>;
  dimensionLabels?: Record<string, string>;
  topRisk: string;
};

/** Slug curto e legível: base do nome + sufixo aleatório (colisão ~nula). */
function makeSlug(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'empresa';
  // 8 bytes = 64 bits de entropia (antes 3 = 24 bits): impede enumeração/brute-force do slug público.
  return `${base}-${randomBytes(8).toString('hex')}`;
}

/**
 * Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO por
 * colaborador). DISTINTO do ICD (líder/decisão): mede a PERCEPÇÃO de fatores
 * psicossociais reconhecidos por colaborador, agregada por setor.
 *
 * Confidencialidade (§11/§14): a resposta é ANÔNIMA (não guardamos userId) e a
 * agregação SUPRIME qualquer recorte com menos de MIN_LEADERS_FOR_DISCLOSURE
 * respondentes — não há como reidentificar ninguém a partir dos agregados.
 * Data plane: tudo sob forTenant (RLS por tenant).
 */
@Injectable()
export class PsychosocialService {
  constructor(private readonly prisma: PrismaService) {}

  /** Submete uma resposta anônima. Retorna o resultado individual ao respondente. */
  async submit(tenantId: string, dto: SubmitPsychosocialDto) {
    // Pontua pela metodologia ATIVA do Organizacional (Fase 1C); fallback ao padrão.
    // MET1: capturamos o versionId da metodologia que pontuou, para pinar a trilha
    // na resposta — republicar depois não re-pontua o que já foi respondido.
    const active = await resolveActiveMethodology(this.prisma, 'PSYCHOSOCIAL');
    let result: PsyResult;
    let methodologyVersionId: string | null = null;
    try {
      if (active) {
        methodologyVersionId = active.versionId;
        const s = scoreWithMethodology(dto.answers ?? [], active.config);
        const byDimension: Record<string, number> = {};
        const dimensionLabels: Record<string, string> = {};
        for (const d of s.byDimension) {
          byDimension[d.slug] = d.value;
          dimensionLabels[d.slug] = d.label;
        }
        result = { score: s.score, level: s.levelCode, levelLabel: s.levelLabel, byDimension, dimensionLabels, topRisk: s.topAttentions[0] ?? '' };
      } else {
        const r = computePsychosocial(dto.answers ?? []);
        result = { score: r.score, level: r.level, byDimension: r.byDimension as Record<string, number>, topRisk: r.topRisk };
      }
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }
    const sector = dto.sector?.trim() || null;
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.psychosocialResponse.create({
        data: {
          tenantId,
          sector,
          answers: dto.answers as unknown as object,
          score: result.score,
          level: result.level,
          byDimension: result.byDimension as unknown as object,
          methodologyVersionId,
        },
      });
      // Devolve só o resultado próprio (anônimo) — nenhum identificador é guardado.
      return { ok: true as const, result };
    });
  }

  /** Perguntas do questionário — da metodologia ATIVA (Fase 1C); fallback ao padrão. */
  async getQuestions() {
    const cfg = await loadActiveMethodologyConfig(this.prisma, 'PSYCHOSOCIAL');
    return cfg
      ? cfg.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text }))
      : PSYCHOSOCIAL_QUESTIONS;
  }

  // ── Link público anônimo (Briefing §6) ────────────────────────────────────

  /** Slug público atual da empresa (null se ainda não gerado). */
  async getLink(tenantId: string): Promise<{ slug: string | null }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: tenantId },
        select: { psychosocialSlug: true },
      });
      return { slug: org?.psychosocialSlug ?? null };
    });
  }

  /** Gera (idempotente) o slug público da empresa. Retorna o existente se já houver. */
  async ensureLink(tenantId: string): Promise<{ slug: string }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: tenantId },
        select: { name: true, psychosocialSlug: true },
      });
      if (!org) throw new NotFoundException('Empresa não encontrada.');
      if (org.psychosocialSlug) return { slug: org.psychosocialSlug };
      // Tenta algumas vezes para o caso (raríssimo) de colisão no unique.
      for (let i = 0; i < 5; i++) {
        const slug = makeSlug(org.name);
        try {
          await tx.organization.update({ where: { id: tenantId }, data: { psychosocialSlug: slug } });
          return { slug };
        } catch {
          // colisão de unique — tenta outro sufixo
        }
      }
      throw new BadRequestException('Não foi possível gerar o link. Tente novamente.');
    });
  }

  /** Resolve um slug público → nome da empresa + perguntas (sem auth, sem dados internos). */
  async getPublicBySlug(slug: string) {
    // rls-allow: endpoint público anônimo (/q/<slug>), sem tenant no contexto; resolve slug→nome (select mínimo).
    const org = await this.prisma.admin.organization.findUnique({
      where: { psychosocialSlug: slug },
      select: { name: true },
    });
    if (!org) throw new NotFoundException('Questionário não encontrado ou link inválido.');
    const cfg = await loadActiveMethodologyConfig(this.prisma, 'PSYCHOSOCIAL');
    const questions = cfg
      ? cfg.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text }))
      : PSYCHOSOCIAL_QUESTIONS;
    return { tenantName: org.name, questions };
  }

  /** Submissão pública anônima via slug. Resolve o tenant e grava sob a RLS dele. */
  async submitPublic(slug: string, dto: SubmitPsychosocialDto) {
    // rls-allow: endpoint público anônimo; resolve slug→tenantId. submit() grava sob a RLS do tenant.
    const org = await this.prisma.admin.organization.findUnique({
      where: { psychosocialSlug: slug },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Questionário não encontrado ou link inválido.');
    return this.submit(org.id, dto);
  }

  /**
   * Agregação para RH/gestão: visão geral + por setor, com supressão §14.
   * Cada recorte (geral e cada setor) só revela agregados se tiver ≥ minRespondents.
   */
  async results(tenantId: string) {
    // Limiar de supressão DEFINIDO na Configuração do Motor (não mais hardcoded).
    const minRespondents = (await getEngineConfig(this.prisma)).minRespondents;
    // Dimensões/faixas da metodologia ATIVA (Fase 1C); fallback ao padrão.
    const cfg = await loadActiveMethodologyConfig(this.prisma, 'PSYCHOSOCIAL');
    const dims = cfg
      ? cfg.dimensions.map((d) => ({ slug: d.slug, label: d.label }))
      : PSYCHOSOCIAL_DIMENSIONS.map((d) => ({ slug: d as string, label: PSYCHOSOCIAL_DIMENSION_LABEL[d] }));
    const bands = cfg?.bands ?? null;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.psychosocialResponse.findMany({
        select: { sector: true, score: true, byDimension: true, methodologyVersionId: true },
      });

      // MET1 — trilha: quantas versões de metodologia pontuaram este conjunto.
      // >1 sinaliza que o recorte mistura metodologias (comparabilidade limitada).
      const methodologyVersionIds = Array.from(
        new Set(rows.map((r) => r.methodologyVersionId).filter((v): v is string => !!v)),
      );

      const overall = aggregate(rows, dims, bands);
      const overallSuppressed = rows.length < minRespondents;

      // Agrupa por setor.
      const bySectorMap = new Map<string, typeof rows>();
      for (const r of rows) {
        const key = r.sector ?? '—';
        const arr = bySectorMap.get(key) ?? [];
        arr.push(r);
        bySectorMap.set(key, arr);
      }
      const sectors = Array.from(bySectorMap.entries())
        .map(([sector, list]) => {
          const suppressed = list.length < minRespondents;
          return {
            sector,
            respondents: list.length,
            suppressed,
            ...(suppressed ? {} : aggregate(list, dims, bands)),
          };
        })
        .sort((a, b) => b.respondents - a.respondents);

      return {
        minRespondents,
        totalRespondents: rows.length,
        // Trilha MET1: versões de metodologia presentes no recorte. `mixed`=true
        // avisa que as respostas foram pontuadas por metodologias diferentes.
        methodologyVersionIds,
        methodologyMixed: methodologyVersionIds.length > 1,
        overall: overallSuppressed
          ? { suppressed: true as const }
          : { suppressed: false as const, ...overall },
        sectors,
      };
    });
  }
}

type Row = { score: number; byDimension: unknown };
type AggDim = { slug: string; label: string };
type AggBand = { code: string; label: string; min: number; max: number };

/** Média do score geral + por dimensão + nível + dimensão de maior risco. Config-driven. */
function aggregate(
  rows: Row[],
  dims: AggDim[],
  bands: AggBand[] | null,
): {
  score: number;
  level: string;
  levelLabel?: string;
  byDimension: Record<string, number>;
  dimensionLabels: Record<string, string>;
  topRisk: string;
} {
  const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const byDimension: Record<string, number> = {};
  const dimensionLabels: Record<string, string> = {};
  for (const d of dims) {
    const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
    byDimension[d.slug] = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
    dimensionLabels[d.slug] = d.label;
  }
  const topRisk = dims.reduce((min, d) => (byDimension[d.slug] < byDimension[min] ? d.slug : min), dims[0]?.slug ?? '');
  const band = bands?.find((b) => score >= b.min && score <= b.max);
  return {
    score,
    level: band?.code ?? psychosocialLevel(score),
    levelLabel: band?.label,
    byDimension,
    dimensionLabels,
    topRisk,
  };
}
