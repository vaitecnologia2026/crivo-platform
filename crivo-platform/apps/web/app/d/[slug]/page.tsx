import type { Metadata } from "next";
import { PublicDiagnosticShell } from "./PublicDiagnosticShell";

export const metadata: Metadata = {
  title: "Diagnóstico · CRIVO",
  description: "Aplicação anônima de diagnóstico organizacional.",
  robots: { index: false, follow: false },
};

// Mesmo desenho do /q/<slug>: no export estático (Capacitor) emitimos um shell
// placeholder e o slug real é lido no cliente a partir da URL.
export function generateStaticParams() {
  if (process.env.CAP_EXPORT === "1") {
    return [{ slug: "_" }];
  }
  return [];
}

// Página PÚBLICA (sem login) — link anônimo /d/<slug> dos diagnósticos do catálogo.
export default function Page() {
  return <PublicDiagnosticShell />;
}
