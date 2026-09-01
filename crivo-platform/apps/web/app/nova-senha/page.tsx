import type { Metadata } from "next";
import { NovaSenhaShell } from "./NovaSenhaShell";

export const metadata: Metadata = {
  title: "Redefinir senha · CRIVO",
  description: "Recupere o acesso ao portal CRIVO.",
  // Página de credenciais: fora do índice dos buscadores.
  robots: { index: false, follow: false },
};

/**
 * Recuperação de senha em autoatendimento. Uma rota só, dois momentos:
 *  - sem `?t=` → pede o e-mail e dispara o link;
 *  - com `?t=<token>` → confirma a conta e grava a senha nova.
 *
 * O token vem na query (e não no path) de propósito: assim não é preciso
 * `generateStaticParams`, que no empacotamento Capacitor (CAP_EXPORT=1) exige
 * um placeholder — ver /q/[slug] e /r/[token].
 */
export default function Page() {
  return <NovaSenhaShell />;
}
