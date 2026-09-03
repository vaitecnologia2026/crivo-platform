import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { mailConfigured, sendMail } from '../common/mailer';

/** Janela do link. Curta o bastante para limitar estrago, longa o bastante
 *  para quem só abre o e-mail no fim do expediente. */
const TTL_MIN = 60;

/** Teto de contas listadas no e-mail. Existem e-mails com 10 contas no banco
 *  (duplicatas legadas, anteriores à regra de e-mail único); acima disso o
 *  e-mail viraria uma lista ilegível e o caso é de suporte mesmo. */
const MAX_CONTAS = 10;

const portalUrl = (): string =>
  (process.env.PORTAL_URL ?? 'https://app.crivolegacy.com.br').replace(/\/+$/, '');

/** sha256 hex. O banco guarda só isto — o token em claro só existe no e-mail. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Recuperação de senha do portal, em autoatendimento.
 *
 * Antes, "Esqueci minha senha" abria o WhatsApp do suporte: a redefinição era
 * manual, dependia de alguém estar disponível e não deixava registro. Aqui o
 * usuário confirma o e-mail, recebe um link de USO ÚNICO com validade curta e
 * escolhe a senha nova — a CRIVO nunca vê a senha.
 *
 * Três cuidados que valem explicar:
 *
 * 1. ANTI-ENUMERAÇÃO. `request()` responde a mesma coisa existindo ou não a
 *    conta. Se respondesse "e-mail não cadastrado", a tela de login viraria um
 *    verificador de quem é cliente da CRIVO.
 *
 * 2. E-MAIL NÃO É ÚNICO na plataforma (`users` tem @@unique([tenantId, email])).
 *    A mesma pessoa pode ter conta em várias empresas — e o login desempata pela
 *    senha. Por isso o token é por USUÁRIO e o e-mail lista uma opção por
 *    empresa: quem controla a caixa é dono de todas elas, então nada vaza, e a
 *    pessoa vê exatamente qual senha está trocando.
 *
 * 3. O E-MAIL NÃO PASSA PELO PAINEL DE NOTIFICAÇÕES de propósito. Aquele painel
 *    liga/desliga avisos comerciais; um toggle de UI não pode trancar ninguém
 *    para fora da própria conta.
 */
@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name);

  /** Mesma mensagem para token inexistente, expirado ou já usado: quem tenta
   *  adivinhar não aprende em qual dos três casos caiu. */
  private readonly INVALIDO = 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Passo 1 — a pessoa confirma o e-mail. Sempre `{ ok: true }`: quem está de
   * fora não descobre se a conta existe.
   */
  async request(email: string): Promise<{ ok: true }> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return { ok: true as const };

    // rls-allow: recuperação é PÚBLICA (sem sessão, sem tenant no contexto) e
    // cross-tenant por e-mail, igual ao login.
    const users = await this.prisma.admin.user.findMany({
      where: { email: normalized, active: true },
      select: { id: true, tenantId: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTAS,
    });

    if (!users.length) {
      // Log serve para o suporte distinguir "não chegou o e-mail" de "não existe
      // conta" sem que a TELA revele isso a quem pediu.
      this.log.warn(`Recuperação de senha pedida para e-mail sem conta ativa: ${normalized}`);
      return { ok: true as const };
    }

    if (!mailConfigured()) {
      this.log.error(
        `Recuperação de senha para ${normalized} NÃO enviada: nenhum provedor de e-mail configurado.`,
      );
      return { ok: true as const };
    }

    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);
    const opcoes: { company: string; url: string }[] = [];

    for (const u of users) {
      // Pedir de novo invalida os links anteriores daquela conta: sempre existe
      // no máximo UM link válido por usuário.
      // rls-allow: fluxo público de recuperação, escopado pelo userId resolvido.
      await this.prisma.admin.passwordResetToken.updateMany({
        where: { userId: u.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = randomBytes(32).toString('hex');
      // rls-allow: fluxo público de recuperação (sem sessão para setar o tenant).
      await this.prisma.admin.passwordResetToken.create({
        data: { tenantId: u.tenantId, userId: u.id, tokenHash: hash(token), expiresAt },
      });

      // rls-allow: nome da empresa do próprio usuário resolvido acima.
      const org = await this.prisma.admin.organization.findUnique({
        where: { id: u.tenantId },
        select: { name: true },
      });
      opcoes.push({
        company: org?.name ?? 'Sua empresa',
        url: `${portalUrl()}/nova-senha?t=${token}`,
      });
    }

    const res = await sendMail({
      to: normalized,
      subject: 'Redefinir sua senha · CRIVO',
      html: this.renderHtml(users[0]?.name ?? '', opcoes),
      text: this.renderText(opcoes),
    });

    if (res.ok) {
      this.log.log(
        `Link de redefinição enviado a ${normalized} (${opcoes.length} conta(s), via ${res.provider}).`,
      );
    } else {
      this.log.error(`Falha ao enviar redefinição a ${normalized}: ${res.reason ?? 'sem motivo'}`);
    }
    return { ok: true as const };
  }

  /**
   * Passo 2 — a tela abre o link e mostra de quem/qual empresa é a conta, para a
   * pessoa saber o que está trocando antes de digitar.
   */
  async verify(token: string): Promise<{ email: string; name: string; company: string }> {
    const row = await this.load(token);
    // rls-allow: fluxo público de recuperação, escopado pelo token.
    const user = await this.prisma.admin.user.findUnique({
      where: { id: row.userId },
      select: { email: true, name: true, tenantId: true, active: true },
    });
    if (!user || !user.active) throw new BadRequestException(this.INVALIDO);
    // rls-allow: empresa do usuário do próprio token.
    const org = await this.prisma.admin.organization.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });
    return { email: user.email, name: user.name, company: org?.name ?? 'Sua empresa' };
  }

  /** Passo 3 — grava a senha nova e derruba as sessões abertas daquela conta. */
  async confirm(token: string, newPassword: string): Promise<{ ok: true }> {
    const row = await this.load(token);
    // rls-allow: fluxo público de recuperação, escopado pelo token já validado.
    const user = await this.prisma.admin.user.findUnique({
      where: { id: row.userId },
      select: { id: true, active: true },
    });
    if (!user || !user.active) throw new BadRequestException(this.INVALIDO);

    // rls-allow: redefinição pelo token (a própria credencial do fluxo).
    await this.prisma.admin.user.update({
      where: { id: user.id },
      data: {
        passwordHash: bcrypt.hashSync(newPassword, 12),
        // Derruba TODAS as sessões abertas: se alguém entrou com a senha antiga,
        // perde o acesso agora — não no próximo login.
        tokenVersion: { increment: 1 },
        // Quem redefiniu foi o próprio dono da conta (link no e-mail dele): a
        // senha deixa de ser de primeiro acesso.
        mustChangePassword: false,
      },
    });
    // Uso único, e qualquer outro link pendente da mesma conta morre junto.
    // rls-allow: fluxo público de recuperação, escopado pelo userId do token.
    await this.prisma.admin.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    this.log.log(`Senha redefinida por link de recuperação (usuário ${user.id}).`);
    return { ok: true as const };
  }

  private async load(token: string): Promise<{ userId: string }> {
    const t = (token ?? '').trim();
    if (!t) throw new BadRequestException(this.INVALIDO);
    // rls-allow: resolução PÚBLICA do token de recuperação (sem sessão).
    const row = await this.prisma.admin.passwordResetToken.findUnique({
      where: { tokenHash: hash(t) },
      select: { userId: true, expiresAt: true, usedAt: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(this.INVALIDO);
    }
    return { userId: row.userId };
  }

  private renderHtml(name: string, opcoes: { company: string; url: string }[]): string {
    const saudacao = name ? `Olá, ${esc(name.split(' ')[0])}.` : 'Olá.';
    const varias = opcoes.length > 1;
    const botoes = opcoes
      .map(
        (o) => `
        <p style="margin:0 0 12px">
          <a href="${o.url}"
             style="display:inline-block;background:#C4894A;color:#0E1420;text-decoration:none;
                    font-weight:600;padding:12px 22px;border-radius:8px">
            Definir nova senha${varias ? ` — ${esc(o.company)}` : ''}
          </a>
        </p>`,
      )
      .join('');
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;
                  max-width:560px;margin:0 auto;line-height:1.55">
        <h2 style="color:#0E1420;margin:0 0 12px">Redefinir sua senha</h2>
        <p>${saudacao}</p>
        <p>Recebemos um pedido para redefinir a senha de acesso ao portal CRIVO.
           ${
             varias
               ? 'Seu e-mail tem acesso a mais de uma empresa — escolha qual senha quer trocar:'
               : 'Clique no botão abaixo para escolher a nova senha:'
           }</p>
        ${botoes}
        <p style="color:#555;font-size:13px">
          O link vale por ${TTL_MIN} minutos e só pode ser usado uma vez.
        </p>
        <p style="color:#555;font-size:13px">
          <strong>Não foi você?</strong> Ignore este e-mail — sua senha atual continua valendo
          e nada foi alterado.
        </p>
      </div>`;
  }

  private renderText(opcoes: { company: string; url: string }[]): string {
    const linhas = opcoes.map((o) => `${o.company}: ${o.url}`).join('\n');
    return [
      'Redefinir sua senha — CRIVO',
      '',
      'Recebemos um pedido para redefinir a senha de acesso ao portal.',
      opcoes.length > 1
        ? 'Seu e-mail tem acesso a mais de uma empresa; escolha o link da empresa certa:'
        : 'Abra o link abaixo para escolher a nova senha:',
      '',
      linhas,
      '',
      `O link vale por ${TTL_MIN} minutos e só pode ser usado uma vez.`,
      'Não foi você? Ignore este e-mail: sua senha atual continua valendo.',
    ].join('\n');
  }
}
