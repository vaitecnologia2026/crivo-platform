import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// As perguntas do Diagnóstico Inicial da LP vêm do produto "Pré-Diagnóstico LP"
// (texto editável no super admin) — encaminha ao endpoint público da plataforma
// (GET /public/pre-diagnostic). Resiliente: se a API estiver indisponível, devolve
// { questions: null } e a LP usa as perguntas padrão embutidas (nunca trava o fluxo).

export async function GET() {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl) {
    // Sem esta env a LP fica ETERNAMENTE nas perguntas padrão — editar o MAPA no
    // Motor nunca reflete. Loga alto para não ser um fallback silencioso.
    console.warn("[pre-diagnostic] PLATFORM_API_URL ausente — LP usará perguntas padrão embutidas.");
    return NextResponse.json({ questions: null, source: "default" });
  }
  try {
    const r = await fetch(`${apiUrl}/public/pre-diagnostic`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!r.ok) {
      console.warn(`[pre-diagnostic] API ${r.status} — LP usará perguntas padrão embutidas.`);
      return NextResponse.json({ questions: null, source: "default" });
    }
    return NextResponse.json(await r.json());
  } catch (e) {
    console.warn("[pre-diagnostic] falha ao buscar a metodologia:", e instanceof Error ? e.message : e);
    return NextResponse.json({ questions: null, source: "default" });
  }
}
