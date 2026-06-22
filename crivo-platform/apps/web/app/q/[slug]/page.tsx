import type { Metadata } from "next";
import { PublicPsychosocialShell } from "./PublicPsychosocialShell";

export const metadata: Metadata = {
  title: "Questionário Psicossocial · CRIVO",
  description: "Pesquisa anônima de fatores psicossociais no trabalho (NR-1).",
  robots: { index: false, follow: false },
};

// No empacotamento Capacitor (CAP_EXPORT=1) usamos `output: 'export'`, que não
// consegue pré-renderizar slugs de runtime. Esta rota é um link PÚBLICO de
// navegador (QR Code) e não faz parte da experiência in-app — por isso emitimos
// apenas um shell estático (placeholder) e o slug real é lido no cliente a
// partir da URL. No build web normal (sem CAP_EXPORT) o comportamento é o de
// sempre: a rota é dinâmica e atende qualquer /q/<slug>.
export function generateStaticParams() {
  if (process.env.CAP_EXPORT === "1") {
    return [{ slug: "_" }];
  }
  return [];
}

// Página PÚBLICA (sem login) — link anônimo /q/<slug>. Acesso típico por QR Code.
// O shell lê o slug no cliente, mantendo compatibilidade com export estático.
export default function Page() {
  return <PublicPsychosocialShell />;
}
