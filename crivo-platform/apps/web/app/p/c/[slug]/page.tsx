import type { Metadata } from "next";
import { PublicCampaignShell } from "./PublicCampaignShell";

export const metadata: Metadata = {
  title: "Campanha de Diagnóstico · CRIVO",
  description: "Convite para participar de uma campanha de diagnóstico CRIVO.",
  robots: { index: false, follow: false },
};

// Link PÚBLICO de navegador (QR Code). Sob CAP_EXPORT (export estático) o slug
// não é conhecido em build-time — emitimos um placeholder e o slug real é lido
// no cliente a partir da URL. No build web normal a rota é dinâmica.
export function generateStaticParams() {
  if (process.env.CAP_EXPORT === "1") {
    return [{ slug: "_" }];
  }
  return [];
}

export default function Page() {
  return <PublicCampaignShell />;
}
