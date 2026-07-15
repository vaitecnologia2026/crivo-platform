"use client";

import { useEffect, useMemo, useState } from "react";
import { listEngineActions, type EngineActionRow } from "@/lib/admin-api";

const STATUS_LABEL: Record<string, string> = {
  SUGERIDA: "Sugerida",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  REAVALIADA: "Reavaliada",
};
const STATUS_TONE: Record<string, string> = {
  SUGERIDA: "lav",
  EM_REVISAO: "blue",
  APROVADA: "green",
  EM_ANDAMENTO: "blue",
  CONCLUIDA: "green",
  REAVALIADA: "gray",
};

/** Origem legível — o "template:xxx" e as origens de texto viram rótulo amigável. */
function originLabel(origin: string | null, planSource: string | null): string {
  if (!origin && planSource) return planSource;
  if (!origin) return "—";
  if (origin.startsWith("template:")) return "Biblioteca de Ações";
  const map: Record<string, string> = {
    autoavaliação: "Autoavaliação",
    escuta: "Escuta",
    questionário: "Questionário",
    observação: "Observação",
    parecer: "Parecer CRIVO",
    diagnostico: "Diagnóstico",
    ia: "IA",
  };
  return map[origin.toLowerCase()] ?? origin;
}

/**
 * Motor de Evolução (mockup do cliente 14/07): governança do Plano de Evolução
 * de TODOS os clientes. Ações com origem, responsável, prazo, evidência e status.
 * Leitura real (ActionItem cross-tenant). A composição detalhada é no Portal.
 */
export function EvolutionSection() {
  const [data, setData] = useState<{ stats: Record<string, number>; rows: EngineActionRow[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [withoutEv, setWithoutEv] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      setData(await listEngineActions());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (statusFilter) r = r.filter((x) => x.status === statusFilter);
    if (withoutEv) r = r.filter((x) => x.evidenceCount === 0);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (x) =>
          x.action.toLowerCase().includes(s) ||
          (x.responsible ?? "").toLowerCase().includes(s) ||
          x.tenantName.toLowerCase().includes(s),
      );
    }
    return r;
  }, [data, q, statusFilter, withoutEv]);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Motor de Evolução</h1>
          <p className="page-sub">
            Visão administrativa do Plano de Evolução dos clientes. Ações por origem, responsável, prazo,
            evidência e status — configuração, acompanhamento e governança.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando ações…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar as ações.</div>
      )}

      {status === "ok" && data && (
        <>
          <div className="kpi-grid crm-kpis" style={{ marginBottom: 20, gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
            <div className="kpi"><span className="kpi__label">Total de ações</span><strong className="kpi__value">{data.stats.total}</strong></div>
            <div className="kpi"><span className="kpi__label">Em andamento</span><strong className="kpi__value">{data.stats.emAndamento}</strong></div>
            <div className="kpi"><span className="kpi__label">Em revisão / IA</span><strong className="kpi__value">{data.stats.emRevisao}</strong></div>
            <div className="kpi"><span className="kpi__label">Atrasadas</span><strong className="kpi__value">{data.stats.atrasadas}</strong></div>
            <div className="kpi"><span className="kpi__label">Sem evidência</span><strong className="kpi__value">{data.stats.semEvidencia}</strong></div>
          </div>

          <div className="evo-filters">
            <input
              className="mod-select"
              placeholder="Buscar por ação, responsável ou empresa"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <select className="mod-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Status: Todos</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              className={`btn btn--sm ${withoutEv ? "sol-newbtn" : "btn--ghost"}`}
              onClick={() => setWithoutEv((v) => !v)}
            >
              Sem evidência
            </button>
          </div>

          <div className="addx-wrap" style={{ marginTop: 14 }}>
            <table className="addx-table">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Empresa</th>
                  <th>Origem</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Evidência</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="addx-name">
                      <strong>{r.action}</strong>
                      {r.point && <p>{r.point}</p>}
                    </td>
                    <td>{r.tenantName}</td>
                    <td><span className="sol-chip">{originLabel(r.origin, r.planSource)}</span></td>
                    <td>{r.responsible || "—"}</td>
                    <td style={{ whiteSpace: "nowrap", color: r.overdue ? "#c0392b" : undefined }}>
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "—"}
                      {r.overdue && " · atrasada"}
                    </td>
                    <td>
                      {r.evidenceCount > 0 ? (
                        <span className="addx-status addx-status--ATIVO">{r.evidenceCount} anexada(s)</span>
                      ) : (
                        <span className="evo-noev">{r.expectedEvidence ? `esperada: ${r.expectedEvidence}` : "sem evidência"}</span>
                      )}
                    </td>
                    <td>
                      <span className={`crm-pill crm-pill--${STATUS_TONE[r.status] ?? "gray"}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="addx-empty">Nenhuma ação encontrada com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              As ações são alimentadas por <strong>Diagnóstico</strong>, Consultor CRIVO, IA (validada) e
              recomendações. Aqui a CRIVO <strong>acompanha e audita</strong>; a composição detalhada das
              ações pelo cliente — inclusive NR-1 — ocorre no <strong>Portal do Cliente</strong>. Ação só é
              aprovada com responsável, prazo e evidência esperada.
            </p>
          </div>
        </>
      )}
    </>
  );
}
