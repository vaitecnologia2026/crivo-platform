import { Logger } from '@nestjs/common';

/**
 * Envio de WhatsApp pela API da plataforma VAI (api.vaicrm.com.br).
 *
 * Auth: login (e-mail + senha) → JWT (Bearer, ~1h), cacheado em memória e
 * renovado sob demanda. Fluxo de envio (descoberto via OpenAPI `/docs-json` da VAI):
 *   1. canal WhatsApp conectado  — GET /channels/type/whatsapp  (ou VAI_WA_CHANNEL_ID)
 *   2. acha/cria contato p/ telefone — GET /contacts?phone= → data[0].id  /  POST /contacts
 *   3. cria chat — POST /chats { contactId, channelId } → id
 *   4. envia — POST /chats/{chatId}/messages { content, type: 'text' }
 *
 * ENV (definir no Railway, serviço da API):
 *   VAI_API_URL        default https://api.vaicrm.com.br
 *   VAI_API_EMAIL      e-mail de uma conta VAI (ex.: douglas@vai.com.br)
 *   VAI_API_PASSWORD   senha dessa conta
 *   VAI_WA_CHANNEL_ID  (opcional) força um canal; senão pega o 1º conectado
 *
 * Sem VAI_API_EMAIL + VAI_API_PASSWORD, `whatsappConfigured()` é false e
 * `sendWhatsapp()` é stub (apenas registra) — o fluxo NUNCA trava.
 */
const log = new Logger('Whatsapp');

const baseUrl = (): string => process.env.VAI_API_URL || 'https://api.vaicrm.com.br';

export interface SendWhatsappInput {
  /** Telefone do destinatário (qualquer formato; só os dígitos são usados, com DDI). */
  to: string;
  message: string;
  /** Nome do contato (usado se for preciso criar o contato na VAI). */
  name?: string;
}

export interface SendWhatsappResult {
  ok: boolean;
  provider: 'vai' | 'stub';
  reason?: string;
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.VAI_API_EMAIL && process.env.VAI_API_PASSWORD);
}

// ── Auth: JWT cacheado em memória ──────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpMs = 0;

function decodeJwtExpMs(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getToken(force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && cachedToken && now < tokenExpMs - 60_000) return cachedToken;
  const email = process.env.VAI_API_EMAIL;
  const password = process.env.VAI_API_PASSWORD;
  if (!email || !password) return null;
  try {
    const r = await fetch(`${baseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      log.warn(`Login VAI falhou: HTTP ${r.status}`);
      return null;
    }
    const d = (await r.json()) as { access_token?: string };
    if (!d.access_token) return null;
    cachedToken = d.access_token;
    tokenExpMs = decodeJwtExpMs(d.access_token) ?? now + 50 * 60_000;
    return cachedToken;
  } catch (e) {
    log.warn(`Login VAI erro: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function vaiFetch(path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
}

async function resolveChannelId(token: string): Promise<string | null> {
  if (process.env.VAI_WA_CHANNEL_ID) return process.env.VAI_WA_CHANNEL_ID;
  const r = await vaiFetch('/channels/type/whatsapp', { method: 'GET' }, token);
  if (!r.ok) return null;
  const list = (await r.json()) as Array<{ id: string; status?: string }>;
  if (!Array.isArray(list) || !list.length) return null;
  const connected = list.find((c) => c.status === 'connected') ?? list[0];
  return connected?.id ?? null;
}

async function findOrCreateContactId(token: string, phone: string, name?: string): Promise<string | null> {
  // Acha por telefone (evita duplicar).
  const f = await vaiFetch(`/contacts?phone=${encodeURIComponent(phone)}&limit=1`, { method: 'GET' }, token);
  if (f.ok) {
    const d = (await f.json()) as { data?: { id?: string }[] };
    const id = d?.data?.[0]?.id;
    if (id) return id;
  }
  // Cria.
  const c = await vaiFetch(
    '/contacts',
    {
      method: 'POST',
      body: JSON.stringify({ channel: 'whatsapp', identifier: phone, phone, name: name?.trim() || phone }),
    },
    token,
  );
  if (!c.ok) {
    log.warn(`Criar contato VAI falhou: HTTP ${c.status}`);
    return null;
  }
  const cd = (await c.json()) as { id?: string; data?: { id?: string } };
  return cd?.id ?? cd?.data?.id ?? null;
}

async function createChatId(token: string, contactId: string, channelId: string): Promise<string | null> {
  const r = await vaiFetch('/chats', { method: 'POST', body: JSON.stringify({ contactId, channelId }) }, token);
  if (!r.ok) {
    log.warn(`Criar chat VAI falhou: HTTP ${r.status}`);
    return null;
  }
  const d = (await r.json()) as { id?: string; data?: { id?: string } };
  return d?.id ?? d?.data?.id ?? null;
}

export async function sendWhatsapp(input: SendWhatsappInput): Promise<SendWhatsappResult> {
  const to = (input.to ?? '').replace(/\D/g, '');
  if (!whatsappConfigured()) {
    log.warn(
      `WhatsApp não configurado — mensagem para ${to || '—'} não enviada. ` +
        'Defina VAI_API_EMAIL e VAI_API_PASSWORD no ambiente da API.',
    );
    return { ok: false, provider: 'stub', reason: 'whatsapp-not-configured' };
  }
  if (!to) return { ok: false, provider: 'vai', reason: 'destinatário sem telefone' };

  try {
    // Tenta com token em cache; se o envio der 401, renova o token uma vez.
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getToken(attempt === 1);
      if (!token) return { ok: false, provider: 'vai', reason: 'login VAI falhou' };

      const channelId = await resolveChannelId(token);
      if (!channelId) return { ok: false, provider: 'vai', reason: 'nenhum canal WhatsApp conectado na VAI' };

      const contactId = await findOrCreateContactId(token, to, input.name);
      if (!contactId) return { ok: false, provider: 'vai', reason: 'falha ao resolver contato' };

      const chatId = await createChatId(token, contactId, channelId);
      if (!chatId) return { ok: false, provider: 'vai', reason: 'falha ao criar chat' };

      const res = await vaiFetch(
        `/chats/${chatId}/messages`,
        { method: 'POST', body: JSON.stringify({ content: input.message, type: 'text' }) },
        token,
      );
      if (res.ok) return { ok: true, provider: 'vai' };
      if (res.status === 401 && attempt === 0) continue; // token expirou → renova e repete
      const detail = await res.text().catch(() => res.statusText);
      return { ok: false, provider: 'vai', reason: `envio HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: false, provider: 'vai', reason: 'falha de autenticação' };
  } catch (e) {
    return { ok: false, provider: 'vai', reason: e instanceof Error ? e.message : 'falha de conexão' };
  }
}
