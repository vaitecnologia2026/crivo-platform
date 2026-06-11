import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeIcd } from './scoring';
import type { SubmitIcdDto } from './dto';
import type { DominantPattern } from '@crivo/types';

@Injectable()
export class IcdService {
  constructor(private readonly prisma: PrismaService) {}

  /** Submete uma avaliação ICD, calcula o score e persiste — tudo escopado ao tenant. */
  async submit(tenantId: string, dto: SubmitIcdDto) {
    let result;
    try {
      result = computeIcd(dto.answers);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const assessment = await tx.assessment.create({
        data: { tenantId, leaderId: dto.leaderId, cycleId: dto.cycleId ?? null, type: 'ICD' },
      });
      await tx.response.create({
        data: { tenantId, assessmentId: assessment.id, answers: dto.answers as unknown as object },
      });
      const score = await tx.icdScore.create({
        data: {
          tenantId,
          assessmentId: assessment.id,
          leaderId: dto.leaderId,
          score: result.score,
          dimensions: result.dimensions as unknown as object,
          dominantPattern: result.dominantPattern,
        },
      });
      return { assessmentId: assessment.id, ...result, scoreId: score.id, computedAt: score.computedAt };
    });
  }

  /** Lista usuários do tenant (para escolher o líder avaliado). */
  async leaders(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.user.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  /** ICD pessoal do líder logado (último score) + posição no ranking do tenant. */
  async myScore(tenantId: string, userId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const scores = await tx.icdScore.findMany({ orderBy: { computedAt: 'desc' } });
      if (scores.length === 0) return null;

      // Último score por líder (já desc por computedAt).
      const latestByLeader = new Map<string, (typeof scores)[number]>();
      for (const s of scores) if (!latestByLeader.has(s.leaderId)) latestByLeader.set(s.leaderId, s);

      const mine = latestByLeader.get(userId);
      if (!mine) return null;

      const ranking = [...latestByLeader.values()].sort((a, b) => b.score - a.score);
      const rank = ranking.findIndex((s) => s.leaderId === userId) + 1;

      return {
        score: mine.score,
        dimensions: mine.dimensions,
        dominantPattern: mine.dominantPattern,
        computedAt: mine.computedAt.toISOString(),
        rank,
        totalLideres: ranking.length,
      };
    });
  }

  /** Campanhas de diagnóstico (ciclos) com estatísticas: respondentes, adesão e ICD médio. */
  async campaigns(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const totalParticipantes = await tx.user.count({ where: { active: true } });
      const cycles = await tx.assessmentCycle.findMany({
        orderBy: { createdAt: 'desc' },
        include: { assessments: { include: { score: { select: { score: true } } } } },
      });
      return cycles.map((c) => {
        const respondentes = c.assessments.length;
        const scores = c.assessments
          .map((a) => a.score?.score)
          .filter((n): n is number => typeof n === 'number');
        const icdMedio = scores.length
          ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
          : null;
        const adesao = totalParticipantes
          ? Math.round((respondentes / totalParticipantes) * 100)
          : 0;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          respondentes,
          totalParticipantes,
          adesao,
          icdMedio,
        };
      });
    });
  }

  /**
   * Dashboard executivo do ICD — leitura AGREGADA da liderança (confidencialidade,
   * Portal §3/§4). NÃO expõe ranking nem dados individuais de líderes: só médias,
   * distribuição de tensões e contagem. O líder vê o próprio resultado em /icd/me.
   */
  async dashboard(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const scores = await tx.icdScore.findMany({
        orderBy: { computedAt: 'desc' },
      });

      const empty = {
        icdMedio: null,
        totalAvaliacoes: 0,
        totalLideres: 0,
        distribuicaoPadrao: {},
        dimensionAverages: { reatividade: 0, rigidez: 0, repercussao: 0, risco: 0 },
      };
      if (scores.length === 0) return empty;

      // Último score por líder (já ordenado desc por computedAt) — sem nomes.
      const latestByLeader = new Map<string, (typeof scores)[number]>();
      for (const s of scores) if (!latestByLeader.has(s.leaderId)) latestByLeader.set(s.leaderId, s);
      const latest = [...latestByLeader.values()];

      const icdMedio = Math.round(latest.reduce((sum, s) => sum + s.score, 0) / latest.length);

      const distribuicaoPadrao: Record<string, number> = {};
      for (const s of latest) {
        const p = s.dominantPattern as DominantPattern;
        distribuicaoPadrao[p] = (distribuicaoPadrao[p] ?? 0) + 1;
      }

      // Média por dimensão (4 Rs) — agregada, sem identificar ninguém.
      const dims = ['reatividade', 'rigidez', 'repercussao', 'risco'] as const;
      const dimensionAverages = {} as Record<(typeof dims)[number], number>;
      for (const d of dims) {
        const vals = latest
          .map((s) => (s.dimensions as Record<string, number>)?.[d])
          .filter((v): v is number => typeof v === 'number');
        dimensionAverages[d] = vals.length
          ? Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length)
          : 0;
      }

      return {
        icdMedio,
        totalAvaliacoes: scores.length,
        totalLideres: latest.length,
        distribuicaoPadrao,
        dimensionAverages,
      };
    });
  }
}
