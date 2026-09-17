"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  INSIGHT_ORIGINS,
  INSIGHT_ORIGIN_LABEL,
  WORKFORCE_AI_THRESHOLD_DEFAULT,
  WORKFORCE_SCENARIOS,
  WORKFORCE_SCENARIO_LABEL,
  WORK_CONFIDENCES,
  WORK_CONFIDENCE_LABEL,
  WORK_CRITICALITIES,
  WORK_CRITICALITY_LABEL,
  WORK_DECISIONS,
  WORK_DECISION_LABEL,
  WORK_DECISION_TO_STAGE,
  WORK_PILOT_KINDS,
  WORK_PILOT_KIND_LABEL,
  WORK_PILOT_STATUSES,
  WORK_PILOT_STATUS_LABEL,
  WORK_RISKS,
  WORK_RISK_LABEL,
  WORK_TASK_STAGES,
  WORK_TASK_STAGE_LABEL,
  type InsightOrigin,
  type UpsertWorkTaskRequest,
  type WorkConfidence,
  type WorkCriticality,
  type WorkDecision,
  type WorkPilotData,
  type WorkPilotKind,
  type WorkPilotStatus,
  type WorkProcessData,
  type WorkRisk,
  type WorkSkillData,
  type WorkTaskData,
  type WorkTaskStage,
  type WorkforceScenario,
  type WorkforceSummary,
} from "@crivo/types";
import {
  ApiError,
  createWorkPilot,
  createWorkProcess,
  createWorkTask,
  decideWorkTask,
  getMyPermissions,
  getWorkTask,
  getWorkforceSummary,
  listWorkPilots,
  listWorkProcesses,
  listWorkSkills,
  listWorkTasks,
  saveWorkSkills,
  updateWorkPilot,
  updateWorkProcess,
  updateWorkTask,
} from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext, type ExportSection, type ExportSheet } from "@/lib/exports";
import { IconClose } from "./Icons";

/**
 * Programas › Workforce Intelligence (rota `workforce`) — layout do protótipo
 * Lovable (6 abas: Visão Geral · Processos e Funções · Tarefas e Trabalho Real
 * · Skills e Capacidades · Cenários Pessoa × Processo × IA · Pilotos e
 * Evolução) com dados REAIS de /workforce/* (WorkProcess, WorkTask, WorkSkill,
 * WorkPilot — data plane da empresa). Nenhuma tarefa/processo/skill demo.
 *
 * Fluxo: a CRIVO alimenta e VALIDA tarefas no Super Admin (ou a própria empresa
 * cadastra, com workforce:manage); aqui o cliente lê e registra a DECISÃO
 * humana por tarefa (Aceitar/Condicionar/Devolver/Rejeitar), persistida com
 * quem e quando. Percentuais (potencial IA, essencialidade humana, prontidão)
 * são julgamentos informados — não score CRIVO nem cálculo de IA. A cobertura
 * de IA por processo usa o limiar DO PROCESSO (editável).
 */

type Tab = "visao" | "processos" | "tarefas" | "skills" | "cenarios" | "pilotos";
const TABS: Array<[Tab, string]> = [
  ["visao", "Visão Geral"],
  ["processos", "Processos e Funções"],
  ["tarefas", "Tarefas e Trabalho Real"],
  ["skills", "Skills e Capacidades"],
  ["cenarios", "Cenários Pessoa × Processo × IA"],
  ["pilotos", "Pilotos e Evolução"],
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
type Recurso<T> = ReturnType<typeof useRecurso<T>>;

// ── Ícones SVG de traço (regra do cliente: nunca emoji) ──
const Svg = ({ children, size = 14 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-0.15em", flexShrink: 0 }}>
    {children}
  </svg>
);
const IconDownload = () => (<Svg><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>);
const IconFile = () => (<Svg><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>);
const IconPlus = () => (<Svg><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
const IconEye = () => (<Svg><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
const IconRefresh = () => (<Svg><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>);
const IconCpu = () => (<Svg size={24}><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></Svg>);
const IconEdit = () => (<Svg><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></Svg>);

const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

function riskPill(r: WorkRisk): string {
  return r === "ALTO" ? "pill pill--danger" : r === "MEDIO" ? "pill pill--gold" : "pill";
}
function stagePill(s: WorkTaskStage): string {
  return s === "DECIDIDO" ? "pill pill--gold" : s === "EM_VALIDACAO_CRIVO" ? "pill pill--danger" : "pill";
}
function decisionPill(d: WorkDecision): string {
  return d === "ACEITAR" ? "pill pill--gold" : d === "REJEITAR" || d === "DEVOLVER" ? "pill pill--danger" : "pill";
}
/** Cor da barra por faixa (mesma leitura do LiderScreen: alto = dourado). */
const barClass = (v: number) => (v >= 70 ? "bar__fill bar__fill--high" : v >= 40 ? "bar__fill bar__fill--mid" : "bar__fill bar__fill--low");

/** Card fixo do protótipo — texto de produto mantido, não editável. */
function LinguagemResponsavel() {
  return (
    <div className="card">
      <div className="card__head"><div><h3>Linguagem responsável</h3></div></div>
      <p style={{ fontSize: 14, color: "var(--text-sec)", lineHeight: 1.6, margin: 0 }}>
        Este módulo não decide se uma vaga deve existir nem propõe redução automática de quadro. Separa <b>Fato</b>, <b>Inferência</b>,{" "}
        <b>Hipótese/pergunta</b> e <b>Recomendação</b>. Toda tarefa indica origem; a decisão sobre o redesenho é humana. Nenhum resultado é
        apresentado como economia garantida: cenários passam por validação CRIVO e pela decisão da sua empresa.
      </p>
    </div>
  );
}

export function WorkforceScreen() {
  const [tab, setTab] = useState<Tab>("visao");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const [canManage, setCanManage] = useState(false);
  const exportCtx = useExportContext();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const summary = useRecurso<WorkforceSummary>(getWorkforceSummary, tick);
  const processos = useRecurso<WorkProcessData[]>(listWorkProcesses, tick);
  const tarefas = useRecurso<WorkTaskData[]>(() => listWorkTasks(), tick);
  const skills = useRecurso<WorkSkillData[]>(listWorkSkills, tick);
  const pilotos = useRecurso<WorkPilotData[]>(listWorkPilots, tick);

  // Filtros compartilhados entre "Tarefas" e "Cenários" (o protótipo filtra só em Tarefas;
  // aqui os cenários listam as tarefas FILTRADAS, não um recorte fixo).
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroRisco, setFiltroRisco] = useState("todos");
  const [filtroEstagio, setFiltroEstagio] = useState("todos");
  const listaTarefas = useMemo(() => tarefas.data ?? [], [tarefas.data]);
  const areas = useMemo(() => summary.data?.areas ?? Array.from(new Set(listaTarefas.map((t) => t.area))), [summary.data, listaTarefas]);
  const filtradas = useMemo(() => listaTarefas.filter((t) =>
    (filtroArea === "todas" || t.area === filtroArea) &&
    (filtroRisco === "todos" || t.risk === filtroRisco) &&
    (filtroEstagio === "todos" || t.stage === filtroEstagio),
  ), [listaTarefas, filtroArea, filtroRisco, filtroEstagio]);

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [novaTarefa, setNovaTarefa] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState<WorkTaskData | null>(null);
  const [processoForm, setProcessoForm] = useState<{ open: boolean; initial: WorkProcessData | null }>({ open: false, initial: null });
  const [skillsForm, setSkillsForm] = useState(false);
  const [pilotoForm, setPilotoForm] = useState<{ open: boolean; initial: WorkPilotData | null }>({ open: false, initial: null });

  useEffect(() => {
    let alive = true;
    getMyPermissions()
      .then((perms) => { if (alive) setCanManage(perms.includes("workforce:manage")); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const semModulo = summary.status === "ok" && !summary.data;
  const loading = [summary, processos, tarefas, skills, pilotos].some((r) => r.status === "loading");

  // ── Exportação (helper compartilhado). Só o que está na tela. ──
  function buildSheets(): ExportSheet[] {
    return [
      { name: "Tarefas", rows: filtradas.map((t) => ({
        ID: t.code, Processo: t.processName, Função: t.role, Área: t.area, Tarefa: t.name, "Volume/mês": t.volumePerMonth,
        "Duração (min)": t.durationMin, Criticidade: WORK_CRITICALITY_LABEL[t.criticality], "Potencial IA": t.aiPotential,
        "Essenc. humana": t.humanEssentiality, Risco: WORK_RISK_LABEL[t.risk], Prontidão: t.readiness,
        Cenário: WORKFORCE_SCENARIO_LABEL[t.scenario], Origem: INSIGHT_ORIGIN_LABEL[t.origin], Estágio: WORK_TASK_STAGE_LABEL[t.stage],
        Decisão: t.decision ? WORK_DECISION_LABEL[t.decision] : "—", "Decidido por": t.decidedByName ?? "—", "Decidido em": fmtDateTime(t.decidedAt),
      })) },
      { name: "Processos", rows: (processos.data ?? []).map((p) => ({
        Processo: p.name, Área: p.area, Tarefas: p.tasksCount, "Limiar IA (%)": p.aiThresholdPct,
        "Cobertura IA (%)": p.aiCoveragePct ?? "—", "Cenário predominante": p.dominantScenario ? WORKFORCE_SCENARIO_LABEL[p.dominantScenario] : "—",
        "Maior risco": p.highestRisk ? WORK_RISK_LABEL[p.highestRisk] : "—",
      })) },
      { name: "Skills", rows: (skills.data ?? []).map((s) => ({ Skill: s.name, Atual: s.current, Alvo: s.target })) },
      { name: "Pilotos", rows: (pilotos.data ?? []).map((p) => ({
        Nome: p.name, Tipo: WORK_PILOT_KIND_LABEL[p.kind], Processo: p.processName ?? "—", Baseline: p.baseline, Indicador: p.indicator,
        Resultado: p.result || "—", Confiança: WORK_CONFIDENCE_LABEL[p.confidence], Status: WORK_PILOT_STATUS_LABEL[p.status],
      })) },
    ];
  }
  async function handleExport(kind: "xlsx" | "pdf") {
    if (!exportCtx) return;
    setExporting(kind);
    try {
      const sheets = buildSheets();
      if (kind === "xlsx") await exportXLSX("crivo-workforce", sheets, exportCtx);
      else {
        const secoes: ExportSection[] = [
          { heading: "Tarefas filtradas", rows: filtradas.map((t) => ({ ID: t.code, Tarefa: t.name, Área: t.area, "Potencial IA": t.aiPotential, Risco: WORK_RISK_LABEL[t.risk], Decisão: t.decision ? WORK_DECISION_LABEL[t.decision] : "—" })) },
          { heading: "Pilotos", rows: sheets[3].rows },
        ];
        await exportPDF("crivo-workforce", "Workforce Intelligence · Tarefas e cenários", secoes, exportCtx);
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Workforce Intelligence</h1>
          <p className="page-sub">Como o trabalho está organizado e como pode ser redesenhado entre pessoas, processos e IA. Decisão permanece humana.</p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("xlsx")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar tarefas, processos, skills e pilotos em Excel"}>
            <IconDownload /> {exporting === "xlsx" ? "Gerando…" : "XLSX"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("pdf")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar tarefas filtradas e pilotos em PDF"}>
            <IconFile /> {exporting === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={reload} disabled={loading} title="Recarregar">
            <IconRefresh /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {summary.status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o Workforce Intelligence. {summary.erro}{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={reload}>Tentar novamente</button>
        </div>
      )}

      {semModulo && (
        <div className="dash-state">
          O módulo Workforce Intelligence não está ativo para a sua empresa. Processos, tarefas, skills, cenários e pilotos aparecem aqui quando o módulo for liberado no contrato (adicional Workforce Intelligence).
        </div>
      )}

      {!semModulo && summary.status !== "error" && (
        <>
          <div className="seg" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" className={`seg__btn${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === "visao" && <VisaoTab summary={summary} />}
          {tab === "processos" && (
            <ProcessosTab processos={processos} canManage={canManage} onNovo={() => setProcessoForm({ open: true, initial: null })} onEditar={(p) => setProcessoForm({ open: true, initial: p })} />
          )}
          {tab === "tarefas" && (
            <TarefasTab
              tarefas={tarefas}
              filtradas={filtradas}
              areas={areas}
              filtros={{ area: filtroArea, risco: filtroRisco, estagio: filtroEstagio }}
              setFiltros={{ area: setFiltroArea, risco: setFiltroRisco, estagio: setFiltroEstagio }}
              canManage={canManage}
              temProcesso={(processos.data?.length ?? 0) > 0}
              onOpen={setSelecionadaId}
              onNova={() => setNovaTarefa(true)}
            />
          )}
          {tab === "skills" && <SkillsTab skills={skills} canManage={canManage} onEditar={() => setSkillsForm(true)} />}
          {tab === "cenarios" && (
            <CenariosTab tarefas={tarefas} filtradas={filtradas} areas={areas} filtros={{ area: filtroArea, risco: filtroRisco }} setFiltros={{ area: setFiltroArea, risco: setFiltroRisco }} onOpen={setSelecionadaId} />
          )}
          {tab === "pilotos" && (
            <PilotosTab pilotos={pilotos} canManage={canManage} onChanged={reload} onNovo={() => setPilotoForm({ open: true, initial: null })} onEditar={(p) => setPilotoForm({ open: true, initial: p })} />
          )}
        </>
      )}

      {selecionadaId && (
        <TarefaDrawer
          id={selecionadaId}
          canManage={canManage}
          onClose={() => setSelecionadaId(null)}
          onChanged={reload}
          onEdit={(t) => { setSelecionadaId(null); setEditandoTarefa(t); }}
        />
      )}
      {(novaTarefa || editandoTarefa) && (
        <TarefaForm
          initial={editandoTarefa}
          processos={processos.data ?? []}
          onClose={() => { setNovaTarefa(false); setEditandoTarefa(null); }}
          onSaved={() => { setNovaTarefa(false); setEditandoTarefa(null); reload(); }}
        />
      )}
      {processoForm.open && (
        <ProcessoForm initial={processoForm.initial} onClose={() => setProcessoForm({ open: false, initial: null })} onSaved={() => { setProcessoForm({ open: false, initial: null }); reload(); }} />
      )}
      {skillsForm && <SkillsForm initial={skills.data ?? []} onClose={() => setSkillsForm(false)} onSaved={() => { setSkillsForm(false); reload(); }} />}
      {pilotoForm.open && (
        <PilotoForm initial={pilotoForm.initial} processos={processos.data ?? []} onClose={() => setPilotoForm({ open: false, initial: null })} onSaved={() => { setPilotoForm({ open: false, initial: null }); reload(); }} />
      )}
    </>
  );
}

// ── Visão Geral ────────────────────────────────────────────────────────────

function VisaoTab({ summary }: { summary: Recurso<WorkforceSummary> }) {
  const s = summary.data;
  if (summary.status === "loading" || !s) return <p className="dash-state">Carregando indicadores…</p>;
  const aguardandoDecisao = s.byStage.VALIDADO_CRIVO;
  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__label" title="Processos cadastrados no mapeamento do trabalho">Processos mapeados</span>
          <strong className="kpi__value">{s.processes}</strong>
          <span className="card__hint">{s.areas.length} área(s) com tarefas</span>
        </div>
        <div className="kpi">
          <span className="kpi__label" title="Tarefas do trabalho real catalogadas (qualquer estágio)">Tarefas catalogadas</span>
          <strong className="kpi__value">{s.tasks}</strong>
          <span className="card__hint">{s.byStage.EM_VALIDACAO_CRIVO} em validação CRIVO · {aguardandoDecisao} aguardando sua decisão</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Skills prioritárias</span>
          <strong className="kpi__value">{s.skills}</strong>
          <span className="card__hint">atual × alvo (0–100)</span>
        </div>
        <div className="kpi">
          <span className="kpi__label" title="Pilotos com status Em andamento">Pilotos em andamento</span>
          <strong className="kpi__value">{s.pilots.inProgress}</strong>
          <span className="card__hint">{s.pilots.concluded} concluído(s) · {s.pilots.blueprints} blueprint(s)</span>
        </div>
      </div>

      <div className="grid grid--2">
        <LinguagemResponsavel />
        <div className="card">
          <div className="card__head"><div><h3>Situação do programa</h3><span className="card__sub">Leitura real do mapeamento — nada demonstrativo.</span></div></div>
          {s.tasks === 0 ? (
            <p className="dash-state" style={{ margin: 0 }}>
              {s.processes === 0 ? "Nenhum processo mapeado ainda. " : ""}As tarefas aparecem aqui quando a CRIVO (ou a sua empresa) mapear o trabalho real.
            </p>
          ) : (
            <table className="data-table">
              <tbody>
                {WORK_TASK_STAGES.map((st) => (
                  <tr key={st}><td>{WORK_TASK_STAGE_LABEL[st]}</td><td><strong>{s.byStage[st]}</strong></td></tr>
                ))}
                <tr><td>Decisões registradas</td><td><strong>{WORK_DECISIONS.reduce((a, d) => a + s.byDecision[d], 0)}</strong> <span className="card__hint">{WORK_DECISIONS.map((d) => `${s.byDecision[d]} ${WORK_DECISION_LABEL[d].toLowerCase()}`).join(" · ")}</span></td></tr>
                <tr><td>Tarefas com risco alto</td><td><strong>{s.byRisk.ALTO}</strong></td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Processos e Funções ────────────────────────────────────────────────────

function ProcessosTab({ processos, canManage, onNovo, onEditar }: {
  processos: Recurso<WorkProcessData[]>;
  canManage: boolean;
  onNovo: () => void;
  onEditar: (p: WorkProcessData) => void;
}) {
  if (processos.status === "loading") return <p className="dash-state">Carregando processos…</p>;
  if (processos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os processos. {processos.erro}</div>;
  const lista = processos.data ?? [];

  if (lista.length === 0) {
    return (
      <div className="dash-empty">
        <div className="dash-empty__ic"><IconCpu /></div>
        <h3 className="dash-empty__title">Nenhum processo mapeado ainda</h3>
        <p className="dash-empty__sub">
          O mapeamento nasce vazio. Cada processo recebe suas tarefas (função, entrada, saída, volume, duração, criticidade, potencial IA, essencialidade humana, prontidão, cenário e origem) e um limiar próprio para a cobertura de IA.
        </p>
        {canManage ? (
          <button className="btn btn--gold btn--sm" onClick={onNovo}><IconPlus /> Novo processo</button>
        ) : (
          <span className="card__hint">Cadastro pela CRIVO (Super Admin) ou por quem tem a permissão “Gerir Workforce Intelligence”.</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head">
          <div><h3>Cobertura de IA por processo</h3><span className="card__sub">Percentual de tarefas com potencial IA igual ou acima do limiar definido para o processo.</span></div>
        </div>
        <div className="bars">
          {lista.map((p) => (
            <div key={p.id} className="bar-row" title={p.aiCoveragePct == null ? "Sem tarefas cadastradas" : `${p.aiCoveragePct}% das ${p.tasksCount} tarefa(s) com potencial IA ≥ ${p.aiThresholdPct}%`}>
              <span className="bar-row__label">{p.name}</span>
              <div className="bar"><div className={barClass(p.aiCoveragePct ?? 0)} style={{ width: `${p.aiCoveragePct ?? 0}%` }} /></div>
              <span className="bar-row__value">{p.aiCoveragePct == null ? "—" : `${p.aiCoveragePct}%`}</span>
            </div>
          ))}
        </div>
        <p className="card__hint" style={{ marginTop: 12 }}>Fonte: mapeamento do trabalho da sua empresa (Inventário CRIVO). Limiar por processo — não há número fixo.</p>
      </div>
      <div className="card">
        <div className="card__head">
          <div><h3>Processos e funções</h3><span className="card__sub">Tarefas, cenário predominante e maior risco derivados das tarefas cadastradas.</span></div>
          {canManage && <button className="btn btn--outline-dark btn--sm" onClick={onNovo}><IconPlus /> Novo processo</button>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Processo</th><th>Área</th><th>Tarefas</th><th>Limiar</th><th>Cenário predominante</th><th>Risco</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.area}</td>
                  <td>{p.tasksCount}</td>
                  <td>{p.aiThresholdPct}%</td>
                  <td>{p.dominantScenario ? WORKFORCE_SCENARIO_LABEL[p.dominantScenario] : "—"}</td>
                  <td>{p.highestRisk ? <span className={riskPill(p.highestRisk)}>{WORK_RISK_LABEL[p.highestRisk]}</span> : "—"}</td>
                  {canManage && <td><button className="btn btn--ghost-dark btn--sm" onClick={() => onEditar(p)} title="Editar processo e limiar"><IconEdit /> Editar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tarefas e Trabalho Real ────────────────────────────────────────────────

type FiltroSet = { area: string; risco: string; estagio?: string };
type FiltroSetters = { area: (v: string) => void; risco: (v: string) => void; estagio?: (v: string) => void };

function Filtros({ areas, filtros, setFiltros, extra }: { areas: string[]; filtros: FiltroSet; setFiltros: FiltroSetters; extra?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginBottom: 14 }}>
      <label className="prod-field" style={{ minWidth: 160 }}>
        <span>Área</span>
        <select value={filtros.area} onChange={(e) => setFiltros.area(e.target.value)}>
          <option value="todas">Todas as áreas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="prod-field" style={{ minWidth: 150 }}>
        <span>Risco</span>
        <select value={filtros.risco} onChange={(e) => setFiltros.risco(e.target.value)}>
          <option value="todos">Todos os riscos</option>
          {WORK_RISKS.map((r) => <option key={r} value={r}>{WORK_RISK_LABEL[r]}</option>)}
        </select>
      </label>
      {filtros.estagio !== undefined && setFiltros.estagio && (
        <label className="prod-field" style={{ minWidth: 170 }}>
          <span>Estágio</span>
          <select value={filtros.estagio} onChange={(e) => setFiltros.estagio!(e.target.value)}>
            <option value="todos">Todos os estágios</option>
            {WORK_TASK_STAGES.map((s) => <option key={s} value={s}>{WORK_TASK_STAGE_LABEL[s]}</option>)}
          </select>
        </label>
      )}
      {extra}
    </div>
  );
}

function TarefasTab({ tarefas, filtradas, areas, filtros, setFiltros, canManage, temProcesso, onOpen, onNova }: {
  tarefas: Recurso<WorkTaskData[]>;
  filtradas: WorkTaskData[];
  areas: string[];
  filtros: Required<FiltroSet>;
  setFiltros: Required<FiltroSetters>;
  canManage: boolean;
  temProcesso: boolean;
  onOpen: (id: string) => void;
  onNova: () => void;
}) {
  if (tarefas.status === "loading") return <p className="dash-state">Carregando tarefas…</p>;
  if (tarefas.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar as tarefas. {tarefas.erro}</div>;
  const lista = tarefas.data ?? [];

  if (lista.length === 0) {
    return (
      <div className="dash-empty">
        <div className="dash-empty__ic"><IconCpu /></div>
        <h3 className="dash-empty__title">Nenhuma tarefa catalogada</h3>
        <p className="dash-empty__sub">
          {temProcesso ? "Os processos já existem; falta decompor o trabalho real em tarefas." : "Nenhum processo mapeado ainda — a tarefa pertence a um processo."} Cada tarefa traz entrada, saída, volume, duração, criticidade, potencial IA, essencialidade humana, prontidão, cenário e origem (Fato / Inferência / Hipótese / Recomendação).
        </p>
        {canManage && temProcesso ? (
          <button className="btn btn--gold btn--sm" onClick={onNova}><IconPlus /> Nova tarefa</button>
        ) : (
          <span className="card__hint">{canManage ? "Cadastre um processo primeiro (aba Processos e Funções)." : "Cadastro pela CRIVO (Super Admin) ou por quem tem a permissão “Gerir Workforce Intelligence”."}</span>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Tarefas e trabalho real</h3><span className="card__sub">Clique em Detalhes para ver cenário, validação CRIVO e registrar a decisão da sua empresa.</span></div>
      </div>
      <Filtros
        areas={areas}
        filtros={filtros}
        setFiltros={setFiltros}
        extra={canManage && temProcesso ? <button className="btn btn--outline-dark btn--sm" onClick={onNova}><IconPlus /> Nova tarefa</button> : undefined}
      />
      {filtradas.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>Nenhuma tarefa para os filtros aplicados.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Tarefa</th><th>Processo</th><th>Função</th><th>Volume/mês</th><th>Potencial IA</th><th>Risco</th><th>Origem</th><th>Estágio</th><th></th></tr></thead>
            <tbody>
              {filtradas.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>{t.code}</td>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.processName}</td>
                  <td>{t.role}</td>
                  <td>{t.volumePerMonth}</td>
                  <td>{t.aiPotential}%</td>
                  <td><span className={riskPill(t.risk)}>{WORK_RISK_LABEL[t.risk]}</span></td>
                  <td><span className="pill" title="Origem epistêmica informada por quem mapeou">{INSIGHT_ORIGIN_LABEL[t.origin]}</span></td>
                  <td><span className={stagePill(t.stage)}>{t.decision && t.stage === "DECIDIDO" ? WORK_DECISION_LABEL[t.decision] : WORK_TASK_STAGE_LABEL[t.stage]}</span></td>
                  <td><button className="btn btn--ghost-dark btn--sm" onClick={() => onOpen(t.id)}><IconEye /> Detalhes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Skills e Capacidades ───────────────────────────────────────────────────

function SkillsTab({ skills, canManage, onEditar }: { skills: Recurso<WorkSkillData[]>; canManage: boolean; onEditar: () => void }) {
  if (skills.status === "loading") return <p className="dash-state">Carregando skills…</p>;
  if (skills.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar as skills. {skills.erro}</div>;
  const lista = skills.data ?? [];
  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Skills prioritárias — atual vs. alvo</h3><span className="card__sub">Escala 0–100. Fonte: autoavaliação + gestor, agregado da empresa (informado, não calculado).</span></div>
        {canManage && <button className="btn btn--outline-dark btn--sm" onClick={onEditar}><IconEdit /> {lista.length ? "Editar skills" : "Cadastrar skills"}</button>}
      </div>
      {lista.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>Nenhuma skill prioritária cadastrada. {canManage ? "Cadastre as skills com nível atual e alvo." : "As skills aparecem quando forem cadastradas pela CRIVO ou por quem gere o programa."}</p>
      ) : (
        <div className="bars">
          {lista.map((s) => (
            <div key={s.id} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500 }}>
                <span>{s.name}</span>
                <span className="card__hint">gap {Math.max(0, s.target - s.current)}</span>
              </div>
              <div className="bar-row" style={{ gridTemplateColumns: "60px 1fr 40px" }}>
                <span className="card__hint">Atual</span>
                <div className="bar"><div className="bar__fill bar__fill--mid" style={{ width: `${s.current}%` }} /></div>
                <span className="bar-row__value">{s.current}</span>
              </div>
              <div className="bar-row" style={{ gridTemplateColumns: "60px 1fr 40px" }}>
                <span className="card__hint">Alvo</span>
                <div className="bar"><div className="bar__fill bar__fill--high" style={{ width: `${s.target}%` }} /></div>
                <span className="bar-row__value">{s.target}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cenários Pessoa × Processo × IA ────────────────────────────────────────

function CenariosTab({ tarefas, filtradas, areas, filtros, setFiltros, onOpen }: {
  tarefas: Recurso<WorkTaskData[]>;
  filtradas: WorkTaskData[];
  areas: string[];
  filtros: FiltroSet;
  setFiltros: FiltroSetters;
  onOpen: (id: string) => void;
}) {
  if (tarefas.status === "loading") return <p className="dash-state">Carregando cenários…</p>;
  if (tarefas.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar as tarefas. {tarefas.erro}</div>;

  // Comparação de 3 colunas (protótipo): só tarefas com ao menos uma narrativa
  // preenchida entram — evita 3 colunas vazias para quem ainda não descreveu cenário.
  const comparaveis = filtradas.filter((t) => t.scenarioCurrent || t.scenarioAssisted || t.scenarioRedesigned);

  // Visão secundária: agrupamento pela categoria única `scenario` (taxonomia CRIVO).
  const porCenario = new Map<WorkforceScenario, WorkTaskData[]>();
  for (const t of filtradas) porCenario.set(t.scenario, [...(porCenario.get(t.scenario) ?? []), t]);

  return (
    <>
      <Filtros areas={areas} filtros={filtros} setFiltros={setFiltros} />
      {(tarefas.data?.length ?? 0) === 0 && (
        <p className="dash-state">Nenhuma tarefa catalogada — os cenários narrativos são preenchidos tarefa a tarefa no cadastro.</p>
      )}

      {(tarefas.data?.length ?? 0) > 0 && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Cenários Pessoa × Processo × IA</h3>
              <span className="card__sub">Como o trabalho é feito hoje, com IA assistindo e redesenhado — lado a lado, por tarefa.</span>
            </div>
          </div>
          {comparaveis.length === 0 ? (
            <p className="dash-state" style={{ margin: 0 }}>
              Nenhuma tarefa{filtradas.length !== (tarefas.data?.length ?? 0) ? " (para os filtros aplicados)" : ""} tem os cenários narrativos preenchidos ainda. Descreva Cenário Atual, Assistido por IA e/ou Redesenhado no cadastro da tarefa para ela aparecer aqui.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th style={{ minWidth: 180 }}>Tarefa</th><th style={{ minWidth: 220 }}>Atual</th><th style={{ minWidth: 220 }}>Assistido por IA</th><th style={{ minWidth: 220 }}>Redesenhado</th></tr></thead>
                <tbody>
                  {comparaveis.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <a href="#" onClick={(e) => { e.preventDefault(); onOpen(t.id); }} style={{ color: "var(--gold-deep)" }}>
                          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--text-sec)" }}>{t.code}</span> <strong>{t.name}</strong>
                        </a>
                        <div className="card__hint">{t.processName} · {t.area}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{t.scenarioCurrent || "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.scenarioAssisted || "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.scenarioRedesigned || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(tarefas.data?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10, marginBottom: 8 }}>Visão secundária — por categoria de cenário</div>
          <div className="grid grid--3">
            {WORKFORCE_SCENARIOS.map((sc) => {
              const itens = porCenario.get(sc) ?? [];
              return (
                <div key={sc} className="card" style={{ marginBottom: 0 }}>
                  <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10 }}>{WORKFORCE_SCENARIO_LABEL[sc]}</div>
                  {itens.length === 0 ? (
                    <p className="card__hint" style={{ marginTop: 8 }}>Nenhuma tarefa neste cenário{filtradas.length !== (tarefas.data?.length ?? 0) ? " (para os filtros aplicados)" : ""}.</p>
                  ) : (
                    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8, fontSize: 12 }}>
                      {itens.map((t) => (
                        <li key={t.id} style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 8 }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); onOpen(t.id); }} style={{ color: "var(--gold-deep)" }}>
                            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--text-sec)" }}>{t.code}</span> {t.name}
                          </a>
                          <div className="card__hint">{t.processName} · IA {t.aiPotential}% · humano {t.humanEssentiality}% · {t.decision ? WORK_DECISION_LABEL[t.decision] : WORK_TASK_STAGE_LABEL[t.stage]}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Pilotos e Evolução ─────────────────────────────────────────────────────

function PilotosTab({ pilotos, canManage, onChanged, onNovo, onEditar }: {
  pilotos: Recurso<WorkPilotData[]>;
  canManage: boolean;
  onChanged: () => void;
  onNovo: () => void;
  onEditar: (p: WorkPilotData) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (pilotos.status === "loading") return <p className="dash-state">Carregando pilotos…</p>;
  if (pilotos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os pilotos. {pilotos.erro}</div>;
  const lista = pilotos.data ?? [];

  async function mudarStatus(p: WorkPilotData, status: WorkPilotStatus) {
    setBusy(p.id);
    try {
      await updateWorkPilot(p.id, { status });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Pilotos e blueprints</h3><span className="card__sub">Baseline, indicador e resultado com confiança declarada. Escala, revisa, suspende ou abandona conforme evidências e decisão da empresa.</span></div>
        {canManage && <button className="btn btn--outline-dark btn--sm" onClick={onNovo}><IconPlus /> Novo piloto</button>}
      </div>
      {lista.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>Nenhum piloto ou blueprint registrado. Eles nascem de cenários validados e decididos — e trazem resultado só quando medido.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="pill" style={{ fontSize: 11 }}>{WORK_PILOT_KIND_LABEL[p.kind]}</span>
                  <span className="pill" style={{ fontSize: 11 }}>Confiança {WORK_CONFIDENCE_LABEL[p.confidence]}</span>
                  {canManage ? (
                    <select className="select-pill" value={p.status} disabled={busy === p.id} onChange={(e) => mudarStatus(p, e.target.value as WorkPilotStatus)} style={{ fontSize: 12 }}>
                      {WORK_PILOT_STATUSES.map((s) => <option key={s} value={s}>{WORK_PILOT_STATUS_LABEL[s]}</option>)}
                    </select>
                  ) : (
                    <span className={p.status === "EM_ANDAMENTO" ? "pill pill--gold" : "pill"} style={{ fontSize: 11 }}>{WORK_PILOT_STATUS_LABEL[p.status]}</span>
                  )}
                  {canManage && <button className="btn btn--ghost-dark btn--sm" onClick={() => onEditar(p)}><IconEdit /> Editar</button>}
                </div>
              </div>
              <div className="card__hint" style={{ marginTop: 4 }}>Processo: {p.processName ?? "—"} · Baseline: {p.baseline || "—"}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}><b>Indicador:</b> {p.indicator || "—"} · <b>Resultado:</b> {p.result || "ainda não medido"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawer da tarefa (detalhe + validação CRIVO + decisão do cliente) ──────

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

function TarefaDrawer({ id, canManage, onClose, onChanged, onEdit }: {
  id: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (t: WorkTaskData) => void;
}) {
  const [tarefa, setTarefa] = useState<WorkTaskData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [decidindo, setDecidindo] = useState<WorkDecision | null>(null);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getWorkTask(id)
      .then((t) => { if (alive) setTarefa(t); })
      .catch((e) => { if (alive) setErro(e instanceof Error ? e.message : "Falha ao abrir a tarefa."); });
    return () => { alive = false; };
  }, [id]);

  async function decidir(decision: WorkDecision) {
    setDecidindo(decision);
    setErroDecisao(null);
    try {
      const atualizada = await decideWorkTask(id, { decision, note: nota.trim() || null });
      setTarefa(atualizada);
      setNota("");
      onChanged();
    } catch (e) {
      setErroDecisao(e instanceof Error ? e.message : "Falha ao registrar a decisão.");
    } finally {
      setDecidindo(null);
    }
  }

  const podeDecidir = !!tarefa && canManage && (tarefa.stage === "VALIDADO_CRIVO" || tarefa.stage === "DECIDIDO");
  const podeEditar = !!tarefa && canManage && (tarefa.stage === "RASCUNHO" || tarefa.stage === "EM_VALIDACAO_CRIVO");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            {tarefa && <span className="card__hint" style={{ fontFamily: "var(--font-mono, monospace)" }}>{tarefa.code} · {tarefa.processName} · {tarefa.role} · {tarefa.area}</span>}
            <h2 style={{ marginTop: 4 }}>{tarefa?.name ?? "Tarefa"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
          {!tarefa && !erro && <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>}
          {tarefa && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="pill" title="Origem epistêmica informada por quem mapeou">{INSIGHT_ORIGIN_LABEL[tarefa.origin]}</span>
                <span className="pill">Criticidade: {WORK_CRITICALITY_LABEL[tarefa.criticality]}</span>
                <span className={riskPill(tarefa.risk)}>Risco: {WORK_RISK_LABEL[tarefa.risk]}</span>
                <span className={stagePill(tarefa.stage)}>{WORK_TASK_STAGE_LABEL[tarefa.stage]}</span>
              </div>
              <Field label="Entrada" value={tarefa.input || "—"} />
              <Field label="Saída" value={tarefa.output || "—"} />
              <Field label="Volume mensal" value={`${tarefa.volumePerMonth} · Duração ${tarefa.durationMin} min`} />
              <Field label="Potencial IA vs. Essencialidade humana" value={`${tarefa.aiPotential}% · ${tarefa.humanEssentiality}% (julgamento informado, não score)`} />
              <Field label="Prontidão" value={`${tarefa.readiness}%`} />
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <Field label="Cenário de redesenho" value={WORKFORCE_SCENARIO_LABEL[tarefa.scenario]} />
              </div>
              {(tarefa.scenarioCurrent || tarefa.scenarioAssisted || tarefa.scenarioRedesigned) && (
                <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
                  <Field label="Cenário Atual" value={tarefa.scenarioCurrent || "—"} />
                  <Field label="Cenário Assistido por IA" value={tarefa.scenarioAssisted || "—"} />
                  <Field label="Cenário Redesenhado" value={tarefa.scenarioRedesigned || "—"} />
                </div>
              )}
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <Field
                  label="Validação CRIVO"
                  value={tarefa.validatedAt
                    ? <>Validada por {tarefa.validatedByName ?? "CRIVO"} em {fmtDateTime(tarefa.validatedAt)}{tarefa.validationNote && <> — <span style={{ color: "var(--text-sec)" }}>{tarefa.validationNote}</span></>}</>
                    : tarefa.stage === "EM_VALIDACAO_CRIVO" ? "Aguardando validação da CRIVO."
                    : tarefa.validationNote ? <>Devolvida pela CRIVO — <span style={{ color: "var(--text-sec)" }}>{tarefa.validationNote}</span></> : "Ainda não enviada para validação."}
                />
              </div>

              <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10, marginBottom: 8 }}>Decisão do cliente</div>
                {tarefa.decision ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={decisionPill(tarefa.decision)}>{WORK_DECISION_LABEL[tarefa.decision]}</span>
                      <span style={{ fontSize: 13 }}>por <b>{tarefa.decidedByName}</b> em {fmtDateTime(tarefa.decidedAt)}</span>
                    </div>
                    {tarefa.decisionNote && <div style={{ fontSize: 13, color: "var(--text-sec)" }}>{tarefa.decisionNote}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, marginBottom: 10 }}>Nenhuma decisão registrada.</div>
                )}
                {podeDecidir ? (
                  <>
                    <label className="prod-field prod-field--full">
                      <span>Nota (opcional)</span>
                      <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Condições, restrições ou motivo — fica registrado com a decisão." />
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {WORK_DECISIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`btn btn--sm ${d === "ACEITAR" ? "btn--gold" : d === "REJEITAR" ? "btn--outline-dark" : "btn--ghost-dark"}`}
                          disabled={!!decidindo}
                          onClick={() => decidir(d)}
                          title={d === "DEVOLVER" ? "Devolve a tarefa à fila de validação CRIVO" : `Leva a tarefa ao estágio “${WORK_TASK_STAGE_LABEL[WORK_DECISION_TO_STAGE[d]]}”`}
                        >
                          {decidindo === d ? "Registrando…" : WORK_DECISION_LABEL[d]}
                        </button>
                      ))}
                    </div>
                    {erroDecisao && <div className="dash-state dash-state--error" style={{ margin: "10px 0 0" }}>{erroDecisao}</div>}
                    <p className="card__hint" style={{ marginTop: 8 }}>A decisão é sua (humana) e fica registrada com quem decidiu e quando. A CRIVO valida o cenário; não decide.</p>
                  </>
                ) : (
                  <p className="card__hint" style={{ margin: 0 }}>
                    {!canManage
                      ? "Decisão disponível para quem tem a permissão “Gerir Workforce Intelligence”."
                      : "A decisão é registrada depois da validação CRIVO do cenário."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <div className="modal__foot">
          {podeEditar && tarefa && <button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => onEdit(tarefa)}>Editar cadastro</button>}
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ── Formulários (cadastro pela empresa — workforce:manage) ─────────────────

function ProcessoForm({ initial, onClose, onSaved }: { initial: WorkProcessData | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [limiar, setLimiar] = useState(String(initial?.aiThresholdPct ?? WORKFORCE_AI_THRESHOLD_DEFAULT));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      const dto = { name: name.trim(), area: area.trim(), aiThresholdPct: Number(limiar) };
      if (initial) await updateWorkProcess(initial.id, dto);
      else await createWorkProcess(dto);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar o processo.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? "Editar processo" : "Novo processo"}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Processo</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Faturamento" /></label>
            <label className="prod-field"><span>Área</span><input required value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Financeiro" /></label>
            <label className="prod-field">
              <span>Limiar de cobertura de IA (%)</span>
              <input type="number" min={0} max={100} required value={limiar} onChange={(e) => setLimiar(e.target.value)} />
            </label>
          </div>
          <p className="card__hint" style={{ marginTop: 8 }}>Tarefas com potencial IA igual ou acima do limiar contam na cobertura do processo. O limiar é uma escolha da sua empresa.</p>
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

function TarefaForm({ initial, processos, onClose, onSaved }: { initial: WorkTaskData | null; processos: WorkProcessData[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<UpsertWorkTaskRequest>({
    processId: initial?.processId ?? processos[0]?.id ?? "",
    role: initial?.role ?? "",
    area: initial?.area ?? (initial ? "" : processos[0]?.area ?? ""),
    name: initial?.name ?? "",
    input: initial?.input ?? "",
    output: initial?.output ?? "",
    volumePerMonth: initial?.volumePerMonth ?? 0,
    durationMin: initial?.durationMin ?? 0,
    criticality: initial?.criticality ?? "MEDIA",
    aiPotential: initial?.aiPotential ?? 0,
    humanEssentiality: initial?.humanEssentiality ?? 0,
    risk: initial?.risk ?? "MEDIO",
    readiness: initial?.readiness ?? 0,
    scenario: initial?.scenario ?? "MANTER_HUMANO",
    scenarioCurrent: initial?.scenarioCurrent ?? "",
    scenarioAssisted: initial?.scenarioAssisted ?? "",
    scenarioRedesigned: initial?.scenarioRedesigned ?? "",
    origin: initial?.origin ?? "HIPOTESE",
    stage: initial?.stage === "EM_VALIDACAO_CRIVO" ? "EM_VALIDACAO_CRIVO" : "RASCUNHO",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof UpsertWorkTaskRequest>(k: K, v: UpsertWorkTaskRequest[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      if (initial) await updateWorkTask(initial.id, f);
      else await createWorkTask(f);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? `Editar ${initial.code}` : "Nova tarefa"}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Tarefa</span><input required minLength={2} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Conciliação de notas fiscais" /></label>
            <label className="prod-field">
              <span>Processo</span>
              <select required value={f.processId} onChange={(e) => { const p = processos.find((x) => x.id === e.target.value); set("processId", e.target.value); if (p && !f.area) set("area", p.area); }}>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Função</span><input required value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="Ex.: Analista Fiscal" /></label>
            <label className="prod-field"><span>Área</span><input required value={f.area} onChange={(e) => set("area", e.target.value)} /></label>
            <label className="prod-field">
              <span>Origem</span>
              <select value={f.origin} onChange={(e) => set("origin", e.target.value as InsightOrigin)}>
                {INSIGHT_ORIGINS.map((o) => <option key={o} value={o}>{INSIGHT_ORIGIN_LABEL[o]}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Entrada</span><input value={f.input} onChange={(e) => set("input", e.target.value)} placeholder="Ex.: NFs, extratos" /></label>
            <label className="prod-field"><span>Saída</span><input value={f.output} onChange={(e) => set("output", e.target.value)} placeholder="Ex.: Relatório de divergências" /></label>
            <label className="prod-field"><span>Volume/mês</span><input type="number" min={0} value={f.volumePerMonth} onChange={(e) => set("volumePerMonth", num(e.target.value))} /></label>
            <label className="prod-field"><span>Duração (min)</span><input type="number" min={0} value={f.durationMin} onChange={(e) => set("durationMin", num(e.target.value))} /></label>
            <label className="prod-field">
              <span>Criticidade</span>
              <select value={f.criticality} onChange={(e) => set("criticality", e.target.value as WorkCriticality)}>
                {WORK_CRITICALITIES.map((c) => <option key={c} value={c}>{WORK_CRITICALITY_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Risco</span>
              <select value={f.risk} onChange={(e) => set("risk", e.target.value as WorkRisk)}>
                {WORK_RISKS.map((r) => <option key={r} value={r}>{WORK_RISK_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Potencial IA (%)</span><input type="number" min={0} max={100} value={f.aiPotential} onChange={(e) => set("aiPotential", Math.min(100, num(e.target.value)))} /></label>
            <label className="prod-field"><span>Essencialidade humana (%)</span><input type="number" min={0} max={100} value={f.humanEssentiality} onChange={(e) => set("humanEssentiality", Math.min(100, num(e.target.value)))} /></label>
            <label className="prod-field"><span>Prontidão (%)</span><input type="number" min={0} max={100} value={f.readiness} onChange={(e) => set("readiness", Math.min(100, num(e.target.value)))} /></label>
            <label className="prod-field">
              <span>Cenário de redesenho</span>
              <select value={f.scenario} onChange={(e) => set("scenario", e.target.value as WorkforceScenario)}>
                {WORKFORCE_SCENARIOS.map((s) => <option key={s} value={s}>{WORKFORCE_SCENARIO_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Estágio</span>
              <select value={f.stage} onChange={(e) => set("stage", e.target.value as "RASCUNHO" | "EM_VALIDACAO_CRIVO")}>
                <option value="RASCUNHO">Rascunho</option>
                <option value="EM_VALIDACAO_CRIVO">Enviar para validação CRIVO</option>
              </select>
            </label>
          </div>
          <p className="card__hint" style={{ marginTop: 8 }}>Potencial IA, essencialidade humana e prontidão são julgamentos de quem mapeou — não são calculados pela CRIVO.</p>
          <div style={{ display: "grid", gap: 10, marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <p className="card__hint" style={{ margin: 0 }}>Cenários narrativos (opcionais) — como a tarefa é feita hoje, com IA assistindo e redesenhada. Complementam o cenário de redesenho acima; nenhum é obrigatório.</p>
            <label className="prod-field prod-field--full">
              <span>Cenário Atual</span>
              <textarea rows={2} maxLength={2000} value={f.scenarioCurrent ?? ""} onChange={(e) => set("scenarioCurrent", e.target.value)} placeholder="Ex.: Análise manual documento a documento." />
            </label>
            <label className="prod-field prod-field--full">
              <span>Cenário Assistido por IA</span>
              <textarea rows={2} maxLength={2000} value={f.scenarioAssisted ?? ""} onChange={(e) => set("scenarioAssisted", e.target.value)} placeholder="Ex.: IA pré-valida e sinaliza divergências." />
            </label>
            <label className="prod-field prod-field--full">
              <span>Cenário Redesenhado</span>
              <textarea rows={2} maxLength={2000} value={f.scenarioRedesigned ?? ""} onChange={(e) => set("scenarioRedesigned", e.target.value)} placeholder="Ex.: Fluxo IA + revisão humana amostral." />
            </label>
          </div>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving || !f.processId}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function SkillsForm({ initial, onClose, onSaved }: { initial: WorkSkillData[]; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<Array<{ name: string; current: number; target: number }>>(
    initial.length ? initial.map((s) => ({ name: s.name, current: s.current, target: s.target })) : [{ name: "", current: 0, target: 0 }],
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const clamp = (v: string) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
  const upd = (i: number, patch: Partial<{ name: string; current: number; target: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      await saveWorkSkills({ skills: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), current: r.current, target: r.target })) });
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar as skills.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>Skills prioritárias</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <table className="data-table">
            <thead><tr><th>Skill</th><th style={{ width: 110 }}>Atual (0–100)</th><th style={{ width: 110 }}>Alvo (0–100)</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Ex.: Literacia em dados" style={{ width: "100%" }} /></td>
                  <td><input type="number" min={0} max={100} value={r.current} onChange={(e) => upd(i, { current: clamp(e.target.value) })} style={{ width: "100%" }} /></td>
                  <td><input type="number" min={0} max={100} value={r.target} onChange={(e) => upd(i, { target: clamp(e.target.value) })} style={{ width: "100%" }} /></td>
                  <td><button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} title="Remover">Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn--outline-dark btn--sm" style={{ marginTop: 10 }} onClick={() => setRows((x) => [...x, { name: "", current: 0, target: 0 }])}><IconPlus /> Adicionar skill</button>
          <p className="card__hint" style={{ marginTop: 8 }}>A lista substitui o conjunto atual: skills removidas aqui deixam de existir.</p>
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

function PilotoForm({ initial, processos, onClose, onSaved }: { initial: WorkPilotData | null; processos: WorkProcessData[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<WorkPilotKind>(initial?.kind ?? "PILOTO");
  const [processId, setProcessId] = useState(initial?.processId ?? "");
  const [baseline, setBaseline] = useState(initial?.baseline ?? "");
  const [indicator, setIndicator] = useState(initial?.indicator ?? "");
  const [result, setResult] = useState(initial?.result ?? "");
  const [confidence, setConfidence] = useState<WorkConfidence>(initial?.confidence ?? "MEDIA");
  const [status, setStatus] = useState<WorkPilotStatus>(initial?.status ?? "EM_ANDAMENTO");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      const dto = { name: name.trim(), kind, processId: processId || null, baseline: baseline.trim(), indicator: indicator.trim(), result: result.trim(), confidence, status };
      if (initial) await updateWorkPilot(initial.id, dto);
      else await createWorkPilot(dto);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar o piloto.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? "Editar piloto" : "Novo piloto ou blueprint"}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Nome</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Piloto atendimento assistido" /></label>
            <label className="prod-field">
              <span>Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as WorkPilotKind)}>
                {WORK_PILOT_KINDS.map((k) => <option key={k} value={k}>{WORK_PILOT_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Processo (opcional)</span>
              <select value={processId} onChange={(e) => setProcessId(e.target.value)}>
                <option value="">—</option>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Baseline</span><input value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="Ex.: TMA 6 min" /></label>
            <label className="prod-field"><span>Indicador</span><input value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Ex.: TMA / satisfação" /></label>
            <label className="prod-field prod-field--full"><span>Resultado medido (deixe vazio até medir)</span><input value={result} onChange={(e) => setResult(e.target.value)} /></label>
            <label className="prod-field">
              <span>Confiança</span>
              <select value={confidence} onChange={(e) => setConfidence(e.target.value as WorkConfidence)}>
                {WORK_CONFIDENCES.map((c) => <option key={c} value={c}>{WORK_CONFIDENCE_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as WorkPilotStatus)}>
                {WORK_PILOT_STATUSES.map((s) => <option key={s} value={s}>{WORK_PILOT_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
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
