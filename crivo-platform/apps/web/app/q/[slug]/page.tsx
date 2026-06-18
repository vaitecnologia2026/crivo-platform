import type { Metadata } from "next";
import { PublicPsychosocialForm } from "./PublicPsychosocialForm";

export const metadata: Metadata = {
  title: "Questionário Psicossocial · CRIVO",
  description: "Pesquisa anônima de fatores psicossociais no trabalho (NR-1).",
  robots: { index: false, follow: false },
};

// Página PÚBLICA (sem login) — link anônimo /q/<slug>. Acesso típico por QR Code.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPsychosocialForm slug={slug} />;
}
