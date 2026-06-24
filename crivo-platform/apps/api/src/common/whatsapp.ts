import { Logger } from '@nestjs/common';

/**
 * Envio de WhatsApp pela API da VAI (compatível com a Meta Cloud API v20.0).
 *
 * Configurar no AMBIENTE da API (Railway), quando as credenciais chegarem:
 *   VAI_WA_API_URL — endpoint de mensagens. Ex.:
 *                    https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>/messages
 *                    (ou o gateway equivalente da VAI)
 *   VAI_WA_TOKEN   — token de acesso (enviado como Bearer)
 *
 * Sem essas variáveis, `whatsappConfigured()` é false e `sendWhatsapp()` apenas
 * registra (stub) — o fluxo NUNCA trava. Pronto para receber a conta/credencial.
 */
const log = new Logger('Whatsapp');

export interface SendWhatsappInput {
  /** Telefone do destinatário (qualquer formato; só os dígitos são usados). */
  to: string;
  message: string;
}

export interface SendWhatsappResult {
  ok: boolean;
  provider: 'vai' | 'stub';
  reason?: string;
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.VAI_WA_API_URL && process.env.VAI_WA_TOKEN);
}

export async function sendWhatsapp(input: SendWhatsappInput): Promise<SendWhatsappResult> {
  const url = process.env.VAI_WA_API_URL;
  const token = process.env.VAI_WA_TOKEN;
  const to = (input.to ?? '').replace(/\D/g, '');
  if (!url || !token) {
    log.warn(
      `WhatsApp não configurado — mensagem para ${to || '—'} não enviada. ` +
        'Defina VAI_WA_API_URL e VAI_WA_TOKEN no ambiente da API.',
    );
    return { ok: false, provider: 'stub', reason: 'whatsapp-not-configured' };
  }
  if (!to) return { ok: false, provider: 'vai', reason: 'destinatário sem telefone' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: true, body: input.message },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      return { ok: false, provider: 'vai', reason: `HTTP ${res.status}: ${detail}` };
    }
    return { ok: true, provider: 'vai' };
  } catch (e) {
    return { ok: false, provider: 'vai', reason: e instanceof Error ? e.message : 'Falha de conexão.' };
  }
}
