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

  /** Dashboard executivo do ICD — agregados e ranking de líderes do tenant. */
  async dashboard(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const scores = await tx.icdScore.findMany({
        orderBy: { computedAt: 'desc' },
        include: { leader: { select: { id: true, name: true, email: true } } },
      });

      if (scores.length === 0) {
        return { icdMedio: null, totalAvaliacoes: 0, ranking: [], distribuicaoPadrao: {} };
      }

      // Último score por líder (já ordenado desc por computedAt)
      const latestByLeader = new Map<string, (typeof scores)[number]>();
      for (const s of scores) if (!latestByLeader.has(s.leaderId)) latestByLeader.set(s.leaderId, s);

      const ranking = [...latestByLeader.values()]
        .map((s) => ({
          leaderId: s.leaderId,
          nome: s.leader.name,
          score: s.score,
          padraoDominante: s.dominantPattern,
          dimensoes: s.dimensions,
        }))
        .sort((a, b) => b.score - a.score);

      const icdMedio = Math.round(ranking.reduce((sum, r) => sum + r.score, 0) / ranking.length);

      const distribuicaoPadrao: Record<string, number> = {};
      for (const r of ranking) {
        const p = r.padraoDominante as DominantPattern;
        distribuicaoPadrao[p] = (distribuicaoPadrao[p] ?? 0) + 1;
      }

      return {
        icdMedio,
        totalAvaliacoes: scores.length,
        totalLideres: ranking.length,
        ranking,
        distribuicaoPadrao,
      };
    });
  }
}
