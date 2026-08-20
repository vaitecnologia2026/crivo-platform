import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envio de e-mail unificado da CRIVO. Ordem de preferência:
 *   1) SMTP (Hostinger) — se SMTP_HOST/SMTP_USER/SMTP_PASS no env.
 *   2) Resend (HTTP)    — fallback, se RESEND_API_KEY no env.
 *   3) Stub             — não envia, só registra (permite operar sem provider).
 *
 * Com SMTP, o remetente é SEMPRE o endereço autenticado (SMTP_FROM/SMTP_USER) —
 * a Hostinger rejeita From de domínio não autenticado. O remetente "pretendido"
 * de cada chamada vira Reply-To, preservando para quem o destinatário responde.
 */

const log = new Logger('Mailer');

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Para quem o destinatário deve responder (vira Reply-To no SMTP). */
  replyTo?: string;
  /** Anexos (ex.: e-book). content em Buffer; vira base64 no Resend. */
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

export interface SendMailResult {
  ok: boolean;
  provider: 'smtp' | 'resend' | 'stub';
  reason?: string;
}

let cached: { key: string; transport: Transporter } | null = null;

/**
 * Conta SMTP configurada no painel (Governança · E-mail de envio), carregada do
 * banco no boot e a cada gravação. Quando é `null` — que é o estado até alguém
 * configurar — TODO o envio segue lendo as SMTP_* do ambiente, exatamente como
 * antes desta configuração existir.
 */
export interface MailOverride {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** Remetente já montado ("Nome <endereco>" ou só o endereço). */
  from: string;
}

let override: MailOverride | null = null;

/**
 * Define (ou limpa, com null) a conta configurada no painel. Zera o transporte
 * em cache: sem isso, o nodemailer continuaria autenticando com as credenciais
 * anteriores até o próximo restart.
 */
export function setMailOverride(cfg: MailOverride | null): void {
  override = cfg;
  cached = null;
}

function smtpTransport(): Transporter | null {
  const host = override?.host ?? process.env.SMTP_HOST;
  const user = override?.user ?? process.env.SMTP_USER;
  const pass = override?.pass ?? process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = override?.port ?? Number(process.env.SMTP_PORT ?? 465);
  const secure = override
    ? override.secure
    : process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;

  const key = `${host}:${port}:${secure}:${user}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      // Timeouts curtos: alguns hosts (ex.: Railway/PaaS) bloqueiam SMTP de saída
      // (465/587). Sem timeout, o envio trava ~2min. Falha rápido → cai no Resend.
      transport: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      }),
    };
  }
  return cached.transport;
}

/** True se houver algum provider de e-mail configurado (SMTP ou Resend). */
export function mailConfigured(): boolean {
  return Boolean(
    override ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
      process.env.RESEND_API_KEY,
  );
}

function smtpFrom(): string {
  if (override) return override.from;
  return process.env.SMTP_FROM ?? `CRIVO <${process.env.SMTP_USER}>`;
}

/**
 * Testa uma conta SMTP SEM gravar nada e SEM mexer no transporte em uso: abre
 * uma conexão descartável e autentica.
 *
 * Serve para que salvar uma conta errada no painel não derrube, em silêncio, o
 * e-mail da senha de acesso e do Relatório Preliminar — a gravação só acontece
 * se a autenticação passar.
 */
export async function verifySmtp(cfg: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const probe = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  try {
    await probe.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Falha ao conectar no SMTP.' };
  } finally {
    probe.close();
  }
}

/**
 * Envia um e-mail pelo provider configurado.
 * @param opts.resendFrom remetente usado SÓ no fallback Resend (no SMTP o From é
 *   sempre o endereço autenticado). Default: RESEND_FROM do env.
 */
export async function sendMail(
  input: SendMailInput,
  opts?: { resendFrom?: string },
): Promise<SendMailResult> {
  // 1) SMTP (Hostinger). Em falha (ex.: porta bloqueada no Railway), NÃO retorna
  //    o erro: cai pro Resend abaixo se houver RESEND_API_KEY.
  const transport = smtpTransport();
  let smtpFail: SendMailResult | null = null;
  if (transport) {
    try {
      await transport.sendMail({
        from: smtpFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments: input.attachments,
      });
      return { ok: true, provider: 'smtp' };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Falha SMTP.';
      log.warn(`SMTP falhou ao enviar para ${input.to}: ${reason} — tentando Resend.`);
      smtpFail = { ok: false, provider: 'smtp', reason };
    }
  }

  // 2) Resend (HTTP) — provider primário sem SMTP, ou fallback se o SMTP falhou.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = opts?.resendFrom ?? process.env.RESEND_FROM ?? 'CRIVO <noreply@crivolegacy.com.br>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
          attachments: input.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content.toString('base64'),
          })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        return { ok: false, provider: 'resend', reason: `HTTP ${res.status}: ${detail}` };
      }
      return { ok: true, provider: 'resend' };
    } catch (e) {
      return {
        ok: false,
        provider: 'resend',
        reason: e instanceof Error ? e.message : 'Falha de conexão Resend.',
      };
    }
  }

  // 3) SMTP falhou e não há Resend → devolve o erro do SMTP.
  if (smtpFail) return smtpFail;

  // 4) Stub — nenhum provider configurado.
  return {
    ok: false,
    provider: 'stub',
    reason: 'Nenhum provider de e-mail configurado (SMTP_* ou RESEND_API_KEY).',
  };
}
