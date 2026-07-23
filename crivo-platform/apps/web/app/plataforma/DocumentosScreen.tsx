"use client";

import { useCallback, useEffect, useState } from "react";
import { getReportEmission, listReportEmissions, type ReportEmissionMeta } from "@/lib/api";
import { DocumentsPanel, printDocument } from "./DocumentsPanel";

/**
 * Relatórios e Dossiês — rota dedicada (mockup Portal do Cliente 22/07).
 * "Repositório versionado de comunicações, prévias, planos e dossiês técnicos."
 * Motor 4 (R-001): além da geração dinâmica (pré-visualização), o cliente
 * EMITE versões oficiais — congeladas, numeradas e com hash de integridade —
 * que ficam arquivadas aqui e podem ser reabertas na versão exata emitida.
 * A elegibilidade continua 100% no servidor (contrato → método × saída
 * técnica → gates do §9).
 */
export function DocumentosScreen() {
  const [emissions, setEmissions] = useState<ReportEmissionMeta[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listReportEmissions().then(setEmissions).catch(() => setEmissions([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reopen(id: string) {
    setBusyId(id);
    try {
      const e = await getReportEmission(id);
      printDocument(e.content);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao abrir a emissão.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Relatórios e Dossiês</h1>
          <p className="page-sub">
            Documentos técnicos do seu contrato — prévias, plano aprovado, dossiês (AEP/GRO-PGR) e
            relatórios de evolução. Pré-visualizações refletem o estado atual; a emissão oficial
            congela a versão entregue, com numeração e hash de integridade.
          </p>
        </div>
      </div>

      <DocumentsPanel onEmitted={load} />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card__head">
          <div>
            <h3>Emissões oficiais</h3>
            <span className="card__sub">
              Versões congeladas no momento da emissão — reabra exatamente o que foi entregue.
            </span>
          </div>
        </div>
        {emissions === null && <p className="card__sub">Carregando emissões…</p>}
        {emissions !== null && emissions.length === 0 && (
          <p className="card__sub">
            Nenhuma emissão oficial ainda. Use “Emitir versão oficial” em um documento disponível acima.
          </p>
        )}
        {emissions !== null && emissions.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Versão</th>
                  <th>Emitido em</th>
                  <th>Emitido por</th>
                  <th>Revisão CRIVO</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {emissions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>hash {e.contentHash.slice(0, 12)}…</div>
                    </td>
                    <td>v{e.emissionNumber}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{e.generatedBy || "—"}</td>
                    <td>
                      {e.status === "REVISADA"
                        ? `Revisada${e.reviewedAt ? ` em ${new Date(e.reviewedAt).toLocaleDateString("pt-BR")}` : ""}`
                        : "Aguardando revisão"}
                    </td>
                    <td>
                      <button
                        className="btn btn--outline-dark btn--sm"
                        disabled={busyId === e.id}
                        onClick={() => reopen(e.id)}
                      >
                        {busyId === e.id ? "Abrindo…" : "Abrir versão emitida"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
