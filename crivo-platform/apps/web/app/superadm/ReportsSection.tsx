"use client";

import { useEffect, useState } from "react";
import type { GeneratedDocument } from "@crivo/types";
import {
  getReportEmission,
  getReportsOverview,
  listReportEmissions,
  reviewReportEmission,
  type ReportEmissionRow,
  type ReportsOverview,
} from "@/lib/admin-api";
import { printDocument } from "../plataforma/DocumentsPanel";

const STATUS_LABEL: Record<string, string> = {
  EMITIDA: "Aguardando revisão",
  REVISADA: "Revisada",
};
const STATUS_CLASS: Record<string, string> = {
  EMITIDA: "addx-status--EM_REVISAO",
  REVISADA: "addx-status--ATIVO",
};

/**
 * Motor 4 — Relatórios e Dossiês (R-001, mockup do cliente): repositório
 * cross-tenant das EMISSÕES oficiais (versão congelada + numerada + hash) e a
 * fila de revisão técnica da CRIVO. A emissão acontece no Portal do Cliente;
 * aqui o Super Admin consulta a versão exata emitida e a marca como revisada.
 */
export function ReportsSection() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [rows, setRows] = useState<ReportEmissionRow[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [ov, list] = await Promise.all([getReportsOverview(), listReportEmissions()]);
      setOverview(ov);
      setRows(list);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function openEmission(id: string) {
    setBusyId(id);
    try {
      const e = await getReportEmission(id);
      printDocument(e.content as GeneratedDocument);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao abrir a emissão.");
    } finally {
      setBusyId(null);
    }
  }

  async function review(id: string) {
    if (!window.confirm("Marcar esta emissão como revisada pela CRIVO? A ação fica registrada em auditoria.")) return;
    setBusyId(id);
    try {
      await reviewReportEmission(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao registrar a revisão.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (rows ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Relatórios e Dossiês</h1>
          <p className="page-sub">
            Repositório das emissões oficiais de todas as empresas. Cada emissão é uma versão
            congelada e numerada — o documento entregue nunca muda depois de emitido. A geração
            acontece no Portal do Cliente; aqui a CRIVO consulta e revisa.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando emissões…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar o repositório de emissões.</div>
      )}

      {status === "ok" && overview && rows && (
        <>
          <div className="kpi-grid crm-kpis" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            <div className="kpi"><span className="kpi__label">Emissões</span><strong className="kpi__value">{overview.total}</strong></div>
            <div className="kpi"><span className="kpi__label">Aguardando revisão</span><strong className="kpi__value">{overview.pendingReview}</strong></div>
            <div className="kpi"><span className="kpi__label">Revisadas</span><strong className="kpi__value">{overview.reviewed}</strong></div>
            <div className="kpi"><span className="kpi__label">Empresas com emissão</span><strong className="kpi__value">{overview.tenantsWithEmissions}</strong></div>
          </div>

          <div className="evo-filters">
            <select className="mod-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Status: Todos</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="addx-wrap" style={{ marginTop: 14 }}>
            <table className="addx-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Empresa</th>
                  <th>Versão</th>
                  <th>Método / Saída</th>
                  <th>Emitido por</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="addx-name">
                      <strong>{e.title}</strong>
                      <p>hash {e.contentHash.slice(0, 12)}…</p>
                    </td>
                    <td>{e.tenantName}</td>
                    <td><span className="sol-chip">v{e.emissionNumber}</span></td>
                    <td>{[e.method, e.technicalOutput].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{e.generatedBy || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className={`addx-status ${STATUS_CLASS[e.status] ?? ""}`}>{STATUS_LABEL[e.status] ?? e.status}</span>
                      {e.status === "REVISADA" && e.reviewedBy && (
                        <p className="evd-reason">por {e.reviewedBy}</p>
                      )}
                    </td>
                    <td className="addx-actions">
                      <button type="button" disabled={busyId === e.id} onClick={() => openEmission(e.id)}>
                        Ver documento
                      </button>
                      <button type="button" disabled={busyId === e.id || e.status === "REVISADA"} onClick={() => review(e.id)}>
                        Marcar revisada
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="addx-empty">
                      {statusFilter
                        ? "Nenhuma emissão com este status."
                        : "Nenhuma emissão oficial ainda. As emissões aparecem aqui quando o cliente usa “Emitir versão oficial” em Documentos e Dossiês no portal."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              Documento emitido <strong>mantém a versão usada na emissão</strong> — o conteúdo aqui é o
              congelado, com numeração sequencial e hash de integridade. A revisão da CRIVO não altera o
              conteúdo, apenas registra a conferência técnica (com trilha de auditoria). Pré-visualizações
              no portal continuam dinâmicas e não entram neste repositório.
            </p>
          </div>
        </>
      )}
    </>
  );
}
