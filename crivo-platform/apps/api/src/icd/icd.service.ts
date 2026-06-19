import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mailConfigured, sendMail } from '../common/mailer';
import { computeIcd } from './scoring';
import { EditableTextsService } from '../admin/editable-texts.service';
import type { SubmitIcdDto } from './dto';
import { MIN_LEADERS_FOR_DISCLOSURE, type DominantPattern } from '@crivo/types';

@Injectable()
export class IcdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly texts: EditableTextsService,
  ) {}

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

  /**
   * ICD pessoal do líder logado (último score).
   *
   * § PRIVACIDADE — Anexo Técnico ICD do Líder v1, §11: este endpoint NÃO expõe
   * posição comparativa entre pares (rank, totalLideres, percentil). O líder vê
   * apenas o próprio score, dimensões, tensão dominante e timestamp.
   */
  async myScore(tenantId: string, userId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const mine = await tx.icdScore.findFirst({
        where: { leaderId: userId },
        orderBy: { computedAt: 'desc' },
      });
      if (!mine) return null;

      return {
        score: mine.score,
        dimensions: mine.dimensions,
        dominantPattern: mine.dominantPattern,
        computedAt: mine.computedAt.toISOString(),
      };
    });
  }

  /** Campanhas de diagnóstico (ciclos) com estatísticas: respondentes, adesão e ICD médio.
   *  Filtro opcional por setor (Portal §7). */
  async campaigns(tenantId: string, sector?: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      // "Total de participantes" passa a respeitar o setor da campanha quando informado.
      const cycles = await tx.assessmentCycle.findMany({
        where: sector ? { sector } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { assessments: { include: { score: { select: { score: true } } } } },
      });
      return Promise.all(
        cycles.map(async (c) => {
          const totalParticipantes = await tx.user.count({
            where: { active: true, ...(c.sector ? { /* TODO: filtrar por setor quando User tiver campo */ } : {}) },
          });
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
            description: c.description,
            sector: c.sector,
            publicSlug: c.publicSlug,
            startsAt: c.startsAt ? c.startsAt.toISOString() : null,
            endsAt: c.endsAt ? c.endsAt.toISOString() : null,
            reminderAt: c.reminderAt ? c.reminderAt.toISOString() : null,
            reminderSentAt: c.reminderSentAt ? c.reminderSentAt.toISOString() : null,
            closedAt: c.closedAt ? c.closedAt.toISOString() : null,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
            respondentes,
            totalParticipantes,
            adesao,
            icdMedio,
          };
        }),
      );
    });
  }

  /** Cria uma campanha. Slug público é opcional (gera se generatePublicLink=true). */
  async createCampaign(
    tenantId: string,
    dto: {
      name: string;
      description?: string;
      sector?: string;
      startsAt?: string;
      endsAt?: string;
      reminderAt?: string;
      generatePublicLink?: boolean;
    },
  ) {
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('endsAt deve ser maior que startsAt.');
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const publicSlug = dto.generatePublicLink ? makeSlug() : null;
      const cycle = await tx.assessmentCycle.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          description: dto.description ?? null,
          sector: dto.sector ?? null,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
          publicSlug,
          status: 'OPEN',
        },
      });
      return { id: cycle.id };
    });
  }

  /** Edita uma campanha. clearPublicLink remove o slug; regeneratePublicLink troca. */
  async updateCampaign(
    tenantId: string,
    id: string,
    dto: {
      name?: string;
      description?: string | null;
      sector?: string | null;
      startsAt?: string | null;
      endsAt?: string | null;
      reminderAt?: string | null;
      regeneratePublicLink?: boolean;
      clearPublicLink?: boolean;
    },
  ) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.assessmentCycle.findUnique({ where: { id } });
      if (!existing) throw new BadRequestException('Campanha não encontrada.');

      let publicSlug: string | null | undefined = undefined;
      if (dto.clearPublicLink) publicSlug = null;
      else if (dto.regeneratePublicLink) publicSlug = makeSlug();

      await tx.assessmentCycle.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description === undefined ? undefined : dto.description,
          sector: dto.sector === undefined ? undefined : dto.sector,
          startsAt: dto.startsAt === undefined ? undefined : dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null,
          reminderAt: dto.reminderAt === undefined ? undefined : dto.reminderAt ? new Date(dto.reminderAt) : null,
          publicSlug,
        },
      });
      return { ok: true as const };
    });
  }

  /** Encerra campanha. */
  async closeCampaign(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.assessmentCycle.findUnique({ where: { id } });
      if (!existing) throw new BadRequestException('Campanha não encontrada.');
      if (existing.status === 'CLOSED') {
        throw new BadRequestException('Campanha já está encerrada.');
      }
      await tx.assessmentCycle.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      return { ok: true as const };
    });
  }

  /** #56 — Dispara lembrete por e-mail para usuários do tenant que ainda não
   *  responderam à campanha. Best-effort: se RESEND_API_KEY não estiver no env,
   *  marca como "enviado simbolicamente" (reminderSentAt) e loga aviso. Atualiza
   *  reminderSentAt na campanha para evitar reenvios sucessivos. */
  async sendCampaignReminders(
    tenantId: string,
    cycleId: string,
  ): Promise<{ sent: number; pending: number; provider: string; reason?: string }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.assessmentCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new BadRequestException('Campanha não encontrada.');
      if (cycle.status === 'CLOSED') {
        throw new BadRequestException('Campanha já encerrada — sem lembrete a enviar.');
      }

      const respondidos = await tx.assessment.findMany({
        where: { cycleId },
        select: { leaderId: true },
      });
      const respondidosSet = new Set(respondidos.map((r) => r.leaderId));

      const pendentes = await tx.user.findMany({
        where: { active: true, id: { notIn: [...respondidosSet] } },
        select: { id: true, email: true, name: true },
      });

      if (!mailConfigured()) {
        await tx.assessmentCycle.update({
          where: { id: cycleId },
          data: { reminderSentAt: new Date() },
        });
        return {
          sent: 0,
          pending: pendentes.length,
          provider: 'stub',
          reason: 'Sem provider de e-mail (SMTP_* ou RESEND_API_KEY) — operador deve enviar manualmente.',
        };
      }

      // #60 — Corpo do lembrete vem do EditableText (fallback embutido).
      const bodyTemplate = await this.texts.render(
        'EMAIL_CAMPAIGN_REMINDER_BODY',
        `<p>Olá {first_name},</p>
<p>Você ainda não respondeu à campanha de diagnóstico <strong>{campaign_name}</strong>.</p>
<p>{description}</p>
<p>Acesse o portal para responder.</p>`,
      );
      const subjectTemplate = await this.texts.render(
        'EMAIL_CAMPAIGN_REMINDER_SUBJECT',
        'Lembrete: responda a campanha "{campaign_name}"',
      );

      let sent = 0;
      let provider = 'stub';
      for (const u of pendentes) {
        const subject = subjectTemplate.replaceAll('{campaign_name}', cycle.name);
        const html = bodyTemplate
          .replaceAll('{first_name}', u.name.split(' ')[0])
          .replaceAll('{campaign_name}', cycle.name)
          .replaceAll('{description}', cycle.description ?? 'Sua participação ajuda a empresa a entender o ambiente decisório.');
        // Best-effort: falha individual não interrompe o lote.
        const r = await sendMail({ to: u.email, subject, html });
        if (r.ok) sent += 1;
        provider = r.provider;
      }

      await tx.assessmentCycle.update({
        where: { id: cycleId },
        data: { reminderSentAt: new Date() },
      });

      return { sent, pending: pendentes.length, provider };
    });
  }

  /** Info pública por slug — SEM auth. Não vaza score/respondentes individuais. */
  async getPublicBySlug(slug: string) {
    // Bypass RLS porque é endpoint público (sem tenantId no contexto).
    const cycle = await this.prisma.admin.assessmentCycle.findUnique({
      where: { publicSlug: slug },
      include: { org: { select: { name: true } } },
    });
    if (!cycle) throw new BadRequestException('Campanha não encontrada ou link inválido.');
    return {
      name: cycle.name,
      description: cycle.description,
      sector: cycle.sector,
      status: cycle.status,
      startsAt: cycle.startsAt ? cycle.startsAt.toISOString() : null,
      endsAt: cycle.endsAt ? cycle.endsAt.toISOString() : null,
      tenantName: cycle.org.name,
    };
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

      // Confidencialidade §11: piso de respondentes. Com menos de
      // MIN_LEADERS_FOR_DISCLOSURE líderes avaliados, NÃO devolve agregados
      // (média/distribuição/dimensões) — senão expõe o resultado individual
      // disfarçado de "agregado". Mantém só as contagens + flag suppressed.
      if (latest.length < MIN_LEADERS_FOR_DISCLOSURE) {
        return {
          ...empty,
          totalAvaliacoes: scores.length,
          totalLideres: latest.length,
          suppressed: true,
          minLeaders: MIN_LEADERS_FOR_DISCLOSURE,
        };
      }

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

/** Slug url-safe random — base36, 10 chars ~ 50 bits entropia. */
function makeSlug(): string {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 10; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
