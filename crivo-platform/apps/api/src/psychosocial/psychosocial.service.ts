import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computePsychosocial,
  MIN_LEADERS_FOR_DISCLOSURE,
  psychosocialLevel,
  PSYCHOSOCIAL_DIMENSIONS,
  type PsychosocialDimension,
  type PsychosocialRiskLevel,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitPsychosocialDto } from './dto';

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
    let result;
    try {
      result = computePsychosocial(dto.answers ?? []);
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
        },
      });
      // Devolve só o resultado próprio (anônimo) — nenhum identificador é guardado.
      return { ok: true as const, result };
    });
  }

  /**
   * Agregação para RH/gestão: visão geral + por setor, com supressão §14.
   * Cada recorte (geral e cada setor) só revela agregados se tiver ≥ minRespondents.
   */
  async results(tenantId: string) {
    const minRespondents = MIN_LEADERS_FOR_DISCLOSURE;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.psychosocialResponse.findMany({
        select: { sector: true, score: true, byDimension: true },
      });

      const overall = aggregate(rows);
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
            ...(suppressed ? {} : aggregate(list)),
          };
        })
        .sort((a, b) => b.respondents - a.respondents);

      return {
        minRespondents,
        totalRespondents: rows.length,
        overall: overallSuppressed
          ? { suppressed: true as const }
          : { suppressed: false as const, ...overall },
        sectors,
      };
    });
  }
}

type Row = { score: number; byDimension: unknown };

/** Média do score geral + por dimensão + nível + dimensão de maior risco. */
function aggregate(rows: Row[]): {
  score: number;
  level: PsychosocialRiskLevel;
  byDimension: Record<PsychosocialDimension, number>;
  topRisk: PsychosocialDimension;
} {
  const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const byDimension = {} as Record<PsychosocialDimension, number>;
  for (const d of PSYCHOSOCIAL_DIMENSIONS) {
    const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d] ?? 0));
    byDimension[d] = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
  }
  const topRisk = PSYCHOSOCIAL_DIMENSIONS.reduce((min, d) =>
    byDimension[d] < byDimension[min] ? d : min,
  );
  return { score, level: psychosocialLevel(score), byDimension, topRisk };
}
