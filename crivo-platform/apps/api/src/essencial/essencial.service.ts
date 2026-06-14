import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computePreDiagnostic,
  type CreateEssentialRecordRequest,
  type EssentialRecordData,
  type EssentialRecordKind,
  type SelfAssessmentData,
  type SubmitSelfAssessmentRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Diagnóstico Essencial (Briefing §5) — jornada guiada para empresas pequenas.
 * Autoavaliação (reusa o instrumento de maturidade do pré-diagnóstico) +
 * registros de escuta/observação. Os achados alimentam o Plano de Ação e o
 * dossiê AEP/AEP+PGR. Data plane: tudo sob forTenant (RLS).
 */
@Injectable()
export class EssencialService {
  constructor(private readonly prisma: PrismaService) {}

  async submitSelfAssessment(
    tenantId: string,
    dto: SubmitSelfAssessmentRequest,
  ): Promise<SelfAssessmentData> {
    let result;
    try {
      result = computePreDiagnostic(dto.answers ?? []);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sa = await tx.selfAssessment.create({
        data: {
          tenantId,
          answers: dto.answers as unknown as object,
          score: result.score,
          result: result as unknown as object,
        },
      });
      return { id: sa.id, score: sa.score, result, createdAt: sa.createdAt.toISOString() };
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
