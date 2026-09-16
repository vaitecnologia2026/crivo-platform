// Monta o ExportContext (cabeçalho das exportações XLSX/PDF) a partir de
// dados REAIS do tenant, no lugar dos selects de empresa/unidade/ciclo do
// protótipo:
//   - empresa      ← GET /me/organization (name; razão social só se não houver nome)
//   - unidade      ← OrganizationData.establishment (cabeçalho do Dossiê), se preenchido
//   - ciclo        ← ciclo de diagnóstico ABERTO (GET /action-plans/cycles), se houver
//   - contratação  ← solução contratada (GET /me/diagnostic-context), se houver
// O que não existe fica de fora do cabeçalho — nunca é inventado. Ciclo e
// contratação são módulos gateados na API: sem acesso, a chamada falha e o
// campo simplesmente não entra (a empresa é o único campo obrigatório).
import { useEffect, useState } from "react";

import { getDiagnosticContext, getMyOrganization, listCycles } from "./api";
import type { ExportContext } from "./exports-core";

/** Versão sem React (para código vanilla do Plataforma.tsx ou handlers avulsos). */
export async function carregarExportContext(): Promise<ExportContext> {
  const [org, cycles, diag] = await Promise.all([
    getMyOrganization(),
    listCycles().catch(() => null),
    getDiagnosticContext().catch(() => null),
  ]);

  const aberto = cycles?.find((c) => c.status === "ABERTO") ?? null;
  // Várias soluções contratadas → lista todas; senão o nome da principal.
  const contract = diag?.contracted?.length
    ? diag.contracted.map((c) => c.productName).join(" + ")
    : (diag?.productName ?? null);

  return {
    company: org.name?.trim() || org.legalName?.trim() || "Empresa",
    unit: org.establishment?.trim() || null,
    cycle: aberto?.label?.trim() || null,
    contract: contract?.trim() || null,
  };
}

/** Hook para telas React: `null` enquanto carrega ou se /me/organization
 *  falhar — a tela deve desabilitar o botão de exportar nesse estado em vez
 *  de exportar com cabeçalho vazio. */
export function useExportContext(): ExportContext | null {
  const [ctx, setCtx] = useState<ExportContext | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarExportContext()
      .then((c) => { if (vivo) setCtx(c); })
      .catch(() => { if (vivo) setCtx(null); });
    return () => { vivo = false; };
  }, []);
  return ctx;
}
