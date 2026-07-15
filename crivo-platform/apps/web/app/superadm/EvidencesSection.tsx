"use client";

import { useEffect, useState } from "react";
import { listEngineEvidences, reviewEngineEvidence, type EngineEvidenceRow } from "@/lib/admin-api";

const STATUS_LABEL: Record<string, string> = {
  ENVIADA: "Enviada",
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  SUBSTITUIDA: "Substituída",
};
const STATUS_CLASS: Record<string, string> = {
  ENVIADA: "addx-status--EM_REVISAO",
  PENDENTE: "addx-status--AGUARDANDO_DADOS",
  APROVADA: "addx-status--ATIVO",
  REJEITADA: "evd-status--rej",
  SUBSTITUIDA: "evd-status--sub",
};

/**
 * Evidências (mockup do cliente 14/07): governança cross-tenant das evidências
 * enviadas pelos clientes. A CRIVO aprova, rejeita (com motivo) ou substitui.
 * Só evidência aprovada alimenta dossiês/relatórios. Leitura/ação reais.
 */
export function EvidencesSection() {
  const [data, setData] = useState<{ stats: Record<string, number>; rows: EngineEvidenceRow[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      setData(await listEngineEvidences());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function review(id: string, action: "approve" | "reject" | "supersede") {
    let reason: string | undefined;
    if (action === "reject") {
      const r = window.prompt("Motivo da rejeição (obrigatório):");
      if (!r?.trim()) return;
      reason = r.trim();
    }
    if (action === "supersede" && !window.confirm("Marcar como substituída? O cliente deverá enviar uma nova evidência.")) return;
    setBusyId(id);
    try {
      await reviewEngineEvidence(id, action, reason);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao registrar a revisão.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = (data?.rows ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Evidências</h1>
          <p className="page-sub">
            Visão administrativa e de governança. Aprovação, rejeição (com motivo) e substituição das
            evidências enviadas pelos clientes. O envio detalhado pertence ao Portal do Cliente.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando evidências…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar as evidências.</div>
      )}

      {status === "ok" && data && (
        <>
          <div className="kpi-grid crm-kpis" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            <div className="kpi"><span className="kpi__label">Total</span><strong className="kpi__value">{data.stats.total}</strong></div>
            <div className="kpi"><span className="kpi__label">Aprovadas</span><strong className="kpi__value">{data.stats.aprovadas}</strong></div>
            <div className="kpi"><span className="kpi__label">Pendentes</span><strong className="kpi__value">{data.stats.pendentes}</strong></div>
            <div className="kpi"><span className="kpi__label">Rejeitadas</span><strong className="kpi__value">{data.stats.rejeitadas}</strong></div>
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
                  <th>Tipo</th>
                  <th>Ação vinculada</th>
                  <th>Empresa</th>
                  <th>Autor</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td><span className="sol-chip">{e.kind}</span></td>
                    <td className="addx-name">
                      <strong>{e.title}</strong>
                      {e.linkedAction && <p>{e.linkedAction}</p>}
                    </td>
                    <td>{e.tenantName}</td>
                    <td>{e.author || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className={`addx-status ${STATUS_CLASS[e.status] ?? ""}`}>{STATUS_LABEL[e.status] ?? e.status}</span>
                      {e.status === "REJEITADA" && e.rejectionReason && (
                        <p className="evd-reason">Motivo: {e.rejectionReason}</p>
                      )}
                    </td>
                    <td className="addx-actions">
                      <button type="button" disabled={busyId === e.id || e.status === "APROVADA"} onClick={() => review(e.id, "approve")}>
                        Aprovar
                      </button>
                      <button type="button" disabled={busyId === e.id || e.status === "REJEITADA"} onClick={() => review(e.id, "reject")}>
                        Rejeitar
                      </button>
                      <button type="button" disabled={busyId === e.id} onClick={() => review(e.id, "supersede")}>
                        Substituir
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="addx-empty">Nenhuma evidência {statusFilter ? "com este status" : "registrada"}.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              Rejeição exige <strong>motivo</strong>. Substituição mantém histórico. Evidência aprovada
              alimenta <strong>Dossiês, Relatórios e Inteligência CRIVO</strong>. O envio detalhado das
              evidências pelo cliente ocorre no Portal do Cliente; aqui o Super Admin acompanha e audita.
            </p>
          </div>
        </>
      )}
    </>
  );
}
