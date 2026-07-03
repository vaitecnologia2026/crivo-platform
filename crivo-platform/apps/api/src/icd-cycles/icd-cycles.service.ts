import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeLeaderQuarterlyIcd,
  computeCompanyQuarterlyIcd,
  defaultIcdCycleName,
  getIcdMaturityBand,
  type IcdAxesScores,
  type IcdCycleData,
  type LeaderQuarterlyIcdData,
  type CompanyQuarterlyIcdData,
} from '@crivo/types';
import type { CreateIcdCycleDto } from './dto';

@Injectable()
export class IcdCyclesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista ciclos do tenant, ordenados por ano/trimestre desc. */
  async list(tenantId: string): Promise<IcdCycleData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.icdCycle.findMany({
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      });
      return rows.map(toCycleData);
    });
  }

  /** Cria um novo ciclo trimestral. Só 1 OPEN por tenant: se já existir um,
   *  bloqueia. Liga retroativamente DecisionIcdScores cujo decidedAt da decisão
   *  caia em [startsAt, endsAt] e ainda não tenham cycleId. */
  async create(tenantId: string, dto: CreateIcdCycleDto): Promise<IcdCycleData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const startsAt = new Date(dto.startsAt);
      const endsAt = new Date(dto.endsAt);
      if (endsAt <= startsAt) {
        throw new BadRequestException('endsAt deve ser maior que startsAt.');
      }

      const openExisting = await tx.icdCycle.findFirst({ where: { status: 'OPEN' } });
      if (openExisting) {
        throw new BadRequestException(
          'Já existe um ciclo aberto. Feche-o antes de iniciar um novo (Anexo §9.6).',
        );
      }

      const dupe = await tx.icdCycle.findFirst({
        where: { year: dto.year, quarter: dto.quarter },
      });
      if (dupe) throw new BadRequestException('Já existe um ciclo neste trimestre/ano.');

      const cycle = await tx.icdCycle.create({
        data: {
          tenantId,
          name: dto.name ?? defaultIcdCycleName(dto.year, dto.quarter),
          quarter: dto.quarter,
          year: dto.year,
          startsAt,
          endsAt,
          status: 'OPEN',
        },
      });

      // Liga avaliações órfãs cujo `decidedAt` da decisão caia neste ciclo.
      const orphans = await tx.decisionIcdScore.findMany({
        where: { cycleId: null },
        include: { decision: { select: { decidedAt: true } } },
      });
      for (const o of orphans) {
        const at = o.decision.decidedAt;
        if (at >= startsAt && at <= endsAt) {
          await tx.decisionIcdScore.update({
            where: { id: o.id },
            data: { cycleId: cycle.id },
          });
        }
      }

      return toCycleData(cycle);
    });
  }

  /** ICD PARCIAL — calcula em tempo real (sem persistir) o estado do ciclo
   *  atualmente aberto. Aplica supressão <5. RH/CEO/ADMIN. */
  async partialCompanyIcd(tenantId: string): Promise<{
    cycle: IcdCycleData | null;
    leaders: LeaderQuarterlyIcdData[];
    company: CompanyQuarterlyIcdData | null;
  }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.icdCycle.findFirst({ where: { status: 'OPEN' } });
      if (!cycle) return { cycle: null, leaders: [], company: null };

      const scores = await tx.decisionIcdScore.findMany({
        where: { cycleId: cycle.id },
      });

      // Agrupa por líder.
      const byLeader = new Map<string, typeof scores>();
      for (const s of scores) {
        const arr = byLeader.get(s.leaderId) ?? [];
        arr.push(s);
        byLeader.set(s.leaderId, arr);
      }

      const leaderResults: LeaderQuarterlyIcdData[] = [];
      for (const [leaderId, leaderScores] of byLeader) {
        const computed = computeLeaderQuarterlyIcd(
          leaderScores.map((s) => ({
            score: s.score,
            weight: s.weight,
            axes: s.axes as unknown as IcdAxesScores,
          })),
        );
        if (!computed) continue; // sem decisões elegíveis
        leaderResults.push({
          id: 'partial', // não persistido
          cycleId: cycle.id,
          leaderId,
          score: computed.score,
          decisionCount: computed.decisionCount,
          totalWeight: computed.totalWeight,
          axesAverage: computed.axesAverage,
          band: getIcdMaturityBand(computed.score),
          computedAt: new Date().toISOString(),
        });
      }

      const companyComputed = computeCompanyQuarterlyIcd(
        leaderResults.map((l) => ({ score: l.score, axesAverage: l.axesAverage })),
      );

      const company: CompanyQuarterlyIcdData = {
        id: 'partial',
        cycleId: cycle.id,
        score: companyComputed.score,
        suppressed: companyComputed.suppressed,
        eligibleLeaders: companyComputed.eligibleLeaders,
        distribution: companyComputed.distribution,
        axesAverage: companyComputed.axesAverage,
        band: companyComputed.score != null ? getIcdMaturityBand(companyComputed.score) : null,
        computedAt: new Date().toISOString(),
      };

      // §11 (Anexo ICD): a gestão NÃO recebe o ranking individual por líder.
      // O líder vê o próprio ICD via /icd-cycles/current/me. `leaderResults`
      // segue só como insumo do agregado da empresa (calculado acima).
      void leaderResults;
      return { cycle: toCycleData(cycle), leaders: [], company };
    });
  }

  /** ICD PARCIAL DO LÍDER — o próprio líder vê seu ICD acumulado no ciclo aberto.
   *  Não cobre supressão (é dado individual). Usado em /icd-cycles/current/me. */
  async myPartialIcd(tenantId: string, userId: string): Promise<LeaderQuarterlyIcdData | null> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.icdCycle.findFirst({ where: { status: 'OPEN' } });
      if (!cycle) return null;
      const scores = await tx.decisionIcdScore.findMany({
        where: { cycleId: cycle.id, leaderId: userId },
      });
      if (scores.length === 0) return null;

      const computed = computeLeaderQuarterlyIcd(
        scores.map((s) => ({
          score: s.score,
          weight: s.weight,
          axes: s.axes as unknown as IcdAxesScores,
        })),
      );
      if (!computed) return null;
      return {
        id: 'partial',
        cycleId: cycle.id,
        leaderId: userId,
        score: computed.score,
        decisionCount: computed.decisionCount,
        totalWeight: computed.totalWeight,
        axesAverage: computed.axesAverage,
        band: getIcdMaturityBand(computed.score),
        computedAt: new Date().toISOString(),
      };
    });
  }

  /** FECHAMENTO trimestral (§9.6): congela leaderQuarterly + companyQuarterly.
   *  Tudo numa transação Prisma: calcula → persiste → marca ciclo CLOSED. */
  async close(tenantId: string, cycleId: string): Promise<IcdCycleData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.icdCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new NotFoundException('Ciclo não encontrado.');
      if (cycle.status === 'CLOSED') {
        throw new BadRequestException('Ciclo já está fechado.');
      }

      const scores = await tx.decisionIcdScore.findMany({ where: { cycleId } });
      const byLeader = new Map<string, typeof scores>();
      for (const s of scores) {
        const arr = byLeader.get(s.leaderId) ?? [];
        arr.push(s);
        byLeader.set(s.leaderId, arr);
      }

      // 1) Persiste 1 LeaderQuarterlyIcd por líder elegível.
      const leaderResults: Array<{ score: number; axesAverage: IcdAxesScores }> = [];
      for (const [leaderId, leaderScores] of byLeader) {
        const computed = computeLeaderQuarterlyIcd(
          leaderScores.map((s) => ({
            score: s.score,
            weight: s.weight,
            axes: s.axes as unknown as IcdAxesScores,
          })),
        );
        if (!computed) continue;
        await tx.leaderQuarterlyIcd.upsert({
          where: { cycleId_leaderId: { cycleId, leaderId } },
          create: {
            tenantId,
            cycleId,
            leaderId,
            score: computed.score,
            decisionCount: computed.decisionCount,
            totalWeight: computed.totalWeight,
            axesAverage: computed.axesAverage as unknown as object,
          },
          update: {
            score: computed.score,
            decisionCount: computed.decisionCount,
            totalWeight: computed.totalWeight,
            axesAverage: computed.axesAverage as unknown as object,
            computedAt: new Date(),
          },
        });
        leaderResults.push({ score: computed.score, axesAverage: computed.axesAverage });
      }

      // 2) Persiste CompanyQuarterlyIcd (com supressão <5 §11).
      const companyComputed = computeCompanyQuarterlyIcd(leaderResults);
      await tx.companyQuarterlyIcd.upsert({
        where: { cycleId },
        create: {
          tenantId,
          cycleId,
          score: companyComputed.score,
          suppressed: companyComputed.suppressed,
          eligibleLeaders: companyComputed.eligibleLeaders,
          distribution: companyComputed.distribution as unknown as object,
          axesAverage: companyComputed.axesAverage as unknown as object,
        },
        update: {
          score: companyComputed.score,
          suppressed: companyComputed.suppressed,
          eligibleLeaders: companyComputed.eligibleLeaders,
          distribution: companyComputed.distribution as unknown as object,
          axesAverage: companyComputed.axesAverage as unknown as object,
          computedAt: new Date(),
        },
      });

      // 3) Marca ciclo como CLOSED.
      const updated = await tx.icdCycle.update({
        where: { id: cycleId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      return toCycleData(updated);
    });
  }

  /** Lê o resultado oficial do ciclo (após fechamento). */
  async official(tenantId: string, cycleId: string): Promise<{
    cycle: IcdCycleData;
    leaders: LeaderQuarterlyIcdData[];
    company: CompanyQuarterlyIcdData | null;
  }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.icdCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new NotFoundException('Ciclo não encontrado.');

      const company = await tx.companyQuarterlyIcd.findUnique({ where: { cycleId } });

      return {
        cycle: toCycleData(cycle),
        // §11 (Anexo ICD): não expõe ranking individual por líder à gestão.
        // O líder acessa o próprio ICD via /icd-cycles/current/me.
        leaders: [],
        company: company
          ? {
              id: company.id,
              cycleId: company.cycleId,
              score: company.score,
              suppressed: company.suppressed,
              eligibleLeaders: company.eligibleLeaders,
              distribution: company.distribution as any,
              axesAverage: company.axesAverage as IcdAxesScores,
              band: company.score != null ? getIcdMaturityBand(company.score) : null,
              computedAt: company.computedAt.toISOString(),
            }
          : null,
      };
    });
  }
}

function toCycleData(row: any): IcdCycleData {
  return {
    id: row.id,
    name: row.name,
    quarter: row.quarter,
    year: row.year,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}
