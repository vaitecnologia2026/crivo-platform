import type { Metadata } from "next";
import { CollaboratorShell } from "./CollaboratorShell";

export const metadata: Metadata = {
  title: "Diagnóstico do colaborador · CRIVO",
  description: "Acesso ao diagnóstico da sua empresa (link individual).",
  robots: { index: false, follow: false },
};

// Mesmo racional de /q/<slug>: no empacotamento Capacitor (CAP_EXPORT=1) só há
// um shell estático (placeholder) e o token real é lido no cliente pela URL.
export function generateStaticParams() {
  if (process.env.CAP_EXPORT === "1") {
    return [{ token: "_" }];
  }
  return [];
}

// Link PÚBLICO individual /r/<token> — o funcionário confirma o CPF e responde.
export default function Page() {
  return <CollaboratorShell />;
}
