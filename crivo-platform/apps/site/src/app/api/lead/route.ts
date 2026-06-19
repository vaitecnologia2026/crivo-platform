import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Recebe os leads dos formulários da LP (diagnóstico + e-book) e entrega por
// múltiplos canais, conforme configurado por env — nenhum lead se perde:
//   • PLATFORM_API_URL  → cria o lead direto no pipeline do CRM (POST /public/lead)
//   • LEAD_WEBHOOK_URL  → POST do payload (CRM / Zapier / Make / planilha)
//   • SMTP_* (Hostinger) → e-mail para LEAD_TO_EMAIL (preferido)
//   • RESEND_API_KEY    → e-mail via Resend (fallback, se SMTP ausente)
// Se nada estiver configurado, registra no log do servidor e ACEITA o lead
// (não trava o usuário), deixando rastro para recuperação manual.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Lead = Record<string, unknown> & { email?: unknown; origem?: unknown };

async function sendWebhook(url: string, data: Lead): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, recebidoEm: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Cria o lead direto no funil do CRM (endpoint público /public/lead — sem segredo,
// rate-limited na API). Basta PLATFORM_API_URL configurado no site.
async function sendIntake(apiUrl: string, data: Lead, email: string): Promise<boolean> {
  const s = (v: unknown) => (v == null || v === "" ? undefined : String(v));
  const notes = [
    data.colaboradores && `Colaboradores: ${data.colaboradores}`,
    data.lideres && `Líderes: ${data.lideres}`,
  ]
    .filter(Boolean)
    .join(" · ");
  try {
    const r = await fetch(`${apiUrl}/public/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s(data.nome) ?? s(data.name) ?? "Lead sem nome",
        company: s(data.empresa),
        email,
        phone: s(data.whatsapp),
        segment: s(data.segmento),
        employeesCount: s(data.colaboradores),
        origin: s(data.origem) ?? "lp",
        notes: notes || undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function leadEmailParts(data: Lead) {
  const to = process.env.LEAD_TO_EMAIL ?? "contato@crivolegacy.com.br";
  const linhas = Object.entries(data)
    .map(([k, v]) => `<strong>${k}:</strong> ${String(v ?? "")}`)
    .join("<br>");
  const subject = `Novo lead CRIVO · ${String(data.empresa ?? data.nome ?? data.email)}`;
  const html = `<h2>Novo lead (${String(data.origem ?? "lp")})</h2>${linhas}`;
  return { to, subject, html };
}

// E-mail via SMTP (Hostinger) — remetente é o endereço autenticado.
async function sendEmailSmtp(data: Lead, email: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  const from = process.env.SMTP_FROM ?? `CRIVO Leads <${user}>`;
  const { to, subject, html } = leadEmailParts(data);
  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      // Falha rápido se a porta SMTP estiver bloqueada (PaaS) — não trava a request.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
    await transport.sendMail({ from, to, replyTo: email, subject, html });
    return true;
  } catch {
    return false;
  }
}

async function sendEmail(apiKey: string, data: Lead, email: string): Promise<boolean> {
  const to = process.env.LEAD_TO_EMAIL ?? "contato@crivolegacy.com.br";
  const from = process.env.LEAD_FROM_EMAIL ?? "CRIVO Leads <onboarding@resend.dev>";
  const linhas = Object.entries(data)
    .map(([k, v]) => `<strong>${k}:</strong> ${String(v ?? "")}`)
    .join("<br>");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Novo lead CRIVO · ${String(data.empresa ?? data.nome ?? email)}`,
        html: `<h2>Novo lead (${String(data.origem ?? "lp")})</h2>${linhas}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let data: Lead;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });
  }

  const webhook = process.env.LEAD_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const platformApi = process.env.PLATFORM_API_URL;
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  const tasks: Promise<boolean>[] = [];
  if (platformApi) tasks.push(sendIntake(platformApi, data, email));
  if (webhook) tasks.push(sendWebhook(webhook, data));
  // E-mail: SMTP (Hostinger) preferido; Resend como fallback.
  if (smtpConfigured) tasks.push(sendEmailSmtp(data, email));
  else if (resendKey) tasks.push(sendEmail(resendKey, data, email));

  if (tasks.length === 0) {
    console.warn(
      "[lead] Nenhum provider configurado (PLATFORM_API_URL / SMTP_* / RESEND_API_KEY / LEAD_WEBHOOK_URL). Lead recebido:",
      JSON.stringify(data),
    );
    return NextResponse.json({ ok: true, warning: "no-provider" });
  }

  const results = await Promise.all(tasks);
  if (!results.some(Boolean)) {
    console.error("[lead] Todos os canais falharam. Lead:", JSON.stringify(data));
    return NextResponse.json(
      { ok: false, error: "Falha ao registrar. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
