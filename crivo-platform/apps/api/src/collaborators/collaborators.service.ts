import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { isValidCpf, normalizeCpf, formatCpf } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
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
  ) {}

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

  private async loadOwn(tenantId: string, id: string): Promise<CollaboratorRow> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const c = await tx.collaborator.findUnique({ where: { id } });
      if (!c || c.tenantId !== tenantId) throw new NotFoundException('Colaborador não encontrado.');
      return c as CollaboratorRow;
    });
  }

  async sendEmailInvite(tenantId: string, id: string) {
    const c = await this.loadOwn(tenantId, id);
    if (!c.email) throw new BadRequestException('Colaborador sem e-mail cadastrado.');
    if (!mailConfigured()) throw new BadRequestException('Envio de e-mail não está configurado.');
    const url = linkFor(c.token);
    const html = `
      <p>Olá, ${esc(c.name)}.</p>
      <p>Você foi convidado(a) a responder o diagnóstico da sua empresa na plataforma CRIVO™.</p>
      <p><a href="${url}">Clique aqui para responder</a> — é rápido e as respostas são tratadas de forma anônima e agregada.</p>
      <p>Se o botão não funcionar, copie e cole no navegador:<br>${url}</p>`;
    const res = await sendMail({ to: c.email, subject: 'Responda o diagnóstico da sua empresa — CRIVO™', html });
    if (!res.ok) throw new BadRequestException('Não foi possível enviar o e-mail agora.');
    await this.prisma.forTenant(tenantId, (tx) =>
      tx.collaborator.update({ where: { id }, data: { inviteEmailAt: new Date() } }),
    );
    return { ok: true as const, provider: res.provider };
  }

  async sendWhatsappInvite(tenantId: string, id: string) {
    const c = await this.loadOwn(tenantId, id);
    if (!c.phone) throw new BadRequestException('Colaborador sem telefone cadastrado.');
    if (!whatsappConfigured()) throw new BadRequestException('Envio por WhatsApp não está configurado.');
    const url = linkFor(c.token);
    const message = `Olá, ${c.name}! Você foi convidado(a) a responder o diagnóstico da sua empresa na CRIVO™. Responda aqui: ${url}`;
    const res = await sendWhatsapp({ to: c.phone, message, name: c.name });
    if (!res.ok) throw new BadRequestException('Não foi possível enviar o WhatsApp agora.');
    await this.prisma.forTenant(tenantId, (tx) =>
      tx.collaborator.update({ where: { id }, data: { inviteWhatsappAt: new Date() } }),
    );
    return { ok: true as const, provider: res.provider };
  }

  // ── Fluxo público por token (o funcionário abre o link) ────────────────────

  /** Resolve token → colaborador (sem expor dados pessoais antes do CPF). */
  private async byToken(token: string): Promise<CollaboratorRow> {
    // rls-allow: endpoint público (/r/<token>); resolve token→colaborador (o token
    // de 128 bits é a credencial). Nenhuma escrita aqui.
    const c = await this.prisma.admin.collaborator.findUnique({ where: { token } });
    if (!c) throw new NotFoundException('Link inválido ou expirado.');
    return c as CollaboratorRow;
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
    const c = await this.byToken(token);
    return { tenantName: await this.tenantName(c.tenantId), answered: !!c.respondedAt };
  }

  /** Etapa 1 — valida CPF e libera as perguntas. */
  async verify(token: string, cpf: string) {
    const c = await this.byToken(token);
    if (normalizeCpf(cpf) !== c.cpf) throw new BadRequestException('CPF não confere com o cadastro.');
    if (c.respondedAt) return { answered: true as const };
    return {
      answered: false as const,
      name: c.name,
      sector: c.sector,
      tenantName: await this.tenantName(c.tenantId),
      questions: await this.psychosocial.publicQuestions(),
    };
  }

  /** Etapa 2 — grava a resposta ANÔNIMA e marca participação atomicamente. */
  async submit(token: string, dto: SubmitByTokenDto) {
    const c = await this.byToken(token);
    if (normalizeCpf(dto.cpf) !== c.cpf) throw new BadRequestException('CPF não confere com o cadastro.');
    if (c.respondedAt) throw new ConflictException('Você já respondeu este diagnóstico.');
    // O setor é o do CADASTRO (não do cliente). O hook marca respondedAt na mesma
    // transação do create da resposta — count!==1 significa que já respondeu (corrida).
    return this.psychosocial.submit(
      c.tenantId,
      { sector: c.sector ?? undefined, answers: dto.answers },
      async (tx) => {
        const r = await tx.collaborator.updateMany({
          where: { id: c.id, respondedAt: null },
          data: { respondedAt: new Date() },
        });
        if (r.count !== 1) throw new ConflictException('Você já respondeu este diagnóstico.');
      },
    );
  }
}
