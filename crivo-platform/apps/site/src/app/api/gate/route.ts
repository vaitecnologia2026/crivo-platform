import { NextResponse } from "next/server";
import { GATE_COOKIE, accessToken, gateSecret, signGate } from "@/lib/gate";

export const runtime = "nodejs";

// Valida o token de acesso no SERVIDOR e devolve um cookie httpOnly assinado.
// O token de comparação fica em SITE_ACCESS_TOKEN (env), nunca no bundle client.
export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    token = "";
  }

  if (!token || token !== accessToken()) {
    return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 401 });
  }

  const value = await signGate(gateSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
