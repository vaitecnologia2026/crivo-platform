import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DEFAULT_SCALE_LABELS, isValidCpf, normalizeCpf, formatCpf } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import {
  resolveActiveMethodology,
  resolveInstrumentForTenant,
  usesPsychosocialEngine,
} from '../admin/methodology.service';
import { mailConfigured, sendMail } from '../common/mailer';
import { whatsappConfigured, sendWhatsapp } from '../common/whatsapp';
import { CreateCollaboratorDto, SubmitByTokenDto, UpdateCollaboratorDto } from './dto';

type CollaboratorRow = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  sector: string | null;
  email: string | null;
  cpf: string;
  token: string;
  inviteEmailAt: Date | null;
  inviteWhatsappAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
};

/** Convite de um colaborador para UMA campanha — dono do token do link. */
type InviteRow = {
  id: string;
  tenantId: string;
  cycleId: string;
  collaboratorId: string;
  token: string;
  respondedAt: Date | null;
};

const portalUrl = (): string => process.env.PORTAL_URL ?? 'https://app.crivolegacy.com.br';
const linkFor = (token: string): string => `${portalUrl()}/r/${token}`;
/** ***.***.789-09 — esconde os 6 primeiros dígitos na listagem do portal. */
const maskCpf = (cpf: string): string => {
  const f = formatCpf(cpf);
  return f.length === 14 ? `***.***.${f.slice(8)}` : '***';
};
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class CollaboratorsService {
  private readonly log = new Logger('Collaborators');
  constructor(
    private readonly prisma: PrismaService,
    private readonly psychosocial: PsychosocialService,
    private readonly diagnostics: DiagnosticsService,
  ) {}

  /**
   * Qual diagnóstico este colaborador vai responder. Espelha BUILTIN_BY_METHOD
   * (me.controller): quem contratou ESSENCIAL/INICIAL responde o Diagnóstico
   * Executivo (PRE_DIAGNOSTIC); ORGANIZACIONAL responde o psicossocial. A
   * solução contratada manda — o `contract.method` é só fallback legado.
   */
  private async instrumentFor(tenantId: string): Promise<string> {
    // A cascata contrato→produto→método→instrumento vive em UM lugar
    // (resolveInstrumentForTenant): a autoavaliação do Essencial e a campanha
    // pública resolvem pela mesma função. Fallback histórico daqui: psicossocial.
    return (await resolveInstrumentForTenant(this.prisma, tenantId)) ?? 'PSYCHOSOCIAL';
  }

  private view(c: CollaboratorRow) {
    const status = c.respondedAt
      ? 'responded'
      : c.inviteEmailAt || c.inviteWhatsappAt
        ? 'invited'
        : 'pending';
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      sector: c.sector,
      email: c.email,
      cpfMasked: maskCpf(c.cpf),
      link: linkFor(c.token),
      status,
      inviteEmailAt: c.inviteEmailAt,
      inviteWhatsappAt: c.inviteWhatsappAt,
      respondedAt: c.respondedAt,
      createdAt: c.createdAt,
    };
  }

  async list(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.collaborator.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((r) => this.view(r as CollaboratorRow));
    });
  }

  private newToken(): string {
    return randomBytes(16).toString('hex'); // 128 bits
  }

  async create(tenantId: string, dto: CreateCollaboratorDto) {
    const cpf = normalizeCpf(dto.cpf);
    if (!isValidCpf(cpf)) throw new BadRequestException('CPF inválido.');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const exists = await tx.collaborator.findFirst({ where: { cpf }, select: { id: true } });
      if (exists) throw new ConflictException('Já existe um colaborador com este CPF.');
      const c = await tx.collaborator.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          sector: dto.sector?.trim() || null,
          email: dto.email?.trim() || null,
          cpf,
          token: this.newToken(),
        },
      });
      return this.view(c as CollaboratorRow);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCollaboratorDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cur = await tx.collaborator.findUnique({ where: { id } });
      if (!cur || cur.tenantId !== tenantId) throw new NotFoundException('Colaborador não encontrado.');
      let cpf = cur.cpf;
      if (dto.cpf !== undefined) {
        cpf = normalizeCpf(dto.cpf);
        if (!isValidCpf(cpf)) throw new BadRequestException('CPF inválido.');
        if (cpf !== cur.cpf) {
          const dup = await tx.collaborator.findFirst({ where: { cpf, id: { not: id } }, select: { id: true } });
          if (dup) throw new ConflictException('Já existe um colaborador com este CPF.');
        }
      }
      const c = await tx.collaborator.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
          ...(dto.sector !== undefined ? { sector: dto.sector.trim() || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
          cpf,
        },
      });
      return this.view(c as CollaboratorRow);
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cur = await tx.collaborator.findUnique({ where: { id }, select: { tenantId: true } });
      if (!cur || cur.tenantId !== tenantId) throw new NotFoundException('Colaborador não encontrado.');
      await tx.collaborator.delete({ where: { id } });
      return { ok: true as const };
    });
  }

  /** Importação em lote: valida linha a linha, pula CPF inválido/duplicado. */
  async importMany(tenantId: string, rows: CreateCollaboratorDto[]) {
    const errors: { line: number; reason: string }[] = [];
    let created = 0;
    const seenInBatch = new Set<string>();
    await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = new Set(
        (await tx.collaborator.findMany({ select: { cpf: true } })).map((c) => c.cpf),
      );
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 1;
        if (!r.name?.trim()) { errors.push({ line, reason: 'Nome vazio' }); continue; }
        const cpf = normalizeCpf(r.cpf);
        if (!isValidCpf(cpf)) { errors.push({ line, reason: `CPF inválido (${r.cpf ?? ''})` }); continue; }
        if (existing.has(cpf) || seenInBatch.has(cpf)) { errors.push({ line, reason: 'CPF duplicado' }); continue; }
        seenInBatch.add(cpf);
        await tx.collaborator.create({
          data: {
            tenantId,
            name: r.name.trim(),
            phone: r.phone?.trim() || null,
            sector: r.sector?.trim() || null,
            email: r.email?.trim() || null,
            cpf,
            token: this.newToken(),
          },
        });
        created++;
      }
    });
    return { created, errors };
  }

  /**
   * Convite do colaborador NAQUELA campanha (cria na primeira vez).
   *
   * O envio ao colaborador passa a acontecer sempre dentro de uma campanha: antes
   * o e-mail saía apenas por existir cadastro importado e a resposta não
   * pertencia a ciclo nenhum, então a tela de campanhas não tinha como medir
   * adesão nem evolução. Um convite por (ciclo, colaborador), com token próprio —
   * a mesma pessoa pode ser convidada de novo em outra campanha sem apagar o
   * histórico da anterior.
   */
  private async ensureInvite(tenantId: string, collaboratorId: string, cycleId: string): Promise<InviteRow> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.assessmentCycle.findUnique({ where: { id: cycleId } });
      if (!cycle || cycle.tenantId !== tenantId) {
        throw new NotFoundException('Campanha não encontrada.');
      }
      if (cycle.status !== 'OPEN') {
        throw new BadRequestException('Esta campanha não está aberta para novos convites.');
      }
      const existing = await tx.campaignInvite.findUnique({
        where: { cycleId_collaboratorId: { cycleId, collaboratorId } },
      });
      if (existing) return existing as InviteRow;
      const created = await tx.campaignInvite.create({
        data: { tenantId, cycleId, collaboratorId, token: this.newToken() },
      });
      return created as InviteRow;
    });
  }

  private async loadOwn(tenantId: string, id: string): Promise<CollaboratorRow> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const c = await tx.collaborator.findUnique({ where: { id } });
      if (!c || c.tenantId !== tenantId) throw new NotFoundException('Colaborador não encontrado.');
      return c as CollaboratorRow;
    });
  }

  async sendEmailInvite(tenantId: string, id: string, cycleId: string) {
    const c = await this.loadOwn(tenantId, id);
    if (!c.email) throw new BadRequestException('Colaborador sem e-mail cadastrado.');
    if (!mailConfigured()) throw new BadRequestException('Envio de e-mail não está configurado.');
    const invite = await this.ensureInvite(tenantId, id, cycleId);
    const url = linkFor(invite.token);
    const html = `
      <p>Olá, ${esc(c.name)}.</p>
      <p>Você foi convidado(a) a responder o diagnóstico da sua empresa na plataforma CRIVO™.</p>
      <p><a href="${url}">Clique aqui para responder</a> — é rápido e as respostas são tratadas de forma anônima e agregada.</p>
      <p>Se o botão não funcionar, copie e cole no navegador:<br>${url}</p>`;
    const res = await sendMail({ to: c.email, subject: 'Responda o diagnóstico da sua empresa — CRIVO™', html });
    if (!res.ok) throw new BadRequestException('Não foi possível enviar o e-mail agora.');
    const agora = new Date();
    await this.prisma.forTenant(tenantId, async (tx) => {
      await tx.campaignInvite.update({ where: { id: invite.id }, data: { sentEmailAt: agora } });
      // A coluna do colaborador segue como "último convite", que é o que a
      // listagem mostra na coluna Status.
      await tx.collaborator.update({ where: { id }, data: { inviteEmailAt: agora } });
    });
    return { ok: true as const, provider: res.provider };
  }

  async sendWhatsappInvite(tenantId: string, id: string, cycleId: string) {
    const c = await this.loadOwn(tenantId, id);
    if (!c.phone) throw new BadRequestException('Colaborador sem telefone cadastrado.');
    if (!whatsappConfigured()) throw new BadRequestException('Envio por WhatsApp não está configurado.');
    const invite = await this.ensureInvite(tenantId, id, cycleId);
    const url = linkFor(invite.token);
    const message = `Olá, ${c.name}! Você foi convidado(a) a responder o diagnóstico da sua empresa na CRIVO™. Responda aqui: ${url}`;
    const res = await sendWhatsapp({ to: c.phone, message, name: c.name });
    if (!res.ok) throw new BadRequestException('Não foi possível enviar o WhatsApp agora.');
    const agora = new Date();
    await this.prisma.forTenant(tenantId, async (tx) => {
      await tx.campaignInvite.update({ where: { id: invite.id }, data: { sentWhatsappAt: agora } });
      await tx.collaborator.update({ where: { id }, data: { inviteWhatsappAt: agora } });
    });
    return { ok: true as const, provider: res.provider };
  }

  /**
   * Participantes de UMA campanha: todo o cadastro, com o status DAQUELE ciclo.
   *
   * A ação de convidar mora aqui porque é o cadastro que ela consome, mas quem
   * pergunta é a tela da Campanha — é lá que faz sentido ver quem já foi
   * chamado, quem respondeu e quem falta.
   */
  async participants(tenantId: string, cycleId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const cycle = await tx.assessmentCycle.findUnique({ where: { id: cycleId } });
      if (!cycle || cycle.tenantId !== tenantId) throw new NotFoundException('Campanha não encontrada.');
      const [colabs, invites] = await Promise.all([
        tx.collaborator.findMany({ orderBy: { name: 'asc' } }),
        tx.campaignInvite.findMany({ where: { cycleId } }),
      ]);
      const porColaborador = new Map(invites.map((i) => [i.collaboratorId, i]));
      return {
        cycle: { id: cycle.id, name: cycle.name, sector: cycle.sector, status: cycle.status },
        participants: colabs.map((c) => {
          const inv = porColaborador.get(c.id);
          return {
            id: c.id,
            name: c.name,
            sector: c.sector,
            email: c.email,
            phone: c.phone,
            // Status DESTA campanha — não a última atividade da pessoa.
            status: inv?.respondedAt ? 'respondeu' : inv ? 'convidado' : 'pendente',
            sentEmailAt: inv?.sentEmailAt ?? null,
            sentWhatsappAt: inv?.sentWhatsappAt ?? null,
            respondedAt: inv?.respondedAt ?? null,
            link: inv ? linkFor(inv.token) : null,
          };
        }),
      };
    });
  }

  /**
   * Convite em LOTE por e-mail. Sem `ids`, convida todo o cadastro que ainda não
   * foi convidado nesta campanha. Quem não tem e-mail entra em `erros` — o lote
   * não para por causa de um cadastro incompleto.
   */
  async inviteMany(tenantId: string, cycleId: string, ids?: string[]) {
    const { participants } = await this.participants(tenantId, cycleId);
    const alvo = participants.filter(
      (p) => (ids ? ids.includes(p.id) : p.status === 'pendente') && p.status !== 'respondeu',
    );
    let enviados = 0;
    const erros: { name: string; reason: string }[] = [];
    for (const p of alvo) {
      if (!p.email) {
        erros.push({ name: p.name, reason: 'sem e-mail cadastrado' });
        continue;
      }
      try {
        await this.sendEmailInvite(tenantId, p.id, cycleId);
        enviados++;
      } catch (e) {
        erros.push({ name: p.name, reason: e instanceof Error ? e.message : 'falha no envio' });
      }
    }
    return { enviados, erros, total: alvo.length };
  }

  /**
   * Link do convite daquele colaborador NAQUELA campanha (cria se ainda não
   * existe). Serve o botão "Copiar link" da tela.
   *
   * Antes o botão copiava o token do próprio colaborador, que responde FORA de
   * qualquer campanha: exigir campanha no e-mail e deixar o link livre no botão
   * ao lado anulava a regra — a resposta entrava no agregado da empresa sem
   * pertencer a ciclo nenhum.
   */
  async inviteLink(tenantId: string, id: string, cycleId: string) {
    await this.loadOwn(tenantId, id);
    const invite = await this.ensureInvite(tenantId, id, cycleId);
    return { link: linkFor(invite.token) };
  }

  /**
   * CPF → colaborador + convite DAQUELA campanha (cria o convite se não houver).
   *
   * É o que transforma o QR/link aberto da campanha em coleta nominal: um código
   * só para todo mundo, mas cada pessoa se identifica pelo CPF do cadastro e
   * responde UMA vez por campanha. Antes o link aberto não pedia nada — dava
   * para responder de novo e inflar a média (e o piso de anonimato conta
   * PESSOAS, não envios).
   */
  async resolveForCampaign(tenantId: string, cycleId: string, cpf: string) {
    const normalizado = normalizeCpf(cpf);
    if (!isValidCpf(normalizado)) throw new BadRequestException('CPF inválido.');
    const c = await this.prisma.forTenant(tenantId, (tx) =>
      tx.collaborator.findFirst({ where: { cpf: normalizado } }),
    );
    if (!c) {
      throw new NotFoundException(
        'CPF não encontrado no cadastro desta empresa. Fale com o RH para ser incluído.',
      );
    }
    const invite = await this.ensureInvite(tenantId, c.id, cycleId);
    return { collaborator: c as CollaboratorRow, invite };
  }

  /**
   * Hook que marca a participação NA MESMA transação do create da resposta:
   * ou grava os dois, ou nenhum. A resposta segue sem identificador nenhum.
   */
  hookDeParticipacao(inviteId: string, collaboratorId: string) {
    return async (tx: Parameters<Parameters<PrismaService['forTenant']>[1]>[0]) => {
      const agora = new Date();
      const r = await tx.campaignInvite.updateMany({
        where: { id: inviteId, respondedAt: null },
        data: { respondedAt: agora },
      });
      if (r.count !== 1) throw new ConflictException('Você já respondeu esta campanha.');
      await tx.collaborator.update({ where: { id: collaboratorId }, data: { respondedAt: agora } });
    };
  }

  // ── Fluxo público por token (o funcionário abre o link) ────────────────────

  /**
   * Resolve token → colaborador + convite (sem expor dados pessoais antes do CPF).
   *
   * O token novo é o do CONVITE (um por campanha). O token antigo, do próprio
   * colaborador, continua resolvendo: links já enviados antes desta mudança não
   * podem morrer — eles simplesmente não pertencem a campanha nenhuma.
   */
  private async byToken(token: string): Promise<{ c: CollaboratorRow; invite: InviteRow | null }> {
    // Endpoint público (/r/<token>): o token de 128 bits é a credencial.
    // rls-allow: resolve token→convite/colaborador sem tenant no contexto; leitura.
    const invite = await this.prisma.admin.campaignInvite.findUnique({
      where: { token },
      include: { collaborator: true },
    });
    if (invite) {
      const { collaborator, ...rest } = invite;
      return { c: collaborator as CollaboratorRow, invite: rest as InviteRow };
    }
    // rls-allow: mesmo endpoint público — compatibilidade com o link antigo.
    const c = await this.prisma.admin.collaborator.findUnique({ where: { token } });
    if (!c) throw new NotFoundException('Link inválido ou expirado.');
    return { c: c as CollaboratorRow, invite: null };
  }

  private async tenantName(tenantId: string): Promise<string> {
    // rls-allow: nome público da empresa para a tela do link.
    const org = await this.prisma.admin.organization.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return org?.name ?? 'sua empresa';
  }

  /** Etapa 0 — sem CPF ainda: só diz de quem é o link e se já respondeu. */
  async publicInfo(token: string) {
    const { c, invite } = await this.byToken(token);
    // "Já respondeu" é POR CAMPANHA: quem participou do ciclo anterior pode (e
    // deve) responder o próximo — é assim que a evolução por ciclo existe.
    const respondeu = invite ? !!invite.respondedAt : !!c.respondedAt;
    return { tenantName: await this.tenantName(c.tenantId), answered: respondeu };
  }

  /** Etapa 1 — valida CPF e libera as perguntas. */
  async verify(token: string, cpf: string) {
    const { c, invite } = await this.byToken(token);
    if (normalizeCpf(cpf) !== c.cpf) throw new BadRequestException('CPF não confere com o cadastro.');
    if (invite ? invite.respondedAt : c.respondedAt) return { answered: true as const };
    return {
      answered: false as const,
      name: c.name,
      sector: c.sector,
      tenantName: await this.tenantName(c.tenantId),
      questions: await this.questionsFor(c.tenantId),
      scaleLabels: await this.scaleLabelsFor(c.tenantId),
    };
  }

  /** Rótulos da escala do diagnóstico contratado (fallback ao padrão). */
  private async scaleLabelsFor(tenantId: string): Promise<string[]> {
    const instrument = await this.instrumentFor(tenantId);
    if (await usesPsychosocialEngine(this.prisma, instrument)) {
      return this.psychosocial.publicScaleLabels();
    }
    const active = await resolveActiveMethodology(this.prisma, instrument);
    const labels = active?.config.scaleLabels ?? [];
    return labels.length === 5 ? labels : [...DEFAULT_SCALE_LABELS];
  }

  /** Perguntas do diagnóstico que a empresa contratou (Essencial ou NR-1). */
  private async questionsFor(tenantId: string) {
    const instrument = await this.instrumentFor(tenantId);
    if (await usesPsychosocialEngine(this.prisma, instrument)) return this.psychosocial.publicQuestions();
    const active = await resolveActiveMethodology(this.prisma, instrument);
    if (!active) throw new NotFoundException('Este diagnóstico ainda não está disponível.');
    return active.config.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text }));
  }

  /** Etapa 2 — grava a resposta ANÔNIMA e marca participação atomicamente. */
  async submit(token: string, dto: SubmitByTokenDto) {
    const { c, invite } = await this.byToken(token);
    if (normalizeCpf(dto.cpf) !== c.cpf) throw new BadRequestException('CPF não confere com o cadastro.');
    if (invite ? invite.respondedAt : c.respondedAt) {
      throw new ConflictException('Você já respondeu este diagnóstico.');
    }
    // O setor é o do CADASTRO (não do cliente). O hook marca respondedAt na mesma
    // transação do create da resposta — count!==1 significa que já respondeu (corrida).
    const marcarParticipacao = async (tx: Parameters<Parameters<PrismaService['forTenant']>[1]>[0]) => {
      const agora = new Date();
      if (invite) {
        // Gate atômico NA CAMPANHA: é o convite que decide "já respondeu".
        const r = await tx.campaignInvite.updateMany({
          where: { id: invite.id, respondedAt: null },
          data: { respondedAt: agora },
        });
        if (r.count !== 1) throw new ConflictException('Você já respondeu este diagnóstico.');
        // No colaborador a marca é "última participação" — alimenta a coluna
        // Status da listagem e não bloqueia campanhas futuras.
        await tx.collaborator.update({ where: { id: c.id }, data: { respondedAt: agora } });
        return;
      }
      const r = await tx.collaborator.updateMany({
        where: { id: c.id, respondedAt: null },
        data: { respondedAt: agora },
      });
      if (r.count !== 1) throw new ConflictException('Você já respondeu este diagnóstico.');
    };
    const instrument = await this.instrumentFor(c.tenantId);
    const payload = { sector: c.sector ?? undefined, answers: dto.answers };
    // Cada método responde o SEU diagnóstico: Essencial → Diagnóstico Executivo
    // (diagnostic_responses); Organizacional → psicossocial. Nos dois casos a
    // resposta é anônima e a participação é marcada na mesma transação.
    // A resposta carrega a campanha: é o que liga a coleta ao ciclo e faz a
    // adesão/evolução da tela de campanhas medir o diagnóstico de verdade.
    const cycleId = invite?.cycleId ?? null;
    return (await usesPsychosocialEngine(this.prisma, instrument))
      ? this.psychosocial.submit(c.tenantId, payload, marcarParticipacao, cycleId)
      : this.diagnostics.submitForTenant(c.tenantId, instrument, payload, marcarParticipacao, cycleId);
  }
}
