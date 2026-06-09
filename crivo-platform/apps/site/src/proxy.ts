import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, gateSecret, verifyGate } from "@/lib/gate";

// Protege /lp e /design-system no SERVIDOR. Sem o cookie httpOnly assinado válido,
// o visitante é redirecionado ao gate (/). Substitui o antigo "guard" client-side
// (sessionStorage), que era trivialmente burlável pelo DevTools.
// (Convenção Next 16: arquivo "proxy", antigo "middleware".)
export async function proxy(req: NextRequest) {
  const ok = await verifyGate(gateSecret(), req.cookies.get(GATE_COOKIE)?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/lp/:path*", "/design-system/:path*"],
};
