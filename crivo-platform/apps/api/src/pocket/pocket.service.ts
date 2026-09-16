import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_DIMENSIONS,
  POCKET_DIMENSION_LABEL,
  POCKET_QUESTIONS,
  POCKET_QUESTIONS_VERSION,
  type PocketAggregate,
  type PocketDimension,
  type PocketSessionData,
  type PocketReflectionData,
} from '@crivo/types';
import { AiSettingsService } from '../admin/ai-settings.service';
import { AiPromptsService } from '../admin/ai-prompts.service';
import { countActiveLeaders } from '../icd-cycles/icd-cycles.service';
import type { CreatePocketSessionDto, UpsertReflectionDto } from './dto';

const VALID_QUESTION_CODES = new Set(POCKET_QUESTIONS.map((q) => q.code));
/** questionCode ("C1".."O2") → dimensão C/R/I/V/O, para agregar por tema. */
const QUESTION_DIMENSION = new Map<string, PocketDimension>(POCKET_QUESTIONS.map((q) => [q.code, q.dimension]));

@Injectable()
export class PocketService {
  private readonly log = new Logger(PocketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
    private readonly prompts: AiPromptsService,
  ) {}

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
          select: { leaderId: true, deletedAt: true },
        });
        if (!decision || decision.deletedAt) {
          throw new BadRequestException('Decisão informada não existe.');
        }
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

  /** Marca a sessão como CONCLUIDA (registra completedAt). Só o líder dono.
   *  Após marcar, tenta gerar Síntese da Mentoria IA (§10.2). Best-effort —
   *  se a IA estiver desativada ou falhar, a sessão é concluída sem síntese. */
  async completeSession(
    tenantId: string,
    userId: string,
    sessionId: string,
  ): Promise<PocketSessionData> {
    // 1) Conclui a sessão numa transação CURTA (sem I/O de rede).
    await this.prisma.forTenant(tenantId, async (tx) => {
      const session = await tx.pocketSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessão não encontrada.');
      if (session.leaderId !== userId) {
        throw new ForbiddenException('Você só pode concluir suas próprias sessões.');
      }
      await tx.pocketSession.update({
        where: { id: sessionId },
        data: { status: 'CONCLUIDA', completedAt: new Date() },
      });
    });

    // 2) Mentoria IA (§10.2) FORA da transação de conclusão: se a OpenAI demorar
    //    (>5s = timeout de transação do Prisma) ou falhar, a conclusão já está
    //    commitada e NÃO é revertida. Best-effort, não bloqueia o líder.
    try {
      await this.maybeGenerateAiSummary(sessionId, tenantId);
    } catch (e) {
      this.log.warn(`Mentoria IA falhou na sessão ${sessionId}: ${e instanceof Error ? e.message : e}`);
    }

    // 3) Relê a sessão completa para retornar.
    const full = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.pocketSession.findUnique({
        where: { id: sessionId },
        include: { reflections: true, aiSummary: true },
      }),
    );
    return toSessionData(full!);
  }

  /** Anexo Pocket §10.2 — Mentoria comportamental e metacognitiva.
   *  Gera síntese + recomendação + próximo passo a partir das reflexões.
   *  NÃO diagnostica, NÃO prescreve, NÃO substitui mentor humano. */
  private async maybeGenerateAiSummary(
    sessionId: string,
    tenantId: string,
  ): Promise<void> {
    const settings = await this.ai.get();
    if (!settings.enabled || !settings.hasKey) return; // IA off → encerra sem síntese
    // Respeita o escopo de módulos da IA (vazio = todos liberados).
    if (settings.enabledModules.length > 0 && !settings.enabledModules.includes('pocket')) return;

    // Lê as reflexões numa transação CURTA (sem I/O de rede).
    const session = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.pocketSession.findUnique({
        where: { id: sessionId },
        include: { reflections: true },
      }),
    );
    if (!session) return;

    // Sem reflexões substantivas → não gera (evita custo de IA com payload vazio).
    const hasContent = session.reflections.some(
      (r: any) => (r.text?.trim().length ?? 0) > 10,
    );
    if (!hasContent) return;

    const system = await this.prompts.resolve('pocket_summary');
    const user = buildPocketSummaryUserMessage(session);

    try {
      const r = await this.ai.chat({
        useCase: 'pocket_summary',
        tenantId,
        temperature: 0.5,
        maxTokens: 700,
        timeoutMs: 30000,
        responseFormat: 'json_object',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      if (!r.ok) {
        // best-effort: síntese ausente é aceitável — mas registra (como antes da
        // centralização), senão a falha some do log da aplicação.
        this.log.warn(
          `Falha de IA para sessão ${sessionId}: ${r.kind}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ''}${r.message ? ` — ${r.message}` : ''}`,
        );
        return;
      }
      const parsed = safeParseJson(r.content);
      if (!parsed?.synthesis || typeof parsed.synthesis !== 'string') return;

      // A IA pode devolver tipos inesperados — só persiste string (senão null),
      // evitando gravar objeto/array em colunas String.
      const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
      const fields = {
        synthesis: parsed.synthesis,
        recommendation: asStr(parsed.recommendation),
        nextStep: asStr(parsed.nextStep),
        modelVersion: r.model,
      };
      // Grava a síntese numa transação CURTA (a chamada à OpenAI acima ocorreu
      // FORA de qualquer transação, então nada segurou conexão do pool).
      await this.prisma.forTenant(tenantId, async (tx) =>
        tx.pocketAiSummary.upsert({
          where: { sessionId },
          create: { tenantId, sessionId, ...fields },
          update: fields,
        }),
      );
    } catch (e) {
      this.log.warn(`Falha de IA para sessão ${sessionId}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** AGREGADO do Pocket por dimensão (tela Liderança do portal e Módulos ›
   *  Liderança do Super Admin). Anexo Pocket §13: sessões e reflexões são do
   *  líder — aqui só CONTAGENS (sessões concluídas com ≥ 1 reflexão respondida
   *  por dimensão) e adesão (% de líderes ativos com ≥ 1 sessão concluída).
   *  Nunca texto, nunca por pessoa, nenhum score (o Pocket não pontua).
   *  Recorte: o ciclo ICD informado, senão o aberto, senão todo o histórico.
   *  Supressão §11: com menos de MIN_LEADERS_FOR_DISCLOSURE líderes com
   *  sessão concluída, contagens e adesão vêm null. */
  async aggregate(tenantId: string, cycleId?: string): Promise<PocketAggregate> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = cycleId
        ? await tx.icdCycle.findUnique({ where: { id: cycleId } })
        : await tx.icdCycle.findFirst({ where: { status: 'OPEN' } });
      if (cycleId && !cycle) throw new NotFoundException('Ciclo não encontrado.');

      const completedAt = cycle ? { gte: cycle.startsAt, lte: cycle.endsAt } : undefined;
      const [eligibleLeaders, sessions] = await Promise.all([
        countActiveLeaders(tx),
        tx.pocketSession.findMany({
          where: { status: 'CONCLUIDA', ...(completedAt ? { completedAt } : {}) },
          // Só o necessário para contar: nada de texto de reflexão sai daqui.
          select: { leaderId: true, reflections: { select: { questionCode: true, text: true, tags: true } } },
        }),
      ]);

      const participatingLeaders = new Set(sessions.map((s) => s.leaderId)).size;
      const suppressed = participatingLeaders < MIN_LEADERS_FOR_DISCLOSURE;

      let byDimension: PocketAggregate['byDimension'] = null;
      let adhesionPct: number | null = null;
      let completedSessions: number | null = null;
      if (!suppressed) {
        const perDim = new Map<PocketDimension, number>(POCKET_DIMENSIONS.map((d) => [d, 0]));
        for (const s of sessions) {
          const touched = new Set<PocketDimension>();
          for (const r of s.reflections) {
            const answered = (r.text?.trim().length ?? 0) > 0 || (r.tags?.length ?? 0) > 0;
            const dim = QUESTION_DIMENSION.get(r.questionCode);
            if (answered && dim) touched.add(dim);
          }
          for (const d of touched) perDim.set(d, (perDim.get(d) ?? 0) + 1);
        }
        byDimension = POCKET_DIMENSIONS.map((d) => ({
          dimension: d,
          label: POCKET_DIMENSION_LABEL[d],
          sessions: perDim.get(d) ?? 0,
        }));
        completedSessions = sessions.length;
        adhesionPct = eligibleLeaders > 0 ? Math.round((participatingLeaders / eligibleLeaders) * 100) : null;
      }

      return {
        period: cycle
          ? { cycleId: cycle.id, cycleName: cycle.name, from: cycle.startsAt.toISOString(), to: cycle.endsAt.toISOString() }
          : null,
        suppressed,
        minLeadersForDisclosure: MIN_LEADERS_FOR_DISCLOSURE,
        eligibleLeaders,
        participatingLeaders,
        completedSessions,
        adhesionPct,
        byDimension,
        questionsVersion: POCKET_QUESTIONS_VERSION,
      };
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

// ── Mentoria IA (§10.2) ─────────────────────────────────────────────
// O prompt-base (system) vive na Central de Prompts (Configurações de IA),
// resolvido por `prompts.resolve('pocket_summary')`. Aqui só a mensagem do usuário.

function buildPocketSummaryUserMessage(session: any): string {
  const ctx = session.context ? `Contexto: ${session.context}\n` : '';
  const moment = `Momento de uso: ${session.momentOfUse}\n`;
  const reflections = (session.reflections as any[])
    .filter((r) => r.text && r.text.trim().length > 0)
    .map((r) => {
      const q = POCKET_QUESTIONS.find((x) => x.code === r.questionCode);
      const dim = q ? POCKET_DIMENSION_LABEL[q.dimension as PocketDimension] : r.questionCode;
      return `[${r.questionCode} · ${dim}] ${q?.text ?? ''}\n→ ${r.text.trim()}`;
    })
    .join('\n\n');
  return `${ctx}${moment}\n${reflections}\n\nProduza a síntese seguindo o formato JSON especificado.`;
}

function safeParseJson(s: string): { synthesis?: string; recommendation?: string | null; nextStep?: string | null } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
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
