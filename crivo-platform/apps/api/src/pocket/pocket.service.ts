import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  POCKET_QUESTIONS,
  POCKET_QUESTIONS_VERSION,
  type PocketSessionData,
  type PocketReflectionData,
} from '@crivo/types';
import type { CreatePocketSessionDto, UpsertReflectionDto } from './dto';

const VALID_QUESTION_CODES = new Set(POCKET_QUESTIONS.map((q) => q.code));

@Injectable()
export class PocketService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista as sessões do líder logado. Histórico individual (§13).
   *  Nunca expõe sessões de outros líderes. */
  async listMySessions(tenantId: string, userId: string): Promise<PocketSessionData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sessions = await tx.pocketSession.findMany({
        where: { leaderId: userId },
        orderBy: { createdAt: 'desc' },
        include: { reflections: true, aiSummary: true },
      });
      return sessions.map(toSessionData);
    });
  }

  /** Detalhe de uma sessão (só o líder dono). */
  async getSession(tenantId: string, userId: string, sessionId: string): Promise<PocketSessionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const session = await tx.pocketSession.findUnique({
        where: { id: sessionId },
        include: { reflections: true, aiSummary: true },
      });
      if (!session) throw new NotFoundException('Sessão não encontrada.');
      if (session.leaderId !== userId) {
        throw new ForbiddenException('Você só pode visualizar suas próprias sessões Pocket.');
      }
      return toSessionData(session);
    });
  }

  /** Inicia uma nova sessão. Se decisionId informado, verifica que pertence
   *  ao líder (§13: não vincular decisão de outro líder). */
  async createSession(
    tenantId: string,
    userId: string,
    dto: CreatePocketSessionDto,
  ): Promise<PocketSessionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (dto.decisionId) {
        const decision = await tx.decision.findUnique({
          where: { id: dto.decisionId },
          select: { leaderId: true },
        });
        if (!decision) throw new BadRequestException('Decisão informada não existe.');
        if (decision.leaderId !== userId) {
          throw new ForbiddenException(
            'Só é possível vincular a uma decisão sua (§13 — privacidade).',
          );
        }
      }

      const session = await tx.pocketSession.create({
        data: {
          tenantId,
          leaderId: userId,
          context: dto.context ?? null,
          momentOfUse: dto.momentOfUse ?? 'AVULSO',
          decisionId: dto.decisionId ?? null,
          questionsVersion: POCKET_QUESTIONS_VERSION,
        },
      });
      const full = await tx.pocketSession.findUnique({
        where: { id: session.id },
        include: { reflections: true, aiSummary: true },
      });
      return toSessionData(full!);
    });
  }

  /** Upsert de uma reflexão a uma pergunta (1 por pergunta por sessão).
   *  Só o líder dono. Bloqueia se sessão estiver CONCLUIDA. */
  async upsertReflection(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: UpsertReflectionDto,
  ): Promise<PocketReflectionData> {
    if (!VALID_QUESTION_CODES.has(dto.questionCode)) {
      throw new BadRequestException(
        `Código de pergunta inválido: ${dto.questionCode}. Use C1-O2.`,
      );
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const session = await tx.pocketSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessão não encontrada.');
      if (session.leaderId !== userId) {
        throw new ForbiddenException('Você só pode editar as suas reflexões.');
      }
      if (session.status === 'CONCLUIDA') {
        throw new BadRequestException(
          'Sessão já concluída — abra uma nova para registrar reflexões.',
        );
      }

      const reflection = await tx.pocketReflection.upsert({
        where: {
          sessionId_questionCode: {
            sessionId,
            questionCode: dto.questionCode,
          },
        },
        create: {
          tenantId,
          sessionId,
          questionCode: dto.questionCode,
          text: dto.text ?? null,
          tags: dto.tags ?? [],
        },
        update: {
          text: dto.text ?? null,
          tags: dto.tags ?? [],
        },
      });
      return toReflectionData(reflection);
    });
  }

  /** Marca a sessão como CONCLUIDA (registra completedAt). Só o líder dono. */
  async completeSession(
    tenantId: string,
    userId: string,
    sessionId: string,
  ): Promise<PocketSessionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const session = await tx.pocketSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessão não encontrada.');
      if (session.leaderId !== userId) {
        throw new ForbiddenException('Você só pode concluir suas próprias sessões.');
      }
      await tx.pocketSession.update({
        where: { id: sessionId },
        data: { status: 'CONCLUIDA', completedAt: new Date() },
      });
      const full = await tx.pocketSession.findUnique({
        where: { id: sessionId },
        include: { reflections: true, aiSummary: true },
      });
      return toSessionData(full!);
    });
  }

  /** Remove sessão (apenas do dono, e somente se não concluída). */
  async removeSession(tenantId: string, userId: string, sessionId: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const session = await tx.pocketSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessão não encontrada.');
      if (session.leaderId !== userId) {
        throw new ForbiddenException('Você só pode remover suas próprias sessões.');
      }
      if (session.status === 'CONCLUIDA') {
        throw new BadRequestException(
          'Sessão já concluída — não pode ser removida (histórico imutável).',
        );
      }
      await tx.pocketSession.delete({ where: { id: sessionId } });
      return { ok: true as const };
    });
  }
}

function toReflectionData(row: any): PocketReflectionData {
  return {
    id: row.id,
    questionCode: row.questionCode,
    text: row.text,
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSessionData(row: any): PocketSessionData {
  return {
    id: row.id,
    leaderId: row.leaderId,
    context: row.context,
    momentOfUse: row.momentOfUse,
    decisionId: row.decisionId,
    status: row.status,
    questionsVersion: row.questionsVersion,
    reflections: (row.reflections ?? []).map(toReflectionData),
    aiSummary: row.aiSummary
      ? {
          id: row.aiSummary.id,
          synthesis: row.aiSummary.synthesis,
          recommendation: row.aiSummary.recommendation,
          nextStep: row.aiSummary.nextStep,
          modelVersion: row.aiSummary.modelVersion,
          createdAt: row.aiSummary.createdAt.toISOString(),
        }
      : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
