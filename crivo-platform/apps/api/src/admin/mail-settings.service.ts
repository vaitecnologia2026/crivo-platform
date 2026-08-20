import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { MailSettingsData } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { decryptSecret, encryptSecret, hintOf } from './secret-crypto';
import { setMailOverride, verifySmtp } from '../common/mailer';

/** Linha do banco, como o Prisma devolve. */
type Row = {
  id: string;
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string | null;
  fromEmail: string;
  passwordEnc: string;
  passwordIv: string;
  passwordTag: string;
  passwordHint: string;
  updatedAt: Date;
};

/** Remetente montado: "Nome <endereco>" quando há nome, senão só o endereço. */
function buildFrom(fromName: string | null, fromEmail: string): string {
  const name = fromName?.trim();
  return name ? `${name} <${fromEmail}>` : fromEmail;
}

/**
 * Conta de e-mail que dispara as mensagens da plataforma (Governança · E-mail
 * de envio).
 *
 * As três mensagens que saem por aqui hoje: a SENHA de acesso do cliente
 * (platform-leads · sendAccess), o Relatório Preliminar com o E-BOOK em anexo
 * (preliminary-reports) e o convite de campanha do ICD. Todas passam pelo mesmo
 * transporte do `common/mailer` — configurar aqui vale para as três.
 *
 * Enquanto não houver conta salva E ativa, `setMailOverride(null)` mantém o
 * envio lendo as SMTP_* do ambiente, exatamente como antes desta tela existir.
 */
@Injectable()
export class MailSettingsService implements OnModuleInit {
  private readonly log = new Logger('MailSettings');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * No boot, aplica a conta gravada. Falha aqui NUNCA derruba a API: cai para o
   * ambiente, que é a configuração que já funcionava.
   */
  async onModuleInit(): Promise<void> {
    await this.applyFromDb();
  }

  private async applyFromDb(): Promise<void> {
    try {
      const row = (await this.prisma.admin.mailSettings.findFirst()) as Row | null;
      if (!row || !row.enabled) {
        setMailOverride(null);
        return;
      }
      setMailOverride({
        host: row.host,
        port: row.port,
        secure: row.secure,
        user: row.username,
        pass: decryptSecret({ enc: row.passwordEnc, iv: row.passwordIv, tag: row.passwordTag }),
        from: buildFrom(row.fromName, row.fromEmail),
      });
      this.log.log(`E-mail de envio: conta do painel (${row.fromEmail}).`);
    } catch (e) {
      // Banco fora do ar, AUTH_SECRET ausente/trocado (a senha não decifra)…
      // Em qualquer caso, seguir pelo ambiente é melhor que ficar sem e-mail.
      setMailOverride(null);
      this.log.warn(
        `Não foi possível aplicar a conta de e-mail do painel; usando o ambiente. ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }

  /** Estado atual da configuração — sem a senha. */
  async get(): Promise<MailSettingsData> {
    const row = (await this.prisma.admin.mailSettings.findFirst()) as Row | null;
    return this.toData(row);
  }

  /**
   * Grava a conta. A senha só é exigida na PRIMEIRA gravação: vindo vazia numa
   * conta que já existe, a senha atual é mantida (o painel nunca recebe a senha
   * de volta, então não teria como reenviá-la).
   *
   * Antes de gravar, AUTENTICA no servidor informado. Isso evita o pior caso
   * desta tela: salvar uma credencial errada e descobrir dias depois que nenhum
   * cliente recebeu a senha de acesso.
   */
  async save(
    dto: {
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password?: string;
      fromName?: string | null;
      fromEmail: string;
    },
    actor: AuditActor,
  ): Promise<MailSettingsData> {
    const existing = (await this.prisma.admin.mailSettings.findFirst()) as Row | null;

    const host = dto.host.trim();
    const username = dto.username.trim();
    const fromEmail = dto.fromEmail.trim();
    const fromName = dto.fromName?.trim() || null;
    if (!host) throw new BadRequestException('Informe o servidor SMTP.');
    if (!username) throw new BadRequestException('Informe o usuário do SMTP.');
    if (!fromEmail) throw new BadRequestException('Informe o e-mail do remetente.');
    if (!Number.isInteger(dto.port) || dto.port < 1 || dto.port > 65535) {
      throw new BadRequestException('Porta inválida.');
    }

    const senha = dto.password?.trim() || '';
    let encrypted: { enc: string; iv: string; tag: string };
    let hint: string;
    let plain: string;
    if (senha) {
      plain = senha;
      encrypted = encryptSecret(senha);
      hint = hintOf(senha);
    } else {
      if (!existing) throw new BadRequestException('Informe a senha da conta de e-mail.');
      plain = decryptSecret({
        enc: existing.passwordEnc,
        iv: existing.passwordIv,
        tag: existing.passwordTag,
      });
      encrypted = { enc: existing.passwordEnc, iv: existing.passwordIv, tag: existing.passwordTag };
      hint = existing.passwordHint;
    }

    // Autentica ANTES de gravar — só vale a pena guardar o que comprovadamente envia.
    const probe = await verifySmtp({
      host,
      port: dto.port,
      secure: dto.secure,
      user: username,
      pass: plain,
    });
    if (!probe.ok) {
      throw new BadRequestException(
        `Não foi possível autenticar no servidor de e-mail: ${probe.reason ?? 'falha desconhecida'}`,
      );
    }

    const data = {
      enabled: dto.enabled,
      host,
      port: dto.port,
      secure: dto.secure,
      username,
      fromName,
      fromEmail,
      passwordEnc: encrypted.enc,
      passwordIv: encrypted.iv,
      passwordTag: encrypted.tag,
      passwordHint: hint,
    };

    const saved = (existing
      ? await this.prisma.admin.mailSettings.update({ where: { id: existing.id }, data })
      : await this.prisma.admin.mailSettings.create({ data })) as Row;

    // Passa a valer imediatamente, sem esperar restart.
    await this.applyFromDb();

    await this.audit.record({
      action: 'mail.settings.update',
      actor,
      target: fromEmail,
      // NUNCA registrar a senha — só o que identifica a conta.
      meta: { host, port: dto.port, secure: dto.secure, username, enabled: dto.enabled },
    });

    return this.toData(saved);
  }

  private toData(row: Row | null): MailSettingsData {
    const envConfigured = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
    const envFrom =
      process.env.SMTP_FROM ?? (process.env.SMTP_USER ? `CRIVO <${process.env.SMTP_USER}>` : null);

    const painelAtivo = Boolean(row?.enabled);
    const activeSource: MailSettingsData['activeSource'] = painelAtivo
      ? 'painel'
      : envConfigured
        ? 'ambiente'
        : 'nenhum';

    return {
      configured: !!row,
      enabled: row?.enabled ?? false,
      host: row?.host ?? '',
      port: row?.port ?? 465,
      secure: row?.secure ?? true,
      username: row?.username ?? '',
      fromName: row?.fromName ?? null,
      fromEmail: row?.fromEmail ?? '',
      passwordHint: row?.passwordHint ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      activeSource,
      activeFrom:
        painelAtivo && row ? buildFrom(row.fromName, row.fromEmail) : envConfigured ? envFrom : null,
    };
  }
}
