import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  computePsychosocial,
  MIN_LEADERS_FOR_DISCLOSURE,
  psychosocialLevel,
  PSYCHOSOCIAL_DIMENSIONS,
  PSYCHOSOCIAL_QUESTIONS,
  type PsychosocialDimension,
  type PsychosocialRiskLevel,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitPsychosocialDto } from './dto';

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
    return { tenantName: org.name, questions: PSYCHOSOCIAL_QUESTIONS };
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
