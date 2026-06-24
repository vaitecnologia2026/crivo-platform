import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// As perguntas do Diagnóstico Inicial da LP vêm do produto "Pré-Diagnóstico LP"
// (texto editável no super admin) — encaminha ao endpoint público da plataforma
// (GET /public/pre-diagnostic). Resiliente: se a API estiver indisponível, devolve
// { questions: null } e a LP usa as perguntas padrão embutidas (nunca trava o fluxo).

export async function GET() {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl) return NextResponse.json({ questions: null, source: "default" });
  try {
    const r = await fetch(`${apiUrl}/public/pre-diagnostic`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ questions: null, source: "default" });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ questions: null, source: "default" });
  }
}
