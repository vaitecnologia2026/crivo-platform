import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Diagnóstico Inicial da LP → CRM do SUPER ADMIN (funil comercial da CRIVO).
// Encaminha o formulário + respostas ao endpoint público da plataforma
// (POST /public/diagnostic-lead), que calcula o pré-diagnóstico e cria o
// PlatformLead. Sem segredo (endpoint público rate-limited). Resiliente: se a
// plataforma não estiver configurada/indisponível, faz fallback por e-mail
// (Resend) e NUNCA trava o usuário — o lead não se perde.

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

async function sendToPlatform(apiUrl: string, data: Payload): Promise<boolean> {
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
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function sendEmail(apiKey: string, data: Payload): Promise<boolean> {
  const to = process.env.LEAD_TO_EMAIL ?? "contato@crivolegacy.com.br";
  const from = process.env.LEAD_FROM_EMAIL ?? "CRIVO Leads <onboarding@resend.dev>";
  const desafios = (data.challenges ?? [])
    .map((c) => (c === "Outro" && data.challengeOther ? `Outro: ${data.challengeOther}` : c))
    .join(", ");
  const linhas = [
    ["Nome", data.name],
    ["Cargo / Função", data.role],
    ["Empresa", data.company],
    ["E-mail", data.email],
    ["Telefone", data.phone],
    ["Segmento", data.segment],
    ["Funcionários", data.employeesCount],
    ["Principais desafios", desafios || undefined],
    ["Respostas", `${data.answers?.length ?? 0} respondidas`],
  ]
    .map(([k, v]) => `<strong>${k}:</strong> ${String(v ?? "—")}`)
    .join("<br>");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.email || undefined,
        subject: `Novo diagnóstico inicial · ${data.company ?? data.name ?? "lead"}`,
        html: `<h2>Diagnóstico Inicial (LP)</h2>${linhas}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let data: Payload;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  if (!data.name || !data.name.trim()) {
    return NextResponse.json({ ok: false, error: "Nome é obrigatório." }, { status: 400 });
  }

  const platformApi = process.env.PLATFORM_API_URL;
  const resendKey = process.env.RESEND_API_KEY;

  const tasks: Promise<boolean>[] = [];
  if (platformApi) tasks.push(sendToPlatform(platformApi, data));
  if (resendKey) tasks.push(sendEmail(resendKey, data));

  if (tasks.length === 0) {
    console.warn(
      "[diagnostic-lead] Nenhum provider configurado (PLATFORM_API_URL / RESEND_API_KEY). Lead recebido:",
      JSON.stringify({ ...data, answers: `${data.answers?.length ?? 0} respostas` }),
    );
    return NextResponse.json({ ok: true, warning: "no-provider" });
  }

  const results = await Promise.all(tasks);
  if (!results.some(Boolean)) {
    console.error("[diagnostic-lead] Todos os canais falharam.", JSON.stringify(data));
    return NextResponse.json(
      { ok: false, error: "Falha ao registrar. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
