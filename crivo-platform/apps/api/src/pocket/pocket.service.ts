import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  POCKET_DIMENSION_LABEL,
  POCKET_QUESTIONS,
  POCKET_QUESTIONS_VERSION,
  type PocketDimension,
  type PocketSessionData,
  type PocketReflectionData,
} from '@crivo/types';
import { AiSettingsService } from '../admin/ai-settings.service';
import type { CreatePocketSessionDto, UpsertReflectionDto } from './dto';

const VALID_QUESTION_CODES = new Set(POCKET_QUESTIONS.map((q) => q.code));

@Injectable()
export class PocketService {
  private readonly log = new Logger(PocketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
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

      // Tenta gerar a Mentoria IA (§10.2). Falha silenciosa para não bloquear o líder.
      try {
        await this.maybeGenerateAiSummary(tx, sessionId, tenantId);
      } catch (e) {
        this.log.warn(`Mentoria IA falhou na sessão ${sessionId}: ${e instanceof Error ? e.message : e}`);
      }

      const full = await tx.pocketSession.findUnique({
        where: { id: sessionId },
        include: { reflections: true, aiSummary: true },
      });
      return toSessionData(full!);
    });
  }

  /** Anexo Pocket §10.2 — Mentoria comportamental e metacognitiva.
   *  Gera síntese + recomendação + próximo passo a partir das reflexões.
   *  NÃO diagnostica, NÃO prescreve, NÃO substitui mentor humano. */
  private async maybeGenerateAiSummary(
    tx: any,
    sessionId: string,
    tenantId: string,
  ): Promise<void> {
    const settings = await this.ai.get();
    if (!settings.enabled || !settings.hasKey) return; // IA off → encerra sem síntese

    const session = await tx.pocketSession.findUnique({
      where: { id: sessionId },
      include: { reflections: true },
    });
    if (!session) return;

    // Sem reflexões substantivas → não gera (evita custo de IA com payload vazio).
    const hasContent = session.reflections.some(
      (r: any) => (r.text?.trim().length ?? 0) > 10,
    );
    if (!hasContent) return;

    const key = await this.ai.getApiKey();
    if (!key) return;

    const system = buildPocketSummarySystemPrompt();
    const user = buildPocketSummaryUserMessage(session);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          temperature: 0.5,
          max_tokens: 700,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) return;
      const parsed = safeParseJson(raw);
      if (!parsed?.synthesis || typeof parsed.synthesis !== 'string') return;

      // A IA pode devolver tipos inesperados — só persiste string (senão null),
      // evitando gravar objeto/array em colunas String.
      const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
      const fields = {
        synthesis: parsed.synthesis,
        recommendation: asStr(parsed.recommendation),
        nextStep: asStr(parsed.nextStep),
        modelVersion: settings.model || 'gpt-4o-mini',
      };
      await tx.pocketAiSummary.upsert({
        where: { sessionId },
        create: { tenantId, sessionId, ...fields },
        update: fields,
      });
    } catch (e) {
      this.log.warn(`Falha de IA para sessão ${sessionId}: ${e instanceof Error ? e.message : e}`);
    }
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

function buildPocketSummarySystemPrompt(): string {
  return `
Você é a Mentoria IA do CRIVO Pocket. Apoia o líder a refletir sobre como
está interpretando, reagindo, decidindo e conduzindo situações — nas 5
dimensões CRIVO (Consciência, Responsabilidade, Integração, Valores,
Organização).

REGRAS ABSOLUTAS:
- NÃO diagnostica, NÃO prescreve, NÃO substitui terapeuta nem mentor humano.
- NÃO toma decisão pelo líder, NÃO julga, NÃO pontua, NÃO ranqueia.
- Linguagem de apoio, não de controle. Frases curtas, voz ativa.
- Tom acolhedor, técnico, executivo. Em português do Brasil.

FORMATO de saída — APENAS JSON válido (sem markdown, sem prefixo):
{
  "synthesis": "1 parágrafo (3-4 frases). Resume o que o líder está
                trabalhando, sem julgamento. Use voz reflexiva.",
  "recommendation": "1 parágrafo curto. Cuidado ou atenção sugerida com
                     base no padrão observado nas reflexões. Pode ser null
                     se nada se destacar.",
  "nextStep": "1 frase imperativa, concreta, executável em até 7 dias.
               Conecta com a Dimensão de Organização. Pode ser null."
}

NÃO use exclamações. NÃO use emoji. NÃO mencione o nome da empresa.
NÃO repita as perguntas literalmente.
`.trim();
}

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
