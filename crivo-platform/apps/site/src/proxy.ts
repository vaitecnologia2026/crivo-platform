import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GATE DE ACESSO REMOVIDO (a pedido): as páginas abrem direto, sem "Acesso
// restrito". A raiz "/" é reescrita para a landing (/lp), servida na URL limpa.
// Os arquivos do antigo gate (page.tsx da raiz, lib/gate.ts, /api/gate,
// gate.module.css) foram removidos — exibiam a marca "VAI" e estavam inalcançáveis.
// (Convenção Next 16: arquivo "proxy", antigo "middleware".)
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname === "/") {
    url.pathname = "/lp";
    // rewrite (não redirect): serve a landing NA raiz, URL fica limpa
    // (crivolegacy.com.br/ mostra a LP sem virar /lp). Funciona como site.
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/lp/:path*", "/design-system/:path*"],
};
