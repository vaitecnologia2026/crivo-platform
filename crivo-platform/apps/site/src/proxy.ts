import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GATE DE ACESSO REMOVIDO (a pedido): as páginas abrem direto, sem "Acesso
// restrito". A raiz "/" passa a ir direto para a landing (/lp).
//
// Para REATIVAR o gate, restaure a verificação do cookie httpOnly:
//   import { GATE_COOKIE, gateSecret, verifyGate } from "@/lib/gate";
//   const ok = await verifyGate(gateSecret(), req.cookies.get(GATE_COOKIE)?.value);
//   if (!ok) { const u = req.nextUrl.clone(); u.pathname = "/"; return NextResponse.redirect(u); }
// (a lógica em src/lib/gate.ts e o handler /api/gate continuam no repo.)
// (Convenção Next 16: arquivo "proxy", antigo "middleware".)
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname === "/") {
    url.pathname = "/lp";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/lp/:path*", "/design-system/:path*"],
};
