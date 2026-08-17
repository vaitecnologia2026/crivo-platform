"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  listEngineActions,
  listEngineClientActivity,
  type EngineActionRow,
  type EngineCycleRow,
  type EngineDevolutivaRow,
} from "@/lib/admin-api";

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

/** Data curta pt-BR; "—" quando o cliente ainda não preencheu. */
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
/** Data + hora — usada na trilha, onde a ordem dentro do dia importa. */
function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}
/** Célula do detalhe: rótulo + o que a empresa informou (ou "—"). */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span style={{ display: "block", fontSize: 11, color: "var(--text-sec)", letterSpacing: ".02em" }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5 }}>{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

/**
 * Detalhe do que a EMPRESA preencheu no Portal para esta ação. A tabela mostra
 * a governança (quem, quando, status); aqui fica o conteúdo que o cliente
 * compôs — matriz de risco, inventário do fator, campos F2 e a última mexida na
 * trilha. Antes nada disso saía do Portal: o Motor só listava a ação.
 */
function ActionDetail({ r }: { r: EngineActionRow }) {
  // Mesma leitura do Portal: a classificação vale quando a empresa informou os
  // DOIS eixos; senão sobra o valor manual antigo, marcado como legado.
  const risco = r.riskDerived
    ? `${r.riskDerived} (Sev. ${r.severity} × Prob. ${r.probability})`
    : r.riskLevel
      ? `${r.riskLevel} · legado (sem severidade/probabilidade)`
      : null;
  const plano = r.planTitle
    ? r.planValidatedAt
      ? `${r.planTitle} · validado em ${fmtDate(r.planValidatedAt)}${r.planValidatedBy ? ` por ${r.planValidatedBy}` : ""}`
      : `${r.planTitle} · minuta (não validado)`
    : null;
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(13, 31, 60, 0.03)",
        borderRadius: 8,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "12px 18px",
      }}
    >
      <Field label="Plano de Evolução" value={plano} />
      <Field label="Risco técnico (matriz)" value={risco} />
      <Field label="Grupo exposto" value={r.exposedGroup} />
      <Field label="Área / processo" value={r.areaProcess} />
      <Field label="Medida que já existe" value={r.existingMeasure} />
      <Field label="Indicador de acompanhamento" value={r.indicator} />
      <Field label="Revisão de efetividade" value={r.reviewDate ? fmtDate(r.reviewDate) : null} />
      <Field
        label="Última alteração"
        value={
          r.lastChange
            ? `${r.lastChange.change}${r.lastChange.changedBy ? ` · ${r.lastChange.changedBy}` : ""} · ${fmtDateTime(r.lastChange.at)}`
            : fmtDateTime(r.updatedAt)
        }
      />
    </div>
  );
}

/**
 * O que o cliente registra no Portal e NÃO é ação — por isso não aparecia neste
 * Motor, que só lia `action_items`: os ciclos de diagnóstico que ele abre e
 * encerra (o encerramento congela os fatores e habilita o TPL-003) e o registro
 * de comunicação e devolutiva aos trabalhadores (TPL-002 §10).
 */
function ClientActivityPanel() {
  const [data, setData] = useState<{ cycles: EngineCycleRow[]; devolutivas: EngineDevolutivaRow[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    let alive = true;
    listEngineClientActivity()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ marginTop: 22 }}>
      <span className="crm-panel__title">Registrado pelo cliente no Portal</span>
      {status === "loading" && <p className="dash-state">Carregando ciclos e devolutivas…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o que o cliente registrou no Portal.
        </div>
      )}

      {status === "ok" && data && (
        <>
          <div className="addx-wrap" style={{ marginTop: 10 }}>
            <table className="addx-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Ciclo de diagnóstico</th>
                  <th>Empresa</th>
                  <th>Abertura</th>
                  <th>Encerramento</th>
                  <th>Método</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.cycles.map((c) => (
                  <tr key={c.id}>
                    <td className="addx-name"><strong>{c.label}</strong></td>
                    <td>{c.tenantName}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(c.openedAt)}{c.openedBy ? ` · ${c.openedBy}` : ""}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {c.closedAt ? `${fmtDate(c.closedAt)}${c.closedBy ? ` · ${c.closedBy}` : ""}` : "—"}
                    </td>
                    <td>
                      {c.method || "—"}
                      {c.methodologyVersion ? ` · ${c.methodologyVersion}` : ""}
                    </td>
                    <td>
                      <span className={`crm-pill crm-pill--${c.status === "ENCERRADO" ? "green" : "blue"}`}>
                        {c.status === "ENCERRADO" ? "Encerrado" : "Aberto"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.cycles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="addx-empty">
                      Nenhum ciclo de diagnóstico aberto pelos clientes até agora.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="addx-wrap" style={{ marginTop: 14 }}>
            <table className="addx-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Comunicação e devolutiva</th>
                  <th>Empresa</th>
                  <th>Data</th>
                  <th>Formato</th>
                  <th>Público</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {data.devolutivas.map((d) => (
                  <tr key={d.id}>
                    <td className="addx-name">
                      <strong>{d.topics || "Devolutiva registrada"}</strong>
                      {d.communicatedMeasures && <p>Medidas comunicadas: {d.communicatedMeasures}</p>}
                      {d.confirmedPoints && <p>Pontos confirmados: {d.confirmedPoints}</p>}
                    </td>
                    <td>{d.tenantName}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(d.date)}</td>
                    <td><span className="sol-chip">{d.format}</span></td>
                    <td>{d.audience || "—"}</td>
                    <td>{d.createdBy || "—"}</td>
                  </tr>
                ))}
                {data.devolutivas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="addx-empty">
                      Nenhuma devolutiva registrada pelos clientes até agora.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
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
  const [originFilter, setOriginFilter] = useState("");
  const [withoutEv, setWithoutEv] = useState(false);
  // Ação com o detalhe do Portal aberto. Uma por vez: a tabela é larga e o
  // detalhe é uma grade — abrir várias empilharia e tiraria a leitura da lista.
  const [openId, setOpenId] = useState<string | null>(null);

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

  // A4 — rótulo de origem EFETIVO: proveniência estruturada primeiro (nome do
  // diagnóstico do Motor), texto livre legado como fallback.
  const effectiveOrigin = (x: EngineActionRow) =>
    x.sourceInstrumentName ?? originLabel(x.origin, x.planSource);

  const originOptions = useMemo(() => {
    const set = new Set((data?.rows ?? []).map((x) => effectiveOrigin(x)));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (statusFilter) r = r.filter((x) => x.status === statusFilter);
    if (originFilter) r = r.filter((x) => effectiveOrigin(x) === originFilter);
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
  }, [data, q, statusFilter, originFilter, withoutEv]);

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
            <select className="mod-select" value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
              <option value="">Origem: Todas</option>
              {originOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
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
                  <Fragment key={r.id}>
                  <tr>
                    <td className="addx-name">
                      <strong>{r.action}</strong>
                      {r.point && <p>{r.point}</p>}
                      {/* Abre o que a EMPRESA preencheu no Portal para esta ação. */}
                      <button
                        type="button"
                        onClick={() => setOpenId((id) => (id === r.id ? null : r.id))}
                        style={{
                          marginTop: 4, padding: 0, border: 0, background: "none", cursor: "pointer",
                          font: "inherit", fontSize: 11.5, color: "var(--text-sec)", textDecoration: "underline",
                        }}
                        aria-expanded={openId === r.id}
                      >
                        {openId === r.id ? "ocultar o que o cliente preencheu" : "ver o que o cliente preencheu"}
                      </button>
                    </td>
                    <td>{r.tenantName}</td>
                    <td><span className="sol-chip">{effectiveOrigin(r)}</span></td>
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
                  {openId === r.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 12px 12px" }}>
                        <ActionDetail r={r} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="addx-empty">Nenhuma ação encontrada com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ciclos e devolutivas: o que o cliente registra no Portal fora da
              lista de ações. Carrega sozinho — se falhar, a tabela acima segue. */}
          <ClientActivityPanel />

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
