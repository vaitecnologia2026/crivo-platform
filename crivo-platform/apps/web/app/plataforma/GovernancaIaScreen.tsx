"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AI_DECISIONS,
  AI_DECISION_LABEL,
  AI_DECISION_TO_STATUS,
  AI_INCIDENT_SEVERITIES,
  AI_INCIDENT_SEVERITY_LABEL,
  AI_INCIDENT_STATUS_LABEL,
  AI_LINK_KIND_LABEL,
  AI_POLICY_STATUSES,
  AI_POLICY_STATUS_LABEL,
  AI_RISK_LABEL,
  AI_RISK_LEVELS,
  AI_USE_CASE_STATUSES,
  AI_USE_CASE_STATUS_LABEL,
  type ActionPlanData,
  type AiDecision,
  type AiGovernanceSummary,
  type AiIncidentData,
  type AiIncidentSeverity,
  type AiPolicyData,
  type AiPolicyStatus,
  type AiReviewEntry,
  type AiRiskLevel,
  type AiUseCaseData,
  type AiUseCaseDecisionData,
  type AiUseCaseDetail,
  type AiUseCaseStatus,
  type UpsertAiUseCaseRequest,
} from "@crivo/types";
import {
  ApiError,
  addAiUseCaseLink,
  createAiIncident,
  createAiPolicy,
  createAiUseCase,
  decideAiUseCase,
  getAiGovernanceSummary,
  getAiUseCase,
  getMyPermissions,
  listActionPlans,
  listAiDecisions,
  listAiIncidents,
  listAiPolicies,
  listAiReviews,
  listAiUseCases,
  removeAiUseCaseLink,
  updateAiIncident,
  updateAiPolicy,
  updateAiUseCase,
} from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext, type ExportSection, type ExportSheet } from "@/lib/exports";
import { IconClose } from "./Icons";

/**
 * Programas › Governança de IA (rota `govia`) — layout do protótipo Lovable
 * (6 abas: Visão Geral · Casos de Uso · Riscos e Controles · Aprovações ·
 * Incidentes e Revisões · Políticas e Evidências), com dados REAIS do módulo
 * /ai-governance/* (AiUseCase, AiUseCaseDecision, AiUseCaseLink, AiIncident,
 * AiPolicy — data plane da empresa). Nenhum caso/política/incidente demo.
 *
 * É o serviço do CLIENTE para governar as próprias IAs: a classificação de
 * risco é julgamento da empresa (avaliação não certificadora, sem motor
 * CRIVO); a decisão humana (Aprovar/Condicionar/Restringir/Rejeitar) exige
 * justificativa e fica na trilha do caso + auditoria. Escrita só com a
 * permissão govia:manage (lida de /me/permissions, padrão ParecerScreen).
 */

type Tab = "visao" | "casos" | "riscos" | "aprov" | "incid" | "pols";
const TABS: Array<[Tab, string]> = [
  ["visao", "Visão Geral"],
  ["casos", "Casos de Uso"],
  ["riscos", "Riscos e Controles"],
  ["aprov", "Aprovações"],
  ["incid", "Incidentes e Revisões"],
  ["pols", "Políticas e Evidências"],
];

type LoadStatus = "loading" | "error" | "ok";
const moduloDesligado = (err: unknown) => err instanceof ApiError && err.status === 403;

/** Carrega um recurso; `data` null + status ok = módulo não liberado (403 do ModuleGuard). */
function useRecurso<T>(loader: () => Promise<T>, tick: number): { data: T | null; status: LoadStatus; erro: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); setErro(null); } })
      .catch((err) => {
        if (!alive) return;
        if (moduloDesligado(err)) { setData(null); setStatus("ok"); return; }
        setErro(err instanceof Error ? err.message : "Falha ao carregar.");
        setStatus("error");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return { data, status, erro };
}

// ── Ícones SVG de traço (regra do cliente: nunca emoji) ──
const Svg = ({ children, size = 14 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-0.15em", flexShrink: 0 }}>
    {children}
  </svg>
);
const IconShield = () => (<Svg><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Svg>);
const IconDownload = () => (<Svg><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>);
const IconFile = () => (<Svg><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>);
const IconPlus = () => (<Svg><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
const IconEye = () => (<Svg><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
const IconRefresh = () => (<Svg><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>);
const IconInventory = () => (<Svg size={24}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></Svg>);

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const toInputDate = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Cor do chip por status (mesma leitura do protótipo: destrutivo p/ Restrito/Rejeitado). */
function statusPill(s: AiUseCaseStatus): string {
  if (s === "RESTRITO" || s === "REJEITADO") return "pill pill--danger";
  if (s === "APROVADO") return "pill pill--gold";
  return "pill";
}
function riskPill(r: AiRiskLevel): string {
  return r === "ALTO" ? "pill pill--danger" : r === "MEDIO" ? "pill pill--gold" : "pill";
}
const goToRoute = (route: string) => document.querySelector<HTMLElement>(`[data-route="${route}"]`)?.click();

export function GovernancaIaScreen() {
  const [tab, setTab] = useState<Tab>("visao");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const [canManage, setCanManage] = useState(false);
  const exportCtx = useExportContext();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const summary = useRecurso<AiGovernanceSummary>(getAiGovernanceSummary, tick);
  const casos = useRecurso<AiUseCaseData[]>(() => listAiUseCases(), tick);
  const decisoes = useRecurso<AiUseCaseDecisionData[]>(listAiDecisions, tick);
  const incidentes = useRecurso<AiIncidentData[]>(listAiIncidents, tick);
  const politicas = useRecurso<AiPolicyData[]>(listAiPolicies, tick);
  const revisoes = useRecurso<AiReviewEntry[]>(() => listAiReviews("all"), tick);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [novoCaso, setNovoCaso] = useState(false);
  const [editando, setEditando] = useState<AiUseCaseData | null>(null);

  useEffect(() => {
    let alive = true;
    getMyPermissions()
      .then((perms) => { if (alive) setCanManage(perms.includes("govia:manage")); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const semModulo = summary.status === "ok" && !summary.data;
  const loading = [summary, casos, decisoes, incidentes, politicas, revisoes].some((r) => r.status === "loading");

  // ── Exportação (helper compartilhado). Só o que está na tela. ──
  function buildSheets(): ExportSheet[] {
    const rows = (casos.data ?? []).map((c) => ({
      ID: c.code, Nome: c.name, Área: c.area, Responsável: c.ownerName, Tecnologia: c.technology,
      "Risco inerente": AI_RISK_LABEL[c.inherentRisk], "Risco residual": AI_RISK_LABEL[c.residualRisk],
      Status: AI_USE_CASE_STATUS_LABEL[c.status], Aprovador: c.lastDecision?.decidedByName ?? "—",
      "Próxima revisão": fmtDate(c.nextReviewAt),
    }));
    const pols = (politicas.data ?? []).map((p) => ({ Título: p.title, Status: AI_POLICY_STATUS_LABEL[p.status], Versão: p.version, Data: fmtDate(p.publishedAt ?? p.updatedAt) }));
    const incs = (incidentes.data ?? []).map((i) => ({ Caso: i.useCaseCode ?? "—", Severidade: AI_INCIDENT_SEVERITY_LABEL[i.severity], Data: fmtDate(i.occurredAt), Descrição: i.description, Status: AI_INCIDENT_STATUS_LABEL[i.status] }));
    return [
      { name: "Casos de uso", rows },
      { name: "Políticas", rows: pols },
      { name: "Incidentes", rows: incs },
    ];
  }
  async function handleExport(kind: "xlsx" | "pdf") {
    if (!exportCtx) return;
    setExporting(kind);
    try {
      const sheets = buildSheets();
      if (kind === "xlsx") await exportXLSX("crivo-governanca-ia", sheets, exportCtx);
      else await exportPDF("crivo-governanca-ia", "Governança de IA · Casos e políticas", sheets.slice(0, 2).map((s): ExportSection => ({ heading: s.name, rows: s.rows })), exportCtx);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Governança de IA</h1>
          <p className="page-sub">Ciclo: assessment → caso de uso → risco → controle → decisão humana → evidência → relatório/revisão.</p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill" title="A classificação de risco é julgamento da sua empresa — não é score CRIVO nem certificação." style={{ gap: 6 }}>
            <IconShield /> Referências de governança consideradas · avaliação não certificadora
          </span>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("xlsx")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar casos, políticas e incidentes em Excel"}>
            <IconDownload /> {exporting === "xlsx" ? "Gerando…" : "XLSX"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("pdf")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar casos e políticas em PDF"}>
            <IconFile /> {exporting === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={reload} disabled={loading} title="Recarregar">
            <IconRefresh /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {summary.status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar a Governança de IA. {summary.erro}{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={reload}>Tentar novamente</button>
        </div>
      )}

      {semModulo && (
        <div className="dash-state">
          O módulo Governança de IA não está ativo para a sua empresa. Os casos de uso, riscos, decisões, incidentes e políticas aparecem aqui quando o módulo for liberado no contrato (adicional Governança de IA).
        </div>
      )}

      {!semModulo && summary.status !== "error" && (
        <>
          <div className="seg" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" className={`seg__btn${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === "visao" && <VisaoTab summary={summary} incidentes={incidentes} />}
          {tab === "casos" && (
            <CasosTab
              casos={casos}
              summary={summary.data}
              canManage={canManage}
              onOpen={(id) => setSelecionadoId(id)}
              onNovo={() => setNovoCaso(true)}
            />
          )}
          {tab === "riscos" && <RiscosTab casos={casos} canManage={canManage} onNovo={() => setNovoCaso(true)} />}
          {tab === "aprov" && <AprovacoesTab casos={casos} decisoes={decisoes} onOpen={(id) => setSelecionadoId(id)} />}
          {tab === "incid" && (
            <IncidentesTab incidentes={incidentes} revisoes={revisoes} casos={casos.data ?? []} canManage={canManage} onChanged={reload} onOpen={(id) => setSelecionadoId(id)} />
          )}
          {tab === "pols" && <PoliticasTab politicas={politicas} casos={casos.data ?? []} canManage={canManage} onChanged={reload} />}
        </>
      )}

      {selecionadoId && (
        <CasoDrawer
          id={selecionadoId}
          canManage={canManage}
          onClose={() => setSelecionadoId(null)}
          onChanged={reload}
          onEdit={(c) => { setSelecionadoId(null); setEditando(c); }}
        />
      )}
      {(novoCaso || editando) && (
        <CasoForm
          initial={editando}
          areas={summary.data?.areas ?? []}
          onClose={() => { setNovoCaso(false); setEditando(null); }}
          onSaved={() => { setNovoCaso(false); setEditando(null); reload(); }}
        />
      )}
    </>
  );
}

// ── Visão Geral ────────────────────────────────────────────────────────────

function VisaoTab({ summary, incidentes }: { summary: ReturnType<typeof useRecurso<AiGovernanceSummary>>; incidentes: ReturnType<typeof useRecurso<AiIncidentData[]>> }) {
  const s = summary.data;
  if (summary.status === "loading" || !s) return <p className="dash-state">Carregando indicadores…</p>;
  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__label" title="Casos de uso cadastrados no inventário (qualquer status)">Casos catalogados</span>
          <strong className="kpi__value">{s.useCases}</strong>
          <span className="card__hint">{s.byStatus.RASCUNHO} em rascunho · {s.byStatus.EM_AVALIACAO} em avaliação</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Aprovados</span>
          <strong className="kpi__value">{s.approved}</strong>
          <span className="card__hint">{s.byStatus.CONDICIONADO} condicionado(s) · {s.byStatus.RESTRITO} restrito(s) · {s.byStatus.REJEITADO} rejeitado(s)</span>
        </div>
        <div className="kpi">
          <span className="kpi__label" title="Casos cuja avaliação de risco inerente (antes dos controles) é Alto — classificação da própria empresa">Alto risco inerente</span>
          <strong className="kpi__value">{s.highInherentRisk}</strong>
          <span className="card__hint">{s.byResidualRisk.ALTO} com risco residual alto após controles</span>
        </div>
        <div className="kpi">
          <span className="kpi__label" title="Incidentes com data de ocorrência nos últimos 12 meses">Incidentes (12m)</span>
          <strong className="kpi__value">{s.incidents12m}</strong>
          <span className="card__hint">{s.openIncidents} em aberto · {s.reviewsOverdue} revisão(ões) vencida(s)</span>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><div><h3>Arquitetura CRIVO</h3><span className="card__sub">Quem faz o quê na governança de IA.</span></div></div>
          <p style={{ fontSize: 14, color: "var(--text-sec)", lineHeight: 1.6, margin: 0 }}>
            O Super Admin CRIVO configura e governa a tecnologia da plataforma (metodologias, versões, políticas do motor). O Portal do Cliente opera as
            jornadas corporativas — aqui, a sua empresa inventaria e decide sobre as PRÓPRIAS IAs. A Área do Líder executa Pocket, Registro de Decisão,
            ICD individual e Mentor contextual — dados privados que não trafegam para o Portal. A CRIVO acompanha este programa; a decisão é sempre humana e sua.
          </p>
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Situação do programa</h3><span className="card__sub">Leitura real do inventário — nada demonstrativo.</span></div></div>
          {s.useCases === 0 ? (
            <p className="dash-state" style={{ margin: 0 }}>Nenhum caso de uso cadastrado. Comece pela aba Casos de Uso → Novo caso.</p>
          ) : (
            <table className="data-table">
              <tbody>
                <tr><td>Áreas com IA inventariada</td><td><strong>{s.areas.length}</strong> <span className="card__hint">{s.areas.join(" · ")}</span></td></tr>
                <tr><td>Decisões humanas registradas</td><td><strong>{s.decisions}</strong></td></tr>
                <tr><td>Revisões nos próximos 30 dias</td><td><strong>{s.reviewsNext30d}</strong></td></tr>
                <tr><td>Políticas</td><td><strong>{s.policies.approved}</strong> aprovada(s) de {s.policies.total}</td></tr>
                <tr><td>Incidentes registrados (12m)</td><td><strong>{incidentes.data?.length ?? s.incidents12m}</strong></td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Casos de Uso ───────────────────────────────────────────────────────────

function CasosTab({ casos, summary, canManage, onOpen, onNovo }: {
  casos: ReturnType<typeof useRecurso<AiUseCaseData[]>>;
  summary: AiGovernanceSummary | null;
  canManage: boolean;
  onOpen: (id: string) => void;
  onNovo: () => void;
}) {
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroRisco, setFiltroRisco] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const lista = useMemo(() => casos.data ?? [], [casos.data]);
  const areas = useMemo(() => summary?.areas ?? Array.from(new Set(lista.map((c) => c.area))), [summary, lista]);
  const filtrados = useMemo(() => lista.filter((c) =>
    (filtroArea === "todas" || c.area === filtroArea) &&
    (filtroRisco === "todos" || c.inherentRisk === filtroRisco) &&
    (filtroStatus === "todos" || c.status === filtroStatus),
  ), [lista, filtroArea, filtroRisco, filtroStatus]);

  if (casos.status === "loading") return <p className="dash-state">Carregando inventário…</p>;
  if (casos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os casos de uso. {casos.erro}</div>;

  if (lista.length === 0) {
    return (
      <div className="dash-empty">
        <div className="dash-empty__ic"><IconInventory /></div>
        <h3 className="dash-empty__title">Nenhum caso de uso cadastrado</h3>
        <p className="dash-empty__sub">
          O inventário nasce vazio. Cadastre cada IA em uso ou em avaliação na sua empresa (finalidade, área, responsável, tecnologia, dados, público, riscos e controles) para então registrar a decisão humana.
        </p>
        {canManage ? (
          <button className="btn btn--gold btn--sm" onClick={onNovo}><IconPlus /> Novo caso</button>
        ) : (
          <span className="card__hint">Cadastro disponível para quem tem a permissão “Gerir Governança de IA”.</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginBottom: 14 }}>
        <label className="prod-field" style={{ minWidth: 160 }}>
          <span>Área</span>
          <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
            <option value="todas">Todas as áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="prod-field" style={{ minWidth: 150 }}>
          <span>Risco inerente</span>
          <select value={filtroRisco} onChange={(e) => setFiltroRisco(e.target.value)}>
            <option value="todos">Todos os riscos</option>
            {AI_RISK_LEVELS.map((r) => <option key={r} value={r}>{AI_RISK_LABEL[r]}</option>)}
          </select>
        </label>
        <label className="prod-field" style={{ minWidth: 160 }}>
          <span>Status</span>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {AI_USE_CASE_STATUSES.map((s) => <option key={s} value={s}>{AI_USE_CASE_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        {canManage && (
          <button className="btn btn--outline-dark btn--sm" onClick={onNovo}><IconPlus /> Novo caso</button>
        )}
      </div>

      <div className="grid grid--2">
        {filtrados.map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: 0 }}>
            <div className="card__head" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <span className="card__hint" style={{ fontFamily: "var(--font-mono, monospace)" }}>{c.code} · {c.area}</span>
                <h3 style={{ marginTop: 2 }}>{c.name}</h3>
                <span className="card__sub">{c.purpose}</span>
              </div>
              <span className={statusPill(c.status)} style={{ flexShrink: 0 }}>{AI_USE_CASE_STATUS_LABEL[c.status]}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <span className={riskPill(c.inherentRisk)} style={{ fontSize: 11 }}>Risco inerente: {AI_RISK_LABEL[c.inherentRisk]}</span>
              <span className={riskPill(c.residualRisk)} style={{ fontSize: 11 }}>Residual: {AI_RISK_LABEL[c.residualRisk]}</span>
              <span className="pill" style={{ fontSize: 11 }}>Resp.: {c.ownerName}</span>
              {c.incidentsCount > 0 && <span className="pill pill--danger" style={{ fontSize: 11 }}>{c.incidentsCount} incidente(s)</span>}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn--ghost-dark btn--sm" onClick={() => onOpen(c.id)}><IconEye /> Abrir detalhes</button>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <p className="dash-state" style={{ gridColumn: "1 / -1" }}>Nenhum caso encontrado para os filtros aplicados.</p>
        )}
      </div>
    </>
  );
}

// ── Riscos e Controles (matriz inerente × residual) ────────────────────────

function RiscosTab({ casos, canManage, onNovo }: { casos: ReturnType<typeof useRecurso<AiUseCaseData[]>>; canManage: boolean; onNovo: () => void }) {
  const lista = useMemo(() => casos.data ?? [], [casos.data]);
  const matriz = useMemo(() => {
    const m: Record<AiRiskLevel, Record<AiRiskLevel, number>> = { ALTO: { ALTO: 0, MEDIO: 0, BAIXO: 0 }, MEDIO: { ALTO: 0, MEDIO: 0, BAIXO: 0 }, BAIXO: { ALTO: 0, MEDIO: 0, BAIXO: 0 } };
    for (const c of lista) m[c.inherentRisk][c.residualRisk] += 1;
    return m;
  }, [lista]);
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Matriz de risco (inerente × residual)</h3>
          <span className="card__sub">Distribuição dos casos por risco inerente (antes dos controles) e residual (depois). Fonte: inventário da sua empresa — classificação própria, não certificadora.</span>
        </div>
      </div>
      {casos.status === "loading" && <p className="dash-state">Carregando…</p>}
      {casos.status === "ok" && lista.length === 0 && (
        <div className="dash-state">
          Nenhum caso de uso cadastrado — a matriz é montada a partir dos riscos informados em cada caso.
          {canManage && <button className="btn btn--outline-dark btn--sm" onClick={onNovo}>Novo caso</button>}
        </div>
      )}
      {lista.length > 0 && (
        <>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table className="data-table" style={{ maxWidth: 520 }}>
              <thead><tr><th>Inerente ↓ · Residual →</th>{AI_RISK_LEVELS.map((r) => <th key={r}>{AI_RISK_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                {AI_RISK_LEVELS.map((i) => (
                  <tr key={i}>
                    <td><span className={riskPill(i)}>{AI_RISK_LABEL[i]}</span></td>
                    {AI_RISK_LEVELS.map((r) => <td key={r}><strong>{matriz[i][r]}</strong></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Caso</th><th>Inerente</th><th>Residual</th><th>Controles principais</th></tr></thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>{c.code}</td>
                    <td>{c.name}</td>
                    <td><span className={riskPill(c.inherentRisk)}>{AI_RISK_LABEL[c.inherentRisk]}</span></td>
                    <td><span className={riskPill(c.residualRisk)}>{AI_RISK_LABEL[c.residualRisk]}</span></td>
                    <td style={{ color: "var(--text-sec)" }}>{c.controls.length ? c.controls.join(" · ") : "— nenhum controle informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Aprovações ─────────────────────────────────────────────────────────────

function AprovacoesTab({ casos, decisoes, onOpen }: {
  casos: ReturnType<typeof useRecurso<AiUseCaseData[]>>;
  decisoes: ReturnType<typeof useRecurso<AiUseCaseDecisionData[]>>;
  onOpen: (id: string) => void;
}) {
  const lista = (casos.data ?? []).filter((c) => c.status !== "RASCUNHO");
  const trilha = decisoes.data ?? [];
  return (
    <>
      {casos.status === "ok" && lista.length === 0 && (
        <p className="dash-state">Nenhum caso submetido à avaliação ainda. Um caso entra aqui quando sai do rascunho (Em avaliação) ou recebe uma decisão humana.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {lista.map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span className="card__hint" style={{ fontFamily: "var(--font-mono, monospace)" }}>{c.code}</span>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <span className="card__sub">
                Aprovador: {c.lastDecision?.decidedByName ?? "—"} · Decidido em: {fmtDate(c.lastDecision?.decidedAt)} · Próxima revisão: {fmtDate(c.nextReviewAt)}
              </span>
              <div style={{ fontSize: 13, marginTop: 4 }}>{c.justification ?? (c.status === "EM_AVALIACAO" ? "Aguardando decisão humana." : "—")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={statusPill(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</span>
              <button className="btn btn--ghost-dark btn--sm" onClick={() => onOpen(c.id)}>Abrir</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card__head"><div><h3>Trilha de decisões</h3><span className="card__sub">Cada decisão humana fica registrada com quem decidiu, quando e por quê — nunca é editada, só sucedida por outra.</span></div></div>
        {decisoes.status === "loading" && <p className="dash-state">Carregando…</p>}
        {decisoes.status === "ok" && trilha.length === 0 && <p className="dash-state" style={{ margin: 0 }}>Nenhuma decisão registrada ainda.</p>}
        {trilha.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Quando</th><th>Caso</th><th>Decisão</th><th>Quem</th><th>Justificativa</th></tr></thead>
              <tbody>
                {trilha.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDateTime(d.decidedAt)}</td>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); onOpen(d.useCaseId); }} style={{ color: "var(--gold-deep)" }}>{d.useCaseCode ?? "—"} · {d.useCaseName ?? ""}</a></td>
                    <td><span className={statusPill(AI_DECISION_TO_STATUS[d.decision])}>{AI_DECISION_LABEL[d.decision]}</span></td>
                    <td>{d.decidedByName}</td>
                    <td style={{ color: "var(--text-sec)" }}>{d.justification}</td>
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

// ── Incidentes e Revisões ──────────────────────────────────────────────────

function IncidentesTab({ incidentes, revisoes, casos, canManage, onChanged, onOpen }: {
  incidentes: ReturnType<typeof useRecurso<AiIncidentData[]>>;
  revisoes: ReturnType<typeof useRecurso<AiReviewEntry[]>>;
  casos: AiUseCaseData[];
  canManage: boolean;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [novo, setNovo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const lista = incidentes.data ?? [];
  const agenda = revisoes.data ?? [];

  async function encerrar(i: AiIncidentData) {
    setBusy(i.id);
    try {
      await updateAiIncident(i.id, { status: i.status === "ABERTO" ? "ENCERRADO" : "ABERTO" });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head">
          <div><h3>Incidentes</h3><span className="card__sub">Ocorrências ligadas (ou não) a um caso de uso, com severidade e situação.</span></div>
          {canManage && <button className="btn btn--outline-dark btn--sm" onClick={() => setNovo(true)}><IconPlus /> Registrar incidente</button>}
        </div>
        {incidentes.status === "loading" && <p className="dash-state">Carregando…</p>}
        {incidentes.status === "ok" && lista.length === 0 && <p className="dash-state" style={{ margin: 0 }}>Nenhum incidente registrado.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((i) => (
            <div key={i.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {i.useCaseId ? (
                    <a href="#" onClick={(e) => { e.preventDefault(); onOpen(i.useCaseId!); }} style={{ color: "var(--gold-deep)" }}>Caso {i.useCaseCode}</a>
                  ) : "Sem caso vinculado"}
                </div>
                <span className={i.status === "ABERTO" ? "pill pill--danger" : "pill"}>{AI_INCIDENT_STATUS_LABEL[i.status]}</span>
              </div>
              <span className="card__hint">{fmtDate(i.occurredAt)} · Severidade {AI_INCIDENT_SEVERITY_LABEL[i.severity]}</span>
              <div style={{ fontSize: 13, marginTop: 6 }}>{i.description}</div>
              {canManage && (
                <button className="btn btn--ghost-dark btn--sm" style={{ marginTop: 8 }} disabled={busy === i.id} onClick={() => encerrar(i)}>
                  {i.status === "ABERTO" ? "Encerrar" : "Reabrir"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div><h3>Agenda de revisões</h3><span className="card__sub">Derivada da “próxima revisão” de cada caso (rejeitados saem da agenda).</span></div></div>
        {revisoes.status === "loading" && <p className="dash-state">Carregando…</p>}
        {revisoes.status === "ok" && agenda.length === 0 && <p className="dash-state" style={{ margin: 0 }}>Nenhuma revisão agendada. Informe a “próxima revisão” no caso de uso ou ao decidir.</p>}
        {agenda.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Caso</th><th>Área</th><th>Responsável</th><th>Revisão</th><th>Situação</th></tr></thead>
              <tbody>
                {agenda.map((r) => (
                  <tr key={r.useCaseId}>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); onOpen(r.useCaseId); }} style={{ color: "var(--gold-deep)" }}>{r.code} · {r.name}</a></td>
                    <td>{r.area}</td>
                    <td>{r.ownerName}</td>
                    <td>{fmtDate(r.nextReviewAt)}</td>
                    <td>
                      <span className={r.overdue ? "pill pill--danger" : r.daysUntil <= 30 ? "pill pill--gold" : "pill"}>
                        {r.overdue ? `Vencida há ${Math.abs(r.daysUntil)} dia(s)` : r.daysUntil === 0 ? "Hoje" : `Em ${r.daysUntil} dia(s)`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {novo && <IncidenteForm casos={casos} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); onChanged(); }} />}
    </div>
  );
}

function IncidenteForm({ casos, onClose, onSaved }: { casos: AiUseCaseData[]; onClose: () => void; onSaved: () => void }) {
  const [useCaseId, setUseCaseId] = useState("");
  const [severity, setSeverity] = useState<AiIncidentSeverity>("MEDIA");
  const [occurredAt, setOccurredAt] = useState(toInputDate(new Date().toISOString()));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      await createAiIncident({ useCaseId: useCaseId || null, severity, occurredAt: new Date(occurredAt).toISOString(), description: description.trim() });
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao registrar o incidente.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>Registrar incidente</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full">
              <span>Caso de uso (opcional)</span>
              <select value={useCaseId} onChange={(e) => setUseCaseId(e.target.value)}>
                <option value="">Sem caso vinculado</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Severidade</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as AiIncidentSeverity)}>
                {AI_INCIDENT_SEVERITIES.map((s) => <option key={s} value={s}>{AI_INCIDENT_SEVERITY_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Data da ocorrência</span>
              <input type="date" required value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </label>
            <label className="prod-field prod-field--full">
              <span>Descrição</span>
              <textarea rows={4} required minLength={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que aconteceu, como foi identificado e o que foi feito." />
            </label>
          </div>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : "Registrar"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Políticas e Evidências ─────────────────────────────────────────────────

function PoliticasTab({ politicas, casos, canManage, onChanged }: {
  politicas: ReturnType<typeof useRecurso<AiPolicyData[]>>;
  casos: AiUseCaseData[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [nova, setNova] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const lista = politicas.data ?? [];
  const comVinculos = casos.filter((c) => c.linksCount > 0);

  async function mudarStatus(p: AiPolicyData, status: AiPolicyStatus) {
    setBusy(p.id);
    try {
      await updateAiPolicy(p.id, { status });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head">
          <div><h3>Políticas e documentos</h3><span className="card__sub">Uso aceitável, comitê, avaliação de impacto, explicabilidade — com versão, status e data.</span></div>
          {canManage && <button className="btn btn--outline-dark btn--sm" onClick={() => setNova(true)}><IconPlus /> Nova política</button>}
        </div>
        {politicas.status === "loading" && <p className="dash-state">Carregando…</p>}
        {politicas.status === "ok" && lista.length === 0 && <p className="dash-state" style={{ margin: 0 }}>Nenhuma política cadastrada.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                <span className="card__hint">Versão {p.version} · {fmtDate(p.publishedAt ?? p.updatedAt)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {canManage ? (
                  <select className="select-pill" value={p.status} disabled={busy === p.id} onChange={(e) => mudarStatus(p, e.target.value as AiPolicyStatus)} style={{ fontSize: 12 }}>
                    {AI_POLICY_STATUSES.map((s) => <option key={s} value={s}>{AI_POLICY_STATUS_LABEL[s]}</option>)}
                  </select>
                ) : (
                  <span className={p.status === "APROVADO" ? "pill pill--gold" : "pill"}>{AI_POLICY_STATUS_LABEL[p.status]}</span>
                )}
                {p.url ? (
                  <a className="btn btn--ghost-dark btn--sm" href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Abrir</a>
                ) : (
                  <span className="card__hint">sem arquivo/link</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div><h3>Evidências vinculadas</h3><span className="card__sub">Casos com vínculos a Evidências (módulo Relatórios) ou ao Plano de Evolução. O vínculo é feito no detalhe do caso.</span></div></div>
        {comVinculos.length === 0 ? (
          <p className="dash-state" style={{ margin: 0 }}>
            Nenhum caso com evidência vinculada. Abra um caso → “Vínculos” para apontar uma evidência já enviada em <a href="#" onClick={(e) => { e.preventDefault(); goToRoute("evidencias"); }} style={{ color: "var(--gold-deep)" }}>Evidências</a> ou uma ação do Plano de Evolução.
          </p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Caso</th><th>Vínculos</th><th>Status</th></tr></thead>
            <tbody>
              {comVinculos.map((c) => (
                <tr key={c.id}><td>{c.code} · {c.name}</td><td>{c.linksCount}</td><td><span className={statusPill(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</span></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nova && <PoliticaForm onClose={() => setNova(false)} onSaved={() => { setNova(false); onChanged(); }} />}
    </div>
  );
}

function PoliticaForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [status, setStatus] = useState<AiPolicyStatus>("RASCUNHO");
  const [publishedAt, setPublishedAt] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      await createAiPolicy({
        title: title.trim(),
        version: version.trim(),
        status,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        url: url.trim() || null,
      });
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar a política.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>Nova política</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Título</span><input required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Política de Uso Aceitável de IA" /></label>
            <label className="prod-field"><span>Versão</span><input required value={version} onChange={(e) => setVersion(e.target.value)} /></label>
            <label className="prod-field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as AiPolicyStatus)}>
                {AI_POLICY_STATUSES.map((s) => <option key={s} value={s}>{AI_POLICY_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Data de publicação</span><input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /></label>
            <label className="prod-field"><span>Link do documento (opcional)</span><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
          </div>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Drawer do caso (detalhe + decisão humana + vínculos) ───────────────────

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

function CasoDrawer({ id, canManage, onClose, onChanged, onEdit }: {
  id: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (c: AiUseCaseData) => void;
}) {
  const [caso, setCaso] = useState<AiUseCaseDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [proximaRevisao, setProximaRevisao] = useState("");
  const [decidindo, setDecidindo] = useState<AiDecision | null>(null);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);

  async function carregar() {
    try {
      const c = await getAiUseCase(id);
      setCaso(c);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao abrir o caso.");
    }
  }
  useEffect(() => {
    let alive = true;
    getAiUseCase(id)
      .then((c) => { if (alive) { setCaso(c); setProximaRevisao(toInputDate(c.nextReviewAt)); } })
      .catch((e) => { if (alive) setErro(e instanceof Error ? e.message : "Falha ao abrir o caso."); });
    return () => { alive = false; };
  }, [id]);

  async function decidir(decision: AiDecision) {
    const j = justificativa.trim();
    if (!j) {
      setErroDecisao("A decisão exige uma justificativa — ela fica na trilha do caso.");
      return;
    }
    setDecidindo(decision);
    setErroDecisao(null);
    try {
      const atualizado = await decideAiUseCase(id, {
        decision,
        justification: j,
        nextReviewAt: proximaRevisao ? new Date(proximaRevisao).toISOString() : null,
      });
      setCaso(atualizado);
      setJustificativa("");
      onChanged();
    } catch (e) {
      setErroDecisao(e instanceof Error ? e.message : "Falha ao registrar a decisão.");
    } finally {
      setDecidindo(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            {caso && <span className="card__hint" style={{ fontFamily: "var(--font-mono, monospace)" }}>{caso.code} · {caso.area} · {caso.technology}</span>}
            <h2 style={{ marginTop: 4 }}>{caso?.name ?? "Caso de uso"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
          {!caso && !erro && <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>}
          {caso && (
            <>
              <Field label="Finalidade" value={caso.purpose} />
              <Field label="Responsável" value={caso.ownerName} />
              <Field label="Fornecedor" value={caso.vendor ?? "—"} />
              <Field label="Dados utilizados" value={caso.dataUsed} />
              <Field label="Público afetado" value={caso.audience} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className={riskPill(caso.inherentRisk)}>Risco inerente: {AI_RISK_LABEL[caso.inherentRisk]}</span>
                <span className={riskPill(caso.residualRisk)}>Risco residual: {AI_RISK_LABEL[caso.residualRisk]}</span>
                <span className={statusPill(caso.status)}>{AI_USE_CASE_STATUS_LABEL[caso.status]}</span>
              </div>
              <Field label="Controles" value={caso.controls.length ? caso.controls.join(" · ") : "—"} />
              <Field label="Justificativa vigente" value={caso.justification ?? "—"} />
              <Field label="Aprovador · data" value={caso.lastDecision ? `${caso.lastDecision.decidedByName} · ${fmtDateTime(caso.lastDecision.decidedAt)}` : "— (sem decisão)"} />
              <Field label="Próxima revisão" value={fmtDate(caso.nextReviewAt)} />
              <Field label="Incidentes" value={caso.incidents.length ? caso.incidents.map((i) => `${fmtDate(i.occurredAt)} · ${AI_INCIDENT_SEVERITY_LABEL[i.severity]} · ${AI_INCIDENT_STATUS_LABEL[i.status]}`).join(" · ") : "nenhum"} />

              <VinculosBloco caso={caso} canManage={canManage} onChanged={async () => { await carregar(); onChanged(); }} />

              {caso.decisions.length > 0 && (
                <div>
                  <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10, marginBottom: 6 }}>Trilha de decisões</div>
                  <table className="data-table">
                    <thead><tr><th>Quando</th><th>Decisão</th><th>Quem</th><th>Justificativa</th></tr></thead>
                    <tbody>
                      {caso.decisions.map((d) => (
                        <tr key={d.id}><td>{fmtDateTime(d.decidedAt)}</td><td>{AI_DECISION_LABEL[d.decision]}</td><td>{d.decidedByName}</td><td style={{ color: "var(--text-sec)" }}>{d.justification}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canManage && (
                <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10, marginBottom: 8 }}>Decisão humana</div>
                  <div className="prod-form__grid">
                    <label className="prod-field prod-field--full">
                      <span>Justificativa (obrigatória)</span>
                      <textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que esta decisão? Condições, restrições ou motivo da rejeição." />
                    </label>
                    <label className="prod-field">
                      <span>Próxima revisão</span>
                      <input type="date" value={proximaRevisao} onChange={(e) => setProximaRevisao(e.target.value)} />
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {AI_DECISIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`btn btn--sm ${d === "APROVAR" ? "btn--gold" : d === "REJEITAR" ? "btn--outline-dark" : "btn--ghost-dark"}`}
                        disabled={!!decidindo}
                        onClick={() => decidir(d)}
                        title={`Leva o caso ao status “${AI_USE_CASE_STATUS_LABEL[AI_DECISION_TO_STATUS[d]]}”`}
                      >
                        {decidindo === d ? "Registrando…" : AI_DECISION_LABEL[d]}
                      </button>
                    ))}
                  </div>
                  {erroDecisao && <div className="dash-state dash-state--error" style={{ margin: "10px 0 0" }}>{erroDecisao}</div>}
                  <p className="card__hint" style={{ marginTop: 8 }}>A decisão é sua (humana) e fica na trilha com quem decidiu, quando e por quê. A CRIVO acompanha, não decide.</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal__foot">
          {caso && canManage && <button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => onEdit(caso)}>Editar cadastro</button>}
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/** Vínculos com Evidências e Plano de Evolução — seleção de itens EXISTENTES (nunca texto livre). */
function VinculosBloco({ caso, canManage, onChanged }: { caso: AiUseCaseDetail; canManage: boolean; onChanged: () => Promise<void> }) {
  const [planos, setPlanos] = useState<ActionPlanData[] | null>(null);
  const [kind, setKind] = useState<"EVIDENCE" | "ACTION_ITEM">("EVIDENCE");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    // Evidências e ações vêm do módulo Relatórios (/action-plans); sem ele
    // (403) o bloco simplesmente não oferece vínculo — não é erro da tela.
    listActionPlans().then((p) => { if (alive) setPlanos(p); }).catch(() => { if (alive) setPlanos([]); });
    return () => { alive = false; };
  }, [canManage]);

  const evidencias = useMemo(() => (planos ?? []).flatMap((p) => p.items.flatMap((i) => i.evidences.map((ev) => ({ id: ev.id, label: `${ev.title} (${i.action})` })))), [planos]);
  const acoes = useMemo(() => (planos ?? []).flatMap((p) => p.items.map((i) => ({ id: i.id, label: `${i.action} — ${p.title}` }))), [planos]);
  const opcoes = kind === "EVIDENCE" ? evidencias : acoes;

  async function vincular() {
    if (!targetId) return;
    setBusy(true);
    setErro(null);
    try {
      await addAiUseCaseLink(caso.id, { kind, targetId });
      setTargetId("");
      await onChanged();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao vincular.");
    } finally {
      setBusy(false);
    }
  }
  async function desvincular(linkId: string) {
    setBusy(true);
    try {
      await removeAiUseCaseLink(caso.id, linkId);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10, marginBottom: 6 }}>Vínculos (Evidências · Plano de Evolução)</div>
      {caso.links.length === 0 ? (
        <div style={{ fontSize: 14 }}>—</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {caso.links.map((l) => (
            <span key={l.id} className="pill" style={{ gap: 6 }}>
              {AI_LINK_KIND_LABEL[l.kind]}: {l.label ?? "(removido)"}
              {canManage && <button type="button" className="icon-btn" title="Remover vínculo" disabled={busy} onClick={() => desvincular(l.id)} style={{ padding: 0 }}><IconClose size={12} /></button>}
            </span>
          ))}
        </div>
      )}
      {canManage && planos && (evidencias.length > 0 || acoes.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end", marginTop: 8 }}>
          <label className="prod-field" style={{ minWidth: 140 }}>
            <span>Tipo</span>
            <select value={kind} onChange={(e) => { setKind(e.target.value as "EVIDENCE" | "ACTION_ITEM"); setTargetId(""); }}>
              <option value="EVIDENCE">Evidência</option>
              <option value="ACTION_ITEM">Ação do Plano de Evolução</option>
            </select>
          </label>
          <label className="prod-field" style={{ flex: 1, minWidth: 200 }}>
            <span>Item existente</span>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Selecione…</option>
              {opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn--outline-dark btn--sm" disabled={!targetId || busy} onClick={vincular}>Vincular</button>
        </div>
      )}
      {canManage && planos && evidencias.length === 0 && acoes.length === 0 && (
        <p className="card__hint" style={{ marginTop: 6 }}>Nenhuma evidência ou ação cadastrada ainda (módulo Relatórios). Os vínculos apontam para itens existentes.</p>
      )}
      {erro && <div className="dash-state dash-state--error" style={{ margin: "8px 0 0" }}>{erro}</div>}
    </div>
  );
}

// ── Formulário "Novo caso" / edição ────────────────────────────────────────

function CasoForm({ initial, areas, onClose, onSaved }: { initial: AiUseCaseData | null; areas: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<UpsertAiUseCaseRequest>({
    name: initial?.name ?? "",
    purpose: initial?.purpose ?? "",
    area: initial?.area ?? "",
    ownerName: initial?.ownerName ?? "",
    technology: initial?.technology ?? "",
    vendor: initial?.vendor ?? "",
    dataUsed: initial?.dataUsed ?? "",
    audience: initial?.audience ?? "",
    inherentRisk: initial?.inherentRisk ?? "MEDIO",
    residualRisk: initial?.residualRisk ?? "MEDIO",
    controls: initial?.controls ?? [],
    justification: initial?.justification ?? "",
    nextReviewAt: toInputDate(initial?.nextReviewAt),
    status: initial && (initial.status === "RASCUNHO" || initial.status === "EM_AVALIACAO") ? initial.status : "RASCUNHO",
  });
  const [controlesTexto, setControlesTexto] = useState((initial?.controls ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof UpsertAiUseCaseRequest>(k: K, v: UpsertAiUseCaseRequest[K]) => setF((s) => ({ ...s, [k]: v }));
  const decidido = !!initial && initial.status !== "RASCUNHO" && initial.status !== "EM_AVALIACAO";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      const payload: UpsertAiUseCaseRequest = {
        name: f.name.trim(),
        purpose: f.purpose.trim(),
        area: f.area.trim(),
        ownerName: f.ownerName.trim(),
        technology: f.technology.trim(),
        vendor: f.vendor?.trim() || null,
        dataUsed: f.dataUsed.trim(),
        audience: f.audience.trim(),
        inherentRisk: f.inherentRisk,
        residualRisk: f.residualRisk,
        controls: controlesTexto.split("\n").map((c) => c.trim()).filter(Boolean),
        justification: f.justification?.trim() || null,
        nextReviewAt: f.nextReviewAt ? new Date(f.nextReviewAt).toISOString() : null,
        ...(decidido ? {} : { status: f.status }),
      };
      if (initial) await updateAiUseCase(initial.id, payload);
      else await createAiUseCase(payload);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar o caso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head">
          <h2>{initial ? `Editar ${initial.code}` : "Novo caso de uso"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Nome</span><input required minLength={2} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Triagem de currículos" /></label>
            <label className="prod-field prod-field--full"><span>Finalidade</span><textarea rows={2} required minLength={2} value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Para que a IA é usada" /></label>
            <label className="prod-field"><span>Área</span><input required list="govia-areas" value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="Ex.: Pessoas, Comercial, Jurídico" /><datalist id="govia-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist></label>
            <label className="prod-field"><span>Responsável</span><input required minLength={2} value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Nome de quem responde pelo caso" /></label>
            <label className="prod-field"><span>Tecnologia</span><input required value={f.technology} onChange={(e) => set("technology", e.target.value)} placeholder="Ex.: LLM + regras, ML supervisionado" /></label>
            <label className="prod-field"><span>Fornecedor (opcional)</span><input value={f.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)} placeholder="Ex.: provedor da API/modelo" /></label>
            <label className="prod-field"><span>Dados utilizados</span><input required value={f.dataUsed} onChange={(e) => set("dataUsed", e.target.value)} placeholder="Ex.: currículos, histórico de tickets" /></label>
            <label className="prod-field"><span>Público afetado</span><input required value={f.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Ex.: candidatos externos, clientes B2B" /></label>
            <label className="prod-field">
              <span>Risco inerente (antes dos controles)</span>
              <select value={f.inherentRisk} onChange={(e) => set("inherentRisk", e.target.value as AiRiskLevel)}>
                {AI_RISK_LEVELS.map((r) => <option key={r} value={r}>{AI_RISK_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Risco residual (após controles)</span>
              <select value={f.residualRisk} onChange={(e) => set("residualRisk", e.target.value as AiRiskLevel)}>
                {AI_RISK_LEVELS.map((r) => <option key={r} value={r}>{AI_RISK_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="prod-field prod-field--full"><span>Controles (um por linha)</span><textarea rows={3} value={controlesTexto} onChange={(e) => setControlesTexto(e.target.value)} placeholder={"Revisão humana obrigatória\nAuditoria mensal\nSem decisão automática"} /></label>
            <label className="prod-field prod-field--full"><span>Justificativa / observações</span><textarea rows={2} value={f.justification ?? ""} onChange={(e) => set("justification", e.target.value)} /></label>
            <label className="prod-field"><span>Próxima revisão</span><input type="date" value={f.nextReviewAt ?? ""} onChange={(e) => set("nextReviewAt", e.target.value)} /></label>
            <label className="prod-field">
              <span>Situação inicial</span>
              {decidido ? (
                <input value={AI_USE_CASE_STATUS_LABEL[initial!.status]} disabled title="O status de um caso decidido só muda por nova decisão humana" />
              ) : (
                <select value={f.status} onChange={(e) => set("status", e.target.value as "RASCUNHO" | "EM_AVALIACAO")}>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="EM_AVALIACAO">Em avaliação (pronto para decisão)</option>
                </select>
              )}
            </label>
          </div>
          <p className="card__hint" style={{ margin: 0 }}>A classificação de risco é da sua empresa (avaliação não certificadora). Aprovar, condicionar, restringir ou rejeitar acontece no detalhe do caso, com justificativa.</p>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar caso"}</button>
        </div>
      </form>
    </div>
  );
}
