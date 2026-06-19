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
}

export interface SendMailResult {
  ok: boolean;
  provider: 'smtp' | 'resend' | 'stub';
  reason?: string;
}

let cached: { key: string; transport: Transporter } | null = null;

function smtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  const key = `${host}:${port}:${secure}:${user}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transport: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
    };
  }
  return cached.transport;
}

/** True se houver algum provider de e-mail configurado (SMTP ou Resend). */
export function mailConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
      process.env.RESEND_API_KEY,
  );
}

function smtpFrom(): string {
  return process.env.SMTP_FROM ?? `CRIVO <${process.env.SMTP_USER}>`;
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
  // 1) SMTP (Hostinger)
  const transport = smtpTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: smtpFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      return { ok: true, provider: 'smtp' };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Falha SMTP.';
      log.warn(`SMTP falhou ao enviar para ${input.to}: ${reason}`);
      return { ok: false, provider: 'smtp', reason };
    }
  }

  // 2) Resend (fallback HTTP)
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

  // 3) Stub
  return {
    ok: false,
    provider: 'stub',
    reason: 'Nenhum provider de e-mail configurado (SMTP_* ou RESEND_API_KEY).',
  };
}
