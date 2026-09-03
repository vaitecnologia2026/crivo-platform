import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mailConfigured, sendMail } from '../common/mailer';
import { computeIcd } from './scoring';
import { EditableTextsService } from '../admin/editable-texts.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import type { SubmitIcdDto } from './dto';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import {
  resolveActiveMethodology,
  resolveInstrumentForTenant,
  resolvePsychosocialInstrument,
  usesPsychosocialEngine,
} from '../admin/methodology.service';
import type { SubmitPsychosocialDto } from '../psychosocial/dto';
import { MIN_LEADERS_FOR_DISCLOSURE, type DominantPattern } from '@crivo/types';

@Injectable()
export class IcdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly texts: EditableTextsService,
    private readonly notifications: NotificationSettingsService,
    // A campanha aplica o diagnóstico do MÉTODO CONTRATADO: psicossocial quando
    // o método é o Organizacional, o instrumento do catálogo nos demais. Reusar
    // os dois serviços mantém UM caminho de coleta por instrumento.
    private readonly psychosocial: PsychosocialService,
    private readonly diagnostics: DiagnosticsService,
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

  /** Campanhas de diagnóstico (ciclos) com as estatísticas DO DIAGNÓSTICO:
   *  convidados, respondentes, adesão e índice médio. Filtro opcional por setor. */
  async campaigns(tenantId: string, sector?: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycles = await tx.assessmentCycle.findMany({
        where: sector ? { sector } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      return Promise.all(
        cycles.map(async (c) => {
          // A campanha passa a medir o DIAGNÓSTICO. Antes a adesão vinha das
          // avaliações de líderes do ICD dividida por TODOS os usuários ativos
          // da empresa (com um TODO admitindo que o filtro por setor faltava):
          // uma campanha do questionário nunca aparecia ali.
          const convidados = await tx.campaignInvite.count({ where: { cycleId: c.id } });
          const respondidos = await tx.campaignInvite.count({
            where: { cycleId: c.id, respondedAt: { not: null } },
          });
          // Respostas do ciclo pelos DOIS motores: psicossocial (Organizacional)
          // e catálogo (Essencial). Inclui quem respondeu pelo link público da
          // campanha, que não passa por convite.
          const [psy, diag] = await Promise.all([
            tx.psychosocialResponse.findMany({ where: { cycleId: c.id }, select: { score: true } }),
            tx.diagnosticResponse.findMany({ where: { cycleId: c.id }, select: { score: true } }),
          ]);
          const scores = [...psy, ...diag].map((r) => r.score);
          const respondentes = scores.length;
          const indiceMedio = scores.length
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
            : null;
          const adesao = convidados ? Math.round((respondidos / convidados) * 100) : 0;
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
            convidados,
            adesao,
            indiceMedio,
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
    // Tela 08 [3]: pina a versão de metodologia PSYCHOSOCIAL ativa na abertura do
    // ciclo (rastreabilidade/comparabilidade do score). Leitura owner (global).
    // rls-allow: methodologyVersion é config global (control-plane); a escrita do ciclo é forTenant().
    const activeMethodology = await this.prisma.admin.methodologyVersion.findFirst({
      where: { instrument: await resolvePsychosocialInstrument(this.prisma), status: 'ACTIVE' },
      select: { id: true },
    });
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
          methodologyVersionId: activeMethodology?.id ?? null,
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
    // 1) Lê pendentes + templates numa transação CURTA (sem I/O de rede).
    const prep = await this.prisma.forTenant(tenantId, async (tx) => {
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

      return { cycle, pendentes, bodyTemplate, subjectTemplate };
    });

    const markSent = () =>
      this.prisma.forTenant(tenantId, async (tx) =>
        tx.assessmentCycle.update({ where: { id: cycleId }, data: { reminderSentAt: new Date() } }),
      );

    // Gate do painel de Notificações (respeitado no momento do disparo) + push FCM.
    const emailOn = await this.notifications.isEnabled('icd.lembrete_campanha', 'email');
    const pushPayload = {
      title: 'Lembrete de campanha',
      body: `Você ainda não respondeu à campanha "${prep.cycle.name}".`,
      userIds: prep.pendentes.map((p) => p.id),
    };

    // E-mail desativado no painel, ou sem provider → não envia e-mail, mas
    // ainda dispara o push (se ligado) e marca o lembrete como processado.
    if (!emailOn || !mailConfigured()) {
      await markSent();
      await this.notifications.dispatchPush('icd.lembrete_campanha', pushPayload);
      return {
        sent: 0,
        pending: prep.pendentes.length,
        provider: emailOn ? 'stub' : 'disabled',
        reason: emailOn
          ? 'Sem provider de e-mail (SMTP_* ou RESEND_API_KEY) — operador deve enviar manualmente.'
          : 'Canal de e-mail deste gatilho desativado no painel de Notificações.',
      };
    }

    // 2) Envia os e-mails FORA de qualquer transação: I/O de rede lento (SMTP
    //    8–15s por envio) não pode segurar conexão do pool nem estourar o
    //    timeout de transação do Prisma (5s), que revertia o lote inteiro.
    let sent = 0;
    let provider = 'stub';
    for (const u of prep.pendentes) {
      const subject = prep.subjectTemplate.replaceAll('{campaign_name}', prep.cycle.name);
      const html = prep.bodyTemplate
        .replaceAll('{first_name}', u.name.split(' ')[0])
        .replaceAll('{campaign_name}', prep.cycle.name)
        .replaceAll('{description}', prep.cycle.description ?? 'Sua participação ajuda a empresa a entender o ambiente decisório.');
      // Best-effort: falha individual não interrompe o lote.
      const r = await sendMail({ to: u.email, subject, html });
      if (r.ok) sent += 1;
      provider = r.provider;
    }

    // 3) Marca reminderSentAt numa transação curta + dispara o push (FCM).
    await markSent();
    await this.notifications.dispatchPush('icd.lembrete_campanha', pushPayload);
    return { sent, pending: prep.pendentes.length, provider };
  }

  /**
   * A campanha só aceita resposta com o link público ligado, status OPEN e
   * dentro da janela. Centralizado aqui porque GET e POST precisam da MESMA
   * regra: se a leitura mostra o formulário, a escrita tem que aceitar.
   */
  /** Instrumento que ESTA campanha aplica — o do método contratado pela empresa.
   *  Fallback no psicossocial: é o comportamento histórico e o que todo tenant
   *  ORGANIZACIONAL já recebia. */
  private async campaignInstrument(tenantId: string): Promise<string> {
    return (await resolveInstrumentForTenant(this.prisma, tenantId)) ?? 'PSYCHOSOCIAL';
  }

  /** Perguntas da campanha no formato que a página pública já consome
   *  ({ id, dimension, text }). Para o psicossocial delega ao serviço dele, que
   *  tem o fallback embutido para quando não há metodologia publicada — assim o
   *  caminho de hoje não muda em nada. */
  private async campaignQuestions(tenantId: string) {
    const instrument = await this.campaignInstrument(tenantId);
    if (await usesPsychosocialEngine(this.prisma, instrument)) return this.psychosocial.publicQuestions();
    const active = await resolveActiveMethodology(this.prisma, instrument);
    if (!active) {
      throw new BadRequestException(
        'O diagnóstico desta campanha ainda não foi publicado no Motor. Fale com a CRIVO.',
      );
    }
    return active.config.questions.map((q, i) => ({
      id: i + 1,
      dimension: q.dimensionSlug,
      text: q.text,
    }));
  }

  private async resolveOpenCampaign(slug: string) {
    // rls-allow: endpoint público (sem tenantId no contexto); resolve campanha por slug, sem score individual.
    const cycle = await this.prisma.admin.assessmentCycle.findUnique({
      where: { publicSlug: slug },
      include: { org: { select: { name: true } } },
    });
    if (!cycle) throw new BadRequestException('Campanha não encontrada ou link inválido.');
    const agora = new Date();
    const foraDaJanela =
      (cycle.startsAt && agora < cycle.startsAt) || (cycle.endsAt && agora > cycle.endsAt);
    return { cycle, aberta: cycle.status === 'OPEN' && !foraDaJanela };
  }

  /**
   * Info pública por slug — SEM auth. Não vaza score/respondentes individuais.
   * Devolve TAMBÉM as perguntas quando a campanha está aberta: sem elas a página
   * pública não tinha o que renderizar e virava um cartão sem saída, mandando o
   * respondente "acessar com o seu login" — o oposto do que o link promete.
   */
  async getPublicBySlug(slug: string) {
    const { cycle, aberta } = await this.resolveOpenCampaign(slug);
    // A campanha aplica o diagnóstico do MÉTODO CONTRATADO pela empresa — não o
    // NR-1 por padrão. O instrumento estava FIXO aqui, então um tenant que
    // contratasse o Essencial recebia o questionário do Organizacional — e a
    // resposta caía noutra tabela, sem somar com a autoavaliação e o link do
    // colaborador, que sempre resolveram pelo contrato.
    const questions = aberta ? await this.campaignQuestions(cycle.tenantId) : [];
    return {
      name: cycle.name,
      description: cycle.description,
      sector: cycle.sector,
      status: cycle.status,
      startsAt: cycle.startsAt ? cycle.startsAt.toISOString() : null,
      endsAt: cycle.endsAt ? cycle.endsAt.toISOString() : null,
      tenantName: cycle.org.name,
      open: aberta,
      questions,
    };
  }

  /**
   * Submissão ANÔNIMA pela campanha. Grava em psychosocial_responses — a MESMA
   * tabela que o portal agrega em /psychosocial/results. Um caminho de coleta
   * próprio criaria resposta órfã: o time responderia e nada apareceria no
   * Dashboard. O setor vem da campanha (o respondente não escolhe).
   */
  async submitPublicByCampaignSlug(slug: string, dto: SubmitPsychosocialDto) {
    const { cycle, aberta } = await this.resolveOpenCampaign(slug);
    if (!aberta) {
      throw new BadRequestException('Esta campanha não está aberta para respostas no momento.');
    }
    const instrument = await this.campaignInstrument(cycle.tenantId);
    const payload = { ...dto, sector: cycle.sector ?? dto.sector };
    // Mesmo par de destinos do link do colaborador: psicossocial grava em
    // psychosocial_responses; qualquer outro instrumento, em diagnostic_responses.
    // Os dois devolvem { ok, result }, então a página pública não muda.
    // A resposta pertence à campanha — inclusive quem entrou pelo link público
    // dela, que não passa por convite nominal.
    return (await usesPsychosocialEngine(this.prisma, instrument))
      ? this.psychosocial.submit(cycle.tenantId, payload, undefined, cycle.id)
      : this.diagnostics.submitForTenant(cycle.tenantId, instrument, payload, undefined, cycle.id);
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
