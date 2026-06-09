import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Recebe os leads dos formulários da LP (diagnóstico + e-book) e entrega por
// até TRÊS canais, conforme configurado por env — nenhum lead se perde:
//   • PLATFORM_API_URL + LEAD_INTAKE_SECRET → cria o lead direto no pipeline do
//     CRM (POST /leads/intake) — fecha o loop captação → plataforma.
//   • LEAD_WEBHOOK_URL  → POST do payload (CRM / Zapier / Make / planilha)
//   • RESEND_API_KEY    → e-mail para LEAD_TO_EMAIL (default contato@crivolegacy.com.br)
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

// Cria o lead direto no pipeline da plataforma (endpoint público de intake).
async function sendIntake(apiUrl: string, secret: string, data: Lead, email: string): Promise<boolean> {
  const s = (v: unknown) => (v == null || v === "" ? undefined : String(v));
  const notes = [
    data.colaboradores && `Colaboradores: ${data.colaboradores}`,
    data.lideres && `Líderes: ${data.lideres}`,
  ]
    .filter(Boolean)
    .join(" · ");
  try {
    const r = await fetch(`${apiUrl}/leads/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-intake-secret": secret },
      body: JSON.stringify({
        name: s(data.nome) ?? s(data.name) ?? "Lead sem nome",
        company: s(data.empresa),
        email,
        whatsapp: s(data.whatsapp),
        segment: s(data.segmento),
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
  const intakeSecret = process.env.LEAD_INTAKE_SECRET;

  const tasks: Promise<boolean>[] = [];
  if (platformApi && intakeSecret) tasks.push(sendIntake(platformApi, intakeSecret, data, email));
  if (webhook) tasks.push(sendWebhook(webhook, data));
  if (resendKey) tasks.push(sendEmail(resendKey, data, email));

  if (tasks.length === 0) {
    console.warn(
      "[lead] Nenhum provider configurado (PLATFORM_API_URL / RESEND_API_KEY / LEAD_WEBHOOK_URL). Lead recebido:",
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
