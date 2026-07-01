import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

// Diagnóstico Inicial da LP. Faz 3 coisas, todas best-effort (nunca trava o lead):
//   1. encaminha o formulário ao endpoint público da plataforma (cria o lead no
//      CRM + calcula o pré-diagnóstico, devolvido aqui);
//   2. envia ao PRÓPRIO LEAD um e-mail profissional com o diagnóstico + o e-book
//      em anexo (SMTP, ou Resend se configurado);
//   3. envia ao lead um WhatsApp (via API da VAI) com o diagnóstico + o e-book.
// Os envios saem DAQUI (Vercel) para não depender de variáveis no backend.

type Answer = { questionId: number; value: number };
type Payload = {
  name?: string;
  cnpj?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  segment?: string;
  employeesCount?: string;
  challenges?: string[];
  challengeOther?: string;
  origin?: string;
  answers?: Answer[];
};
type DiagResult = {
  score: number;
  level: string;
  byDimension?: Record<string, number>;
  topAttention?: string;
  topAttentions?: string[];
};

const EBOOK_URL = process.env.EBOOK_URL ?? "https://crivo.vai-sistema.com/ebook-crivo.pdf";
const SITE_URL = process.env.SITE_URL ?? "https://crivo.vai-sistema.com";

const LEVEL_LABEL: Record<string, string> = {
  CRITICO: "Crítico",
  EM_ESTRUTURACAO: "Em estruturação",
  EM_DESENVOLVIMENTO: "Em desenvolvimento",
  ESTRUTURADO: "Estruturado",
  CONSOLIDADO: "Consolidado",
  REFERENCIA: "Referência",
};
const DIM_LABEL: Record<string, string> = {
  pressao_rotina: "Pressão & Rotina",
  lideranca_sustentacao: "Liderança & Sustentação",
  cultura_comunicacao: "Cultura & Comunicação",
  fatores_psicossociais: "Fatores Psicossociais",
  governanca_plano: "Governança & Plano de Ação",
};

const NAVY = "#1b2a4a";
const TERRA = "#c4894a";

function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] || "tudo bem";
}
function levelLabel(level?: string): string {
  return level ? LEVEL_LABEL[level] ?? level : "—";
}
function attentionLabels(result?: DiagResult): string[] {
  const keys = result?.topAttentions?.length
    ? result.topAttentions
    : result?.topAttention
      ? [result.topAttention]
      : [];
  return keys.map((k) => DIM_LABEL[k] ?? k);
}

// ── 1. Encaminha à plataforma e devolve o pré-diagnóstico ────────────────────
async function sendToPlatform(apiUrl: string, data: Payload): Promise<{ ok: boolean; result?: DiagResult }> {
  try {
    const r = await fetch(`${apiUrl}/public/diagnostic-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        cnpj: data.cnpj || undefined,
        role: data.role || undefined,
        company: data.company || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        segment: data.segment || undefined,
        employeesCount: data.employeesCount || undefined,
        challenges: data.challenges?.length ? data.challenges : undefined,
        challengeOther: data.challengeOther || undefined,
        origin: data.origin || "lp-diagnostico",
        answers: data.answers ?? [],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return { ok: false };
    const d = (await r.json()) as { result?: DiagResult };
    return { ok: true, result: d?.result };
  } catch {
    return { ok: false };
  }
}

// ── E-mail profissional ao LEAD (HTML inline, email-safe) ────────────────────
function leadEmailHtml(data: Payload, result?: DiagResult): string {
  const empresa = data.company || "sua empresa";
  const score = result?.score ?? null;
  const nivel = levelLabel(result?.level);
  const atencao = attentionLabels(result);
  const scoreBlock =
    score != null
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
           <td style="text-align:center;background:${NAVY};border-radius:16px;padding:22px 30px">
             <div style="font:700 46px/1 Georgia,serif;color:#fff">${score}<span style="font-size:20px;color:${TERRA}">/100</span></div>
             <div style="font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#c9d2e6;margin-top:6px">Índice preliminar</div>
           </td></tr></table>`
      : "";
  const atencaoBlock = atencao.length
    ? `<p style="margin:18px 0 6px;font:600 13px Arial,sans-serif;color:${NAVY}">Principais pontos de atenção:</p>
       <ul style="margin:0;padding-left:18px;font:14px/1.6 Arial,sans-serif;color:#333">${atencao
         .map((a) => `<li>${a}</li>`)
         .join("")}</ul>`
    : "";

  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f1ec;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(27,42,74,.08)">
      <tr><td style="background:${NAVY};padding:26px 34px">
        <div style="font:700 22px Georgia,serif;color:#fff;letter-spacing:.04em">CRIVO<span style="color:${TERRA}">™</span></div>
        <div style="font:13px Arial,sans-serif;color:#c9d2e6;margin-top:2px">Inteligência decisória · Diagnóstico Inicial</div>
      </td></tr>
      <tr><td style="padding:30px 34px 8px">
        <p style="margin:0 0 10px;font:16px/1.6 Georgia,serif;color:${NAVY}">Olá, ${firstName(data.name)}.</p>
        <p style="margin:0 0 22px;font:14px/1.7 Arial,sans-serif;color:#444">
          Recebemos o Diagnóstico Inicial de <strong>${empresa}</strong>. Abaixo, sua leitura preliminar — e
          o <strong>e-book complementar</strong> segue em anexo neste e-mail.</p>
        ${scoreBlock}
        <p style="margin:18px 0 0;font:14px/1.7 Arial,sans-serif;color:#444">
          Nível de maturidade: <strong style="color:${NAVY}">${nivel}</strong>.</p>
        ${atencaoBlock}
      </td></tr>
      <tr><td style="padding:24px 34px 8px">
        <a href="${SITE_URL}" style="display:inline-block;background:${TERRA};color:#fff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 26px;border-radius:10px">Conhecer a jornada CRIVO</a>
      </td></tr>
      <tr><td style="padding:18px 34px 28px">
        <p style="margin:0;font:11px/1.6 Arial,sans-serif;color:#8a8a8a;border-top:1px solid #eee;padding-top:14px">
          Esta é uma <strong>leitura preliminar</strong> com base nas respostas informadas — não substitui uma análise
          técnica presencial. A equipe CRIVO poderá avaliar o diagnóstico mais adequado à realidade da sua operação.</p>
        <p style="margin:10px 0 0;font:11px Arial,sans-serif;color:${TERRA};font-weight:700">CRIVO™ · O2 Legacy</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function fetchEbook(): Promise<Buffer | null> {
  try {
    const r = await fetch(EBOOK_URL, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function sendLeadEmail(data: Payload, result: DiagResult | undefined, pdf: Buffer | null): Promise<boolean> {
  const to = data.email?.trim();
  if (!to) return false;
  const html = leadEmailHtml(data, result);
  const subject = "Seu Diagnóstico Inicial CRIVO™ + e-book";
  const resendKey = process.env.RESEND_API_KEY;

  // Preferência: Resend (HTTP, ideal em serverless) se houver chave.
  if (resendKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.SMTP_FROM ?? "CRIVO <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
          attachments: pdf ? [{ filename: "CRIVO-ebook.pdf", content: pdf.toString("base64") }] : undefined,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) return true;
    } catch {
      /* tenta SMTP abaixo */
    }
  }

  // SMTP (Zoho/Hostinger). Vercel/Lambda permite 587 de saída.
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `CRIVO <${user}>`,
      to,
      subject,
      html,
      attachments: pdf ? [{ filename: "CRIVO-ebook.pdf", content: pdf }] : undefined,
    });
    return true;
  } catch (e) {
    console.error("[lead-email] SMTP falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

// ── WhatsApp ao LEAD (API da VAI: login → canal → contato → chat → mensagem) ──
async function vaiFetch(base: string, path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
}

async function sendLeadWhatsapp(data: Payload, result: DiagResult | undefined, pdf: Buffer | null): Promise<boolean> {
  const to = (data.phone ?? "").replace(/\D/g, "");
  if (!to) return false;
  const base = process.env.VAI_API_URL ?? "https://api.vaicrm.com.br";
  const email = process.env.VAI_API_EMAIL;
  const password = process.env.VAI_API_PASSWORD;
  if (!email || !password) return false;

  try {
    const lr = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12000),
    });
    if (!lr.ok) return false;
    const token = ((await lr.json()) as { access_token?: string }).access_token;
    if (!token) return false;

    let channelId = process.env.VAI_WA_CHANNEL_ID;
    if (!channelId) {
      const cr = await vaiFetch(base, "/channels/type/whatsapp", { method: "GET" }, token);
      if (cr.ok) {
        const list = (await cr.json()) as { id: string; status?: string }[];
        channelId = (list.find((c) => c.status === "connected") ?? list[0])?.id;
      }
    }
    if (!channelId) return false;

    // contato (acha ou cria)
    let contactId: string | undefined;
    const f = await vaiFetch(base, `/contacts?phone=${encodeURIComponent(to)}&limit=1`, { method: "GET" }, token);
    if (f.ok) contactId = ((await f.json()) as { data?: { id?: string }[] })?.data?.[0]?.id;
    if (!contactId) {
      const c = await vaiFetch(
        base,
        "/contacts",
        { method: "POST", body: JSON.stringify({ channel: "whatsapp", identifier: to, phone: to, name: data.name || to }) },
        token,
      );
      if (c.ok) contactId = ((await c.json()) as { id?: string }).id;
    }
    if (!contactId) return false;

    // chat (cria; reusa no 409)
    let chatId: string | undefined;
    const ch = await vaiFetch(base, "/chats", { method: "POST", body: JSON.stringify({ contactId, channelId }) }, token);
    if (ch.ok) chatId = ((await ch.json()) as { id?: string }).id;
    else if (ch.status === 409) {
      const gx = await vaiFetch(base, `/chats?contactId=${encodeURIComponent(contactId)}&limit=1`, { method: "GET" }, token);
      if (gx.ok) chatId = ((await gx.json()) as { data?: { id?: string }[] })?.data?.[0]?.id;
    }
    if (!chatId) return false;

    const nivel = levelLabel(result?.level);
    const score = result?.score != null ? `${result.score}/100` : "";
    const atencao = attentionLabels(result);
    const msg =
      `✅ *Diagnóstico Inicial CRIVO™ recebido*\n\n` +
      `Olá, ${firstName(data.name)}! Aqui está sua leitura preliminar:\n` +
      (score ? `• Índice preliminar: *${score}*\n` : "") +
      `• Nível de maturidade: *${nivel}*\n` +
      (atencao.length ? `• Pontos de atenção: ${atencao.join(", ")}\n` : "") +
      `\n📘 Seu e-book complementar: ${EBOOK_URL}\n\n` +
      `_Leitura preliminar com base nas respostas — a equipe CRIVO entra em contato para os próximos passos._`;

    const sent = await vaiFetch(
      base,
      `/chats/${chatId}/messages`,
      { method: "POST", body: JSON.stringify({ content: msg, type: "text" }) },
      token,
    );
    if (!sent.ok) return false;

    // E-book como DOCUMENTO real (best-effort). A VAI exige o arquivo no storage
    // dela: upload (multipart) → devolve a URL S3 → envia o documento com ela.
    // Mandar a URL externa direto gera "arquivo vazio". O link no texto é o backup.
    if (pdf) {
      try {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), "CRIVO-ebook.pdf");
        form.append("type", "document");
        const up = await fetch(`${base}/chats/${chatId}/messages/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: AbortSignal.timeout(15000),
        });
        if (up.ok) {
          const media = (await up.json()) as { url?: string };
          if (media.url) {
            await vaiFetch(
              base,
              `/chats/${chatId}/messages`,
              { method: "POST", body: JSON.stringify({ type: "document", fileUrl: media.url, content: "E-book CRIVO™" }) },
              token,
            );
          }
        }
      } catch {
        /* o link do e-book no texto já garante o acesso ao PDF */
      }
    }

    return true;
  } catch (e) {
    console.error("[lead-whatsapp] falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

// Consulta o painel de Notificações (backend) e dispara o push da equipe CRIVO.
// Fail-open: gate indisponível → o e-mail de aviso continua saindo.
async function notifyGate(key: string, title: string, body: string): Promise<{ emailEnabled: boolean }> {
  const api = process.env.PLATFORM_API_URL;
  if (!api) return { emailEnabled: true };
  try {
    const r = await fetch(`${api}/notifications/site-event/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-secret": process.env.SITE_NOTIFY_SECRET ?? "",
      },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { emailEnabled: true };
    const j = (await r.json()) as { emailEnabled?: boolean };
    return { emailEnabled: j.emailEnabled !== false };
  } catch {
    return { emailEnabled: true };
  }
}

export async function POST(req: Request) {
  let data: Payload;
  try {
    data = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  if (!data.name || !data.name.trim()) {
    return NextResponse.json({ ok: false, error: "Nome é obrigatório." }, { status: 400 });
  }

  const platformApi = process.env.PLATFORM_API_URL;

  // Dispara o push da equipe CRIVO (novo diagnóstico) — fire-and-forget. As
  // entregas ao LEAD (e-mail + WhatsApp abaixo) são do cliente, não passam pelo
  // toggle do painel; o push interno respeita o pushEnabled no backend.
  void notifyGate(
    "site.diagnostico_lead",
    "Novo diagnóstico inicial",
    String(data.company ?? data.name ?? data.email ?? "lead"),
  );

  // 1. Cria o lead no CRM e recupera o pré-diagnóstico.
  let result: DiagResult | undefined;
  let platformOk = false;
  if (platformApi) {
    const r = await sendToPlatform(platformApi, data);
    platformOk = r.ok;
    result = r.result;
  }

  // 2/3. Envia ao lead (e-mail + WhatsApp) em paralelo — best-effort.
  const ebook = await fetchEbook();
  const [emailed, whatsapped] = await Promise.all([
    sendLeadEmail(data, result, ebook).catch(() => false),
    sendLeadWhatsapp(data, result, ebook).catch(() => false),
  ]);

  if (!platformApi) {
    console.warn("[diagnostic-lead] PLATFORM_API_URL ausente — lead não registrado no CRM.");
  }
  if (!emailed && !whatsapped) {
    console.warn(
      "[diagnostic-lead] Nenhum canal entregou ao lead (verifique SMTP_*/RESEND_API_KEY e VAI_API_* no ambiente).",
    );
  }

  // Nunca trava o usuário: o pré-diagnóstico aparece na tela mesmo se um canal falhar.
  return NextResponse.json({ ok: platformOk || emailed || whatsapped, emailed, whatsapped });
}
