"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  WORK_DECISION_LABEL,
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
  type WorkPilotData,
  type WorkPilotKind,
  type WorkPilotStatus,
  type WorkProcessData,
  type WorkRisk,
  type WorkSkillData,
  type WorkTaskData,
  type WorkTaskStage,
  type WorkforceAdminSummary,
  type WorkforceScenario,
} from "@crivo/types";
import {
  createTenantWorkPilot,
  createTenantWorkProcess,
  createTenantWorkTask,
  deleteTenantWorkPilot,
  deleteTenantWorkProcess,
  deleteTenantWorkTask,
  getAuditLog,
  getIntelligenceCompanies,
  getTenantWorkforceSummary,
  listTenantWorkPilots,
  listTenantWorkProcesses,
  listTenantWorkSkills,
  listTenantWorkTasks,
  saveTenantWorkSkills,
  updateTenantWorkPilot,
  updateTenantWorkProcess,
  updateTenantWorkTask,
  validateTenantWorkTask,
  type AuditEntry,
  type IntelligenceCompany,
} from "@/lib/admin-api";
import { downloadCsv } from "./ManagementReportsSection";

/**
 * Módulos › Workforce Intelligence — workspace da equipe CRIVO, POR EMPRESA,
 * sobre os MESMOS WorkProcess / WorkTask / WorkSkill / WorkPilot que o cliente
 * lê no portal (Programas › Workforce Intelligence), no layout do protótipo
 * Lovable do Super Admin (KPIs + abas + drill "Detalhamento por processo").
 * Fase 1: a CRIVO alimenta processos, tarefas, skills e pilotos e VALIDA as
 * tarefas (fila EM_VALIDACAO_CRIVO, nota obrigatória, auditado); a decisão
 * humana é do cliente e aparece aqui só como leitura (estágio DECIDIDO).
 *
 * Toda escrita passa pelo WorkforceService sob forTenant(orgId). A liberação
 * do módulo 'workforce' continua em Contratos e Liberações (chip aqui é só
 * leitura). Nada demonstrativo: toda aba nasce com estado vazio honesto.
 */

type Tab = "visao" | "processos" | "skills" | "cenarios" | "pilotos" | "validacao" | "auditoria";
const TABS: Array<[Tab, string]> = [
  ["visao", "Visão Executiva"],
  ["processos", "Processos e Tarefas"],
  ["skills", "Skills e Capacidade"],
  ["cenarios", "Cenários de Redesenho"],
  ["pilotos", "Blueprints e Pilotos"],
  ["validacao", "Validação CRIVO"],
  ["auditoria", "Governança e Auditoria"],
];

const AUDIT_PREFIXES = ["workforce."];
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

/** Caixa tracejada "Regras desta tela" (RuleBox do protótipo) — reusa .adm-callout. */
function RuleBox({ children }: { children: ReactNode }) {
  return <div className="adm-callout" style={{ borderStyle: "dashed", borderLeftStyle: "solid", marginTop: 16 }}>{children}</div>;
}

/** Chip de leitura (StatusChip do protótipo) — reusa .pill. */
function Chip({ tone, children, title }: { tone?: "gold" | "danger"; children: ReactNode; title?: string }) {
  return <span className={`pill${tone ? ` pill--${tone}` : ""}`} style={{ fontSize: 11 }} title={title}>{children}</span>;
}
const riskTone = (r: WorkRisk | null): "gold" | "danger" | undefined => (r === "ALTO" ? "danger" : r === "MEDIO" ? "gold" : undefined);
const stageTone = (s: WorkTaskStage): "gold" | "danger" | undefined => (s === "DECIDIDO" ? "gold" : s === "EM_VALIDACAO_CRIVO" ? "danger" : undefined);

/** Estado de carregamento de uma lista por empresa (remonta ao trocar o select via `key`). */
function useLista<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [res, setRes] = useState<{ key: string; data: T | null; err: string | null }>({ key: "", data: null, err: null });
  const key = JSON.stringify(deps);
  // Estado só muda APÓS o await (sem setState síncrono no effect): enquanto a
  // chave dos filtros não bate com a do resultado, a tabela mostra "carregando".
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => { if (alive) setRes({ key, data: d, err: null }); })
      .catch((e) => { if (alive) setRes({ key, data: null, err: e instanceof Error ? e.message : "Falha ao carregar." }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const atual = res.key === key;
  return { data: atual ? res.data : null, err: atual ? res.err : null };
}

export function WorkforceSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [companies, setCompanies] = useState<IntelligenceCompany[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [data, setData] = useState<WorkforceAdminSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [tab, setTab] = useState<Tab>("visao");
  const [drill, setDrill] = useState(false);
  // `tick` força as abas a recarregarem depois de uma escrita (CRUD/validação).
  const [tick, setTick] = useState(0);
  const bump = () => { setTick((t) => t + 1); void load(); };

  useEffect(() => {
    getIntelligenceCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  async function load(tid = tenantId) {
    if (!tid) return;
    setStatus("loading");
    try {
      setData(await getTenantWorkforceSummary(tid));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }
  function onSelect(tid: string) {
    setTenantId(tid);
    setData(null);
    if (tid) void load(tid);
  }

  const s = data?.summary;

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Workforce Intelligence</h1>
          <p className="page-sub">Prontidão → análise do trabalho → cenários pessoa-processo-IA → validação CRIVO → decisão do cliente → governança → plano → blueprint/piloto → evidências.</p>
        </div>
      </div>

      {/* Seletor de empresa — obrigatório (padrão Inteligência CRIVO / Governança de IA) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="prod-form__grid" style={{ alignItems: "end" }}>
          <label className="prod-field prod-field--full">
            <span>Empresa (CNPJ)</span>
            <select value={tenantId} onChange={(e) => onSelect(e.target.value)}>
              <option value="">Selecione uma empresa…</option>
              {(companies ?? []).map((c) => (
                <option key={c.tenantId} value={c.tenantId}>
                  {c.name}{c.cnpj ? ` · ${c.cnpj}` : ""}{c.groupName ? ` — grupo ${c.groupName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button className="btn btn--outline-dark btn--sm" disabled={!tenantId || status === "loading"} onClick={() => load()}>
              {status === "loading" ? "Carregando…" : "Recarregar"}
            </button>
          </div>
        </div>
      </div>

      {!tenantId && <p className="dash-state">Selecione uma empresa para operar o programa de Workforce Intelligence.</p>}
      {status === "loading" && !data && <p className="dash-state">Lendo processos, tarefas, skills e pilotos da empresa…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar o Workforce Intelligence desta empresa.</div>}

      {data && s && (
        <>
          <div className="adm-callout" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span><strong>Recorte:</strong> {data.company.name}{data.company.cnpj ? ` · ${data.company.cnpj}` : ""}</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
              <Chip tone={data.module.enabled ? "gold" : !data.module.availableForPlan ? "danger" : undefined}>
                {data.module.code}: {data.module.enabled ? "ativo" : !data.module.availableForPlan ? `requer plano ${data.module.minPlan}` : "inativo"}
              </Chip>
              {onNavigate && (
                <button className="btn btn--outline-dark btn--sm" onClick={() => onNavigate("contratos")} title="A liberação continua em Contratos e Liberações">
                  Liberar em Contratos
                </button>
              )}
            </span>
          </div>

          {!data.module.enabled && (
            <p className="dash-state">Módulo Workforce Intelligence não liberado para esta empresa — liberação em Contratos e Liberações. O que for cadastrado aqui só aparece no portal depois da liberação.</p>
          )}

          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label" title="Processos cadastrados no mapeamento">Processos mapeados</span>
              <strong className="kpi__value">{s.processes}</strong>
              <span className="card__hint">{s.areas.length} área(s) com tarefas</span>
            </div>
            <div className="kpi">
              <span className="kpi__label" title="Tarefas do trabalho real (qualquer estágio)">Tarefas</span>
              <strong className="kpi__value">{s.tasks}</strong>
              <span className="card__hint">{s.byStage.VALIDADO_CRIVO} validada(s) · {s.byStage.DECIDIDO} decidida(s)</span>
            </div>
            <div className="kpi">
              <span className="kpi__label" title="Tarefas na fila EM_VALIDACAO_CRIVO">Em validação CRIVO</span>
              <strong className="kpi__value">{s.byStage.EM_VALIDACAO_CRIVO}</strong>
              <span className="card__hint">{s.byStage.RASCUNHO} em rascunho</span>
            </div>
            <div className="kpi">
              <span className="kpi__label" title="Pilotos com status Em andamento">Pilotos em andamento</span>
              <strong className="kpi__value">{s.pilots.inProgress}</strong>
              <span className="card__hint">{s.pilots.blueprints} blueprint(s) · {s.pilots.concluded} concluído(s)</span>
            </div>
          </div>

          <div className="adm-tabs" style={{ marginTop: 18 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`adm-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button className="btn btn--ghost-dark btn--sm" onClick={() => setDrill(true)}>Abrir detalhamento por processo →</button>
          </div>

          {/* key por empresa+tick: cada aba remonta com estado limpo ao trocar o select ou após escrita */}
          {tab === "visao" && <VisaoTab key={`${tenantId}-${tick}`} tenantId={tenantId} summary={data} />}
          {tab === "processos" && <ProcessosTab key={`${tenantId}-${tick}`} tenantId={tenantId} areas={s.areas} onChanged={bump} />}
          {tab === "skills" && <SkillsTab key={`${tenantId}-${tick}`} tenantId={tenantId} onChanged={bump} />}
          {tab === "cenarios" && <CenariosTab key={`${tenantId}-${tick}`} tenantId={tenantId} />}
          {tab === "pilotos" && <PilotosTab key={`${tenantId}-${tick}`} tenantId={tenantId} onChanged={bump} />}
          {tab === "validacao" && <ValidacaoTab key={`${tenantId}-${tick}`} tenantId={tenantId} onChanged={bump} />}
          {tab === "auditoria" && <AuditoriaTab key={`${data.company.organizationId}-${tick}`} organizationId={data.company.organizationId} />}

          <RuleBox>
            <strong>Regras desta tela.</strong> O Workforce Intelligence não decide sobre contratação, desligamento ou redução de pessoas. Não exibe economia
            garantida. Cenários passam por validação CRIVO e decisão do cliente. Digital Workforce Design é capacidade/entrega dentro de Workforce
            Intelligence, não um módulo separado. Potencial IA, essencialidade humana e prontidão são julgamentos informados por quem mapeou — não são
            score CRIVO nem calculados por IA; a cobertura de IA usa o limiar definido em cada processo. A decisão humana é do cliente, no portal.
          </RuleBox>

          {drill && <DrillModal tenantId={tenantId} company={data.company.name} onClose={() => setDrill(false)} />}
        </>
      )}
    </div>
  );
}

// ── Visão Executiva (por processo: tarefas, cobertura, cenário predominante, risco, estágio) ──

function VisaoTab({ tenantId, summary }: { tenantId: string; summary: WorkforceAdminSummary }) {
  const procs = useLista(() => listTenantWorkProcesses(tenantId), [tenantId]);
  const s = summary.summary;
  return (
    <div className="card">
      <div className="card__head"><div><h3>Análises por processo</h3><span className="card__sub">Tarefas, cobertura de IA (limiar do processo), cenário predominante, maior risco e estágio — derivados das tarefas cadastradas.</span></div></div>
      <Tabela
        estado={procs}
        vazio="Nenhum processo mapeado — cadastre o primeiro processo em Processos e Tarefas."
        head={["Área", "Processo", "Tarefas", "Cobertura IA", "Cenário predominante", "Risco", "Estágio"]}
        rows={(procs.data ?? []).map((p) => [
          p.area,
          <strong key="n">{p.name}</strong>,
          p.tasksCount,
          p.aiCoveragePct == null ? "—" : `${p.aiCoveragePct}% (≥ ${p.aiThresholdPct}%)`,
          p.dominantScenario ? WORKFORCE_SCENARIO_LABEL[p.dominantScenario] : "—",
          p.highestRisk ? <Chip key="r" tone={riskTone(p.highestRisk)}>{WORK_RISK_LABEL[p.highestRisk]}</Chip> : "—",
          <EstagioResumo key="e" byStage={p.byStage} />,
        ])}
        keys={(procs.data ?? []).map((p) => p.id)}
      />
      {s.tasks > 0 && (
        <p className="card__hint" style={{ marginTop: 12 }}>
          Decisões do cliente: {WORK_DECISION_LABEL.ACEITAR.toLowerCase()} {s.byDecision.ACEITAR} · {WORK_DECISION_LABEL.CONDICIONAR.toLowerCase()} {s.byDecision.CONDICIONAR} · {WORK_DECISION_LABEL.DEVOLVER.toLowerCase()} {s.byDecision.DEVOLVER} · {WORK_DECISION_LABEL.REJEITAR.toLowerCase()} {s.byDecision.REJEITAR}.
        </p>
      )}
    </div>
  );
}

/** Estágio "predominante" do processo: o mais avançado com tarefas, com a contagem. */
function EstagioResumo({ byStage }: { byStage: Record<WorkTaskStage, number> }) {
  const partes = WORK_TASK_STAGES.filter((st) => byStage[st] > 0);
  if (partes.length === 0) return <span>—</span>;
  return <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{partes.map((st) => <Chip key={st} tone={stageTone(st)}>{byStage[st]} {WORK_TASK_STAGE_LABEL[st]}</Chip>)}</span>;
}

// ── Processos e Tarefas (CRUD pelo consultor CRIVO) ──

function ProcessosTab({ tenantId, areas, onChanged }: { tenantId: string; areas: string[]; onChanged: () => void }) {
  const procs = useLista(() => listTenantWorkProcesses(tenantId), [tenantId]);
  const [area, setArea] = useState("");
  const [risk, setRisk] = useState("");
  const [stage, setStage] = useState("");
  const [processId, setProcessId] = useState("");
  const tarefas = useLista(() => listTenantWorkTasks(tenantId, { area, risk, stage, processId }), [tenantId, area, risk, stage, processId]);
  const [procForm, setProcForm] = useState<{ open: boolean; initial: WorkProcessData | null }>({ open: false, initial: null });
  const [taskForm, setTaskForm] = useState<{ open: boolean; initial: WorkTaskData | null }>({ open: false, initial: null });
  const [aberta, setAberta] = useState<WorkTaskData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function excluirProcesso(p: WorkProcessData) {
    if (!window.confirm(`Excluir o processo "${p.name}" e suas ${p.tasksCount} tarefa(s)? A ação é auditada.`)) return;
    setBusy(p.id);
    try { await deleteTenantWorkProcess(tenantId, p.id); onChanged(); } finally { setBusy(null); }
  }
  async function excluirTarefa(t: WorkTaskData) {
    if (!window.confirm(`Excluir a tarefa ${t.code} · ${t.name}? A ação é auditada.`)) return;
    setBusy(t.id);
    try { await deleteTenantWorkTask(tenantId, t.id); onChanged(); } finally { setBusy(null); }
  }

  return (
    <>
      <div className="card">
        <div className="card__head">
          <div><h3>Processos</h3><span className="card__sub">Cada processo tem o seu limiar de cobertura de IA (informado pela empresa; 60 é só o default do campo).</span></div>
          <button className="btn btn--gold btn--sm" onClick={() => setProcForm({ open: true, initial: null })}>Novo processo</button>
        </div>
        <Tabela
          estado={procs}
          vazio="Nenhum processo mapeado — cadastre o primeiro processo."
          head={["Processo", "Área", "Tarefas", "Limiar IA", "Cobertura IA", ""]}
          rows={(procs.data ?? []).map((p) => [
            <strong key="n">{p.name}</strong>, p.area, p.tasksCount, `${p.aiThresholdPct}%`, p.aiCoveragePct == null ? "—" : `${p.aiCoveragePct}%`,
            <span key="a" style={{ display: "flex", gap: 6 }}>
              <button className="btn btn--outline-dark btn--sm" onClick={() => setProcForm({ open: true, initial: p })}>Editar</button>
              <button className="btn btn--ghost-dark btn--sm" disabled={busy === p.id} onClick={() => excluirProcesso(p)}>Excluir</button>
            </span>,
          ])}
          keys={(procs.data ?? []).map((p) => p.id)}
        />
      </div>

      <div className="card">
        <div className="card__head">
          <div><h3>Tarefas e trabalho real</h3><span className="card__sub">Decomposição tarefa a tarefa com atributos de risco, esforço e valor. Envie para a fila de validação CRIVO pelo estágio.</span></div>
          <button className="btn btn--gold btn--sm" disabled={!procs.data?.length} title={!procs.data?.length ? "Cadastre um processo primeiro" : undefined} onClick={() => setTaskForm({ open: true, initial: null })}>Nova tarefa</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <label className="prod-field" style={{ minWidth: 160 }}><span>Processo</span>
            <select value={processId} onChange={(e) => setProcessId(e.target.value)}><option value="">Todos os processos</option>{(procs.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="prod-field" style={{ minWidth: 150 }}><span>Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          </label>
          <label className="prod-field" style={{ minWidth: 140 }}><span>Risco</span>
            <select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">Todos os riscos</option>{WORK_RISKS.map((r) => <option key={r} value={r}>{WORK_RISK_LABEL[r]}</option>)}</select>
          </label>
          <label className="prod-field" style={{ minWidth: 170 }}><span>Estágio</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)}><option value="">Todos os estágios</option>{WORK_TASK_STAGES.map((x) => <option key={x} value={x}>{WORK_TASK_STAGE_LABEL[x]}</option>)}</select>
          </label>
        </div>
        <Tabela
          estado={tarefas}
          vazio={area || risk || stage || processId ? "Nenhuma tarefa para os filtros aplicados." : "Nenhuma tarefa cadastrada — a decomposição do trabalho real começa aqui."}
          head={["ID", "Tarefa", "Processo", "Função", "Volume/mês", "Potencial IA", "Risco", "Origem", "Estágio", ""]}
          rows={(tarefas.data ?? []).map((t) => [
            <span key="c" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>{t.code}</span>,
            <a key="n" href="#" onClick={(e) => { e.preventDefault(); setAberta(t); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{t.name}</a>,
            t.processName, t.role, t.volumePerMonth, `${t.aiPotential}%`,
            <Chip key="r" tone={riskTone(t.risk)}>{WORK_RISK_LABEL[t.risk]}</Chip>,
            INSIGHT_ORIGIN_LABEL[t.origin],
            <Chip key="s" tone={stageTone(t.stage)}>{t.stage === "DECIDIDO" && t.decision ? `${WORK_DECISION_LABEL[t.decision]} (cliente)` : WORK_TASK_STAGE_LABEL[t.stage]}</Chip>,
            <span key="a" style={{ display: "flex", gap: 6 }}>
              <button className="btn btn--outline-dark btn--sm" onClick={() => setTaskForm({ open: true, initial: t })}>Editar</button>
              <button className="btn btn--ghost-dark btn--sm" disabled={busy === t.id} onClick={() => excluirTarefa(t)}>Excluir</button>
            </span>,
          ])}
          keys={(tarefas.data ?? []).map((t) => t.id)}
        />
      </div>

      {procForm.open && <ProcessoForm tenantId={tenantId} initial={procForm.initial} onClose={() => setProcForm({ open: false, initial: null })} onSaved={() => { setProcForm({ open: false, initial: null }); onChanged(); }} />}
      {taskForm.open && <TarefaForm tenantId={tenantId} initial={taskForm.initial} processos={procs.data ?? []} onClose={() => setTaskForm({ open: false, initial: null })} onSaved={() => { setTaskForm({ open: false, initial: null }); onChanged(); }} />}
      {aberta && <TarefaModal tarefa={aberta} onClose={() => setAberta(null)} />}
    </>
  );
}

// ── Skills e Capacidade (atual × alvo) ──

function SkillsTab({ tenantId, onChanged }: { tenantId: string; onChanged: () => void }) {
  const skills = useLista(() => listTenantWorkSkills(tenantId), [tenantId]);
  const [editando, setEditando] = useState(false);
  const gapTone = (gap: number): "gold" | "danger" | undefined => (gap >= 30 ? "danger" : gap >= 15 ? "gold" : undefined);
  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Skills e capacidade</h3><span className="card__sub">Nível atual × desejado (0–100), agregado da empresa. Gap = alvo − atual. Valores informados, não calculados.</span></div>
        <button className="btn btn--gold btn--sm" onClick={() => setEditando(true)}>{skills.data?.length ? "Editar skills" : "Cadastrar skills"}</button>
      </div>
      <Tabela
        estado={skills}
        vazio="Nenhuma skill prioritária cadastrada para esta empresa."
        head={["Skill", "Nível atual", "Nível desejado", "Gap"]}
        rows={(skills.data ?? []).map((s) => {
          const gap = Math.max(0, s.target - s.current);
          return [<strong key="n">{s.name}</strong>, s.current, s.target, <Chip key="g" tone={gapTone(gap)}>{gap}</Chip>];
        })}
        keys={(skills.data ?? []).map((s) => s.id)}
      />
      {editando && <SkillsForm tenantId={tenantId} initial={skills.data ?? []} onClose={() => setEditando(false)} onSaved={() => { setEditando(false); onChanged(); }} />}
    </div>
  );
}

// ── Cenários de Redesenho (taxonomia fixa + tarefas por cenário) ──

function CenariosTab({ tenantId }: { tenantId: string }) {
  const tarefas = useLista(() => listTenantWorkTasks(tenantId), [tenantId]);
  const porCenario = useMemo(() => {
    const m = new Map<WorkforceScenario, WorkTaskData[]>();
    for (const t of tarefas.data ?? []) m.set(t.scenario, [...(m.get(t.scenario) ?? []), t]);
    return m;
  }, [tarefas.data]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Cenários de redesenho</h3><span className="card__sub">Taxonomia fixa CRIVO (7 cenários). Cada tarefa recebe um cenário; a validação CRIVO e a decisão do cliente incidem sobre ele.</span></div></div>
      {tarefas.err && <div className="dash-state dash-state--error">{tarefas.err}</div>}
      {!tarefas.data && !tarefas.err && <p className="dash-state">Carregando…</p>}
      {tarefas.data && (
        <div className="grid grid--3">
          {WORKFORCE_SCENARIOS.map((sc) => {
            const itens = porCenario.get(sc) ?? [];
            return (
              <div key={sc} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{WORKFORCE_SCENARIO_LABEL[sc]}</span>
                  <Chip tone={itens.length ? "gold" : undefined}>{itens.length}</Chip>
                </div>
                {itens.length === 0 ? (
                  <p className="card__hint" style={{ marginTop: 6 }}>Nenhuma tarefa neste cenário.</p>
                ) : (
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}>
                    {itens.map((t) => (
                      <li key={t.id} style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 8 }}>
                        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--text-sec)" }}>{t.code}</span> {t.name}
                        <div className="card__hint">{t.processName} · {WORK_TASK_STAGE_LABEL[t.stage]}{t.decision ? ` · ${WORK_DECISION_LABEL[t.decision]}` : ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Blueprints e Pilotos ──

function PilotosTab({ tenantId, onChanged }: { tenantId: string; onChanged: () => void }) {
  const pilotos = useLista(() => listTenantWorkPilots(tenantId), [tenantId]);
  const [form, setForm] = useState<{ open: boolean; initial: WorkPilotData | null }>({ open: false, initial: null });
  const [busy, setBusy] = useState<string | null>(null);
  async function excluir(p: WorkPilotData) {
    if (!window.confirm(`Excluir "${p.name}"? A ação é auditada.`)) return;
    setBusy(p.id);
    try { await deleteTenantWorkPilot(tenantId, p.id); onChanged(); } finally { setBusy(null); }
  }
  async function mudarStatus(p: WorkPilotData, status: WorkPilotStatus) {
    setBusy(p.id);
    try { await updateTenantWorkPilot(tenantId, p.id, { status }); onChanged(); } finally { setBusy(null); }
  }
  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Blueprints e pilotos</h3><span className="card__sub">Entregas dentro do módulo (não são códigos de módulo). Resultado só quando medido, com confiança declarada. Escala, revisa, suspende ou abandona conforme evidências e decisão do cliente.</span></div>
        <button className="btn btn--gold btn--sm" onClick={() => setForm({ open: true, initial: null })}>Novo piloto / blueprint</button>
      </div>
      <Tabela
        estado={pilotos}
        vazio="Nenhum blueprint ou piloto registrado para esta empresa."
        head={["Nome", "Tipo", "Processo", "Baseline", "Indicador", "Resultado", "Confiança", "Status", ""]}
        rows={(pilotos.data ?? []).map((p) => [
          <strong key="n">{p.name}</strong>, WORK_PILOT_KIND_LABEL[p.kind], p.processName ?? "—", p.baseline || "—", p.indicator || "—", p.result || "ainda não medido",
          <Chip key="c">{WORK_CONFIDENCE_LABEL[p.confidence]}</Chip>,
          <select key="s" className="select-pill" value={p.status} disabled={busy === p.id} onChange={(e) => mudarStatus(p, e.target.value as WorkPilotStatus)} style={{ fontSize: 12 }}>
            {WORK_PILOT_STATUSES.map((st) => <option key={st} value={st}>{WORK_PILOT_STATUS_LABEL[st]}</option>)}
          </select>,
          <span key="a" style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--outline-dark btn--sm" onClick={() => setForm({ open: true, initial: p })}>Editar</button>
            <button className="btn btn--ghost-dark btn--sm" disabled={busy === p.id} onClick={() => excluir(p)}>Excluir</button>
          </span>,
        ])}
        keys={(pilotos.data ?? []).map((p) => p.id)}
      />
      {form.open && <PilotoForm tenantId={tenantId} initial={form.initial} onClose={() => setForm({ open: false, initial: null })} onSaved={() => { setForm({ open: false, initial: null }); onChanged(); }} />}
    </div>
  );
}

// ── Validação CRIVO (fila EM_VALIDACAO_CRIVO: validar / devolver com nota obrigatória) ──

function ValidacaoTab({ tenantId, onChanged }: { tenantId: string; onChanged: () => void }) {
  const fila = useLista(() => listTenantWorkTasks(tenantId, { stage: "EM_VALIDACAO_CRIVO" }), [tenantId]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<WorkTaskData | null>(null);

  async function agir(t: WorkTaskData, result: "VALIDADO" | "DEVOLVIDO") {
    const note = (notas[t.id] ?? "").trim();
    if (!note) { setErro(`Escreva a nota da ${result === "VALIDADO" ? "validação" : "devolução"} de ${t.code} — ela fica na tarefa e na auditoria.`); return; }
    setBusy(t.id);
    setErro(null);
    try {
      await validateTenantWorkTask(tenantId, t.id, { result, note });
      onChanged();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a validação.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card__head"><div><h3>Validação CRIVO</h3><span className="card__sub">Tarefas enviadas pelo consultor (ou pela empresa) aguardando a validação do cenário. Validar libera a decisão do cliente no portal; devolver leva a tarefa de volta a rascunho com a nota.</span></div></div>
      {erro && <div className="dash-state dash-state--error">{erro}</div>}
      {fila.err && <div className="dash-state dash-state--error">{fila.err}</div>}
      {!fila.data && !fila.err && <p className="dash-state">Carregando fila…</p>}
      {fila.data && fila.data.length === 0 && <p className="dash-state" style={{ margin: 0 }}>Nenhuma tarefa aguardando validação.</p>}
      {fila.data && fila.data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fila.data.map((t) => (
            <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--text-sec)" }}>{t.code}</span>{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); setAberta(t); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{t.name}</a>
                  <div className="card__hint">{t.processName} · {t.role} · {t.area} · cenário {WORKFORCE_SCENARIO_LABEL[t.scenario]} · IA {t.aiPotential}% · humano {t.humanEssentiality}% · prontidão {t.readiness}%</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip>{INSIGHT_ORIGIN_LABEL[t.origin]}</Chip>
                  <Chip tone={riskTone(t.risk)}>{WORK_RISK_LABEL[t.risk]}</Chip>
                  {t.decision === "DEVOLVER" && <Chip tone="danger" title={t.decisionNote ?? undefined}>Devolvida pelo cliente ({t.decidedByName})</Chip>}
                </div>
              </div>
              {t.decision === "DEVOLVER" && t.decisionNote && <p style={{ fontSize: 13, color: "var(--text-sec)", margin: "6px 0 0" }}>Nota do cliente: {t.decisionNote}</p>}
              <div className="prod-form__grid" style={{ marginTop: 10 }}>
                <label className="prod-field prod-field--full">
                  <span>Nota da validação (obrigatória)</span>
                  <textarea rows={2} value={notas[t.id] ?? ""} onChange={(e) => setNotas((n) => ({ ...n, [t.id]: e.target.value }))} placeholder="O que foi verificado; por que o cenário se sustenta (ou o que falta)." />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn--gold btn--sm" disabled={busy === t.id} onClick={() => agir(t, "VALIDADO")}>{busy === t.id ? "Registrando…" : "Validar"}</button>
                <button className="btn btn--outline-dark btn--sm" disabled={busy === t.id} onClick={() => agir(t, "DEVOLVIDO")}>Devolver</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {aberta && <TarefaModal tarefa={aberta} onClose={() => setAberta(null)} />}
    </div>
  );
}

// ── Auditoria (AuditLog filtrado por empresa + prefixo workforce.) ──

function AuditoriaTab({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getAuditLog({ tenantId: organizationId, prefixes: AUDIT_PREFIXES, limit: 100 })
      .then((r) => { if (alive) setRows(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Falha ao carregar auditoria."); });
    return () => { alive = false; };
  }, [organizationId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Governança e trilha completa das decisões</h3><span className="card__sub">Eventos workforce.* desta empresa: cadastro e validação pela CRIVO, decisões do cliente no portal e consultas deste painel.</span></div></div>
      {err && <div className="dash-state dash-state--error">{err}</div>}
      {rows === null && !err && <p className="dash-state">Carregando…</p>}
      {rows && rows.length === 0 && <p className="dash-state">Nenhum evento registrado para esta empresa ainda.</p>}
      {rows && rows.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Quando</th><th>Ação</th><th>Quem</th><th>Alvo</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{fmtDateTime(r.at)}</td><td><strong>{AUDIT_LABEL[r.action] ?? r.action}</strong></td><td>{r.actorEmail ?? "—"}</td><td>{r.target ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  "workforce.view": "Painel consultado",
  "workforce.process.create": "Processo cadastrado",
  "workforce.process.update": "Processo alterado",
  "workforce.process.delete": "Processo excluído",
  "workforce.task.create": "Tarefa cadastrada",
  "workforce.task.update": "Tarefa alterada",
  "workforce.task.delete": "Tarefa excluída",
  "workforce.task.validate": "Validação CRIVO",
  "workforce.task.decision": "Decisão do cliente (portal)",
  "workforce.skills.update": "Skills atualizadas",
  "workforce.pilot.create": "Piloto/blueprint cadastrado",
  "workforce.pilot.update": "Piloto/blueprint alterado",
  "workforce.pilot.delete": "Piloto/blueprint excluído",
};

// ── Detalhamento por processo (drill + export CSV) ──

function DrillModal({ tenantId, company, onClose }: { tenantId: string; company: string; onClose: () => void }) {
  const procs = useLista(() => listTenantWorkProcesses(tenantId), [tenantId]);
  const tarefas = useLista(() => listTenantWorkTasks(tenantId), [tenantId]);
  const linhas = useMemo(() => (procs.data ?? []).map((p) => ({
    processo: p.name,
    area: p.area,
    tarefas: p.tasksCount,
    automatizavel: p.aiCoveragePct == null ? "—" : `${p.aiCoveragePct}%`,
    limiar: `${p.aiThresholdPct}%`,
    risco: p.highestRisk ? WORK_RISK_LABEL[p.highestRisk] : "—",
    cenario: p.dominantScenario ? WORKFORCE_SCENARIO_LABEL[p.dominantScenario] : "—",
  })), [procs.data]);

  function exportar() {
    const geradoEm = new Date().toLocaleString("pt-BR");
    const porTarefa = (tarefas.data ?? []).map((t): (string | number)[] => [
      t.code, t.processName, t.area, t.role, t.name, t.volumePerMonth, t.durationMin, WORK_CRITICALITY_LABEL[t.criticality], t.aiPotential, t.humanEssentiality,
      WORK_RISK_LABEL[t.risk], t.readiness, WORKFORCE_SCENARIO_LABEL[t.scenario], INSIGHT_ORIGIN_LABEL[t.origin], WORK_TASK_STAGE_LABEL[t.stage],
      t.decision ? WORK_DECISION_LABEL[t.decision] : "—", t.decidedByName ?? "—", fmtDateTime(t.decidedAt),
    ]);
    downloadCsv("workforce-processos-detalhamento.csv", [
      ["Empresa", company],
      ["Gerado em", geradoEm],
      ["Cobertura de IA", "% de tarefas com potencial IA ≥ limiar do processo (limiar informado pela empresa; percentuais são julgamentos, não score)"],
      [],
      ["Processo", "Área", "Tarefas", "Cobertura IA", "Limiar", "Maior risco", "Cenário predominante"],
      ...linhas.map((l): (string | number)[] => [l.processo, l.area, l.tarefas, l.automatizavel, l.limiar, l.risco, l.cenario]),
      [],
      ["ID", "Processo", "Área", "Função", "Tarefa", "Volume/mês", "Duração (min)", "Criticidade", "Potencial IA", "Essenc. humana", "Risco", "Prontidão", "Cenário", "Origem", "Estágio", "Decisão", "Decidido por", "Decidido em"],
      ...porTarefa,
    ]);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <h2>Detalhamento por processo</h2>
            <span className="card__hint">Registros que compõem os cenários e blueprints exibidos — {company}.</span>
          </div>
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </header>
        <div className="modal__body">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip>Amostra · {procs.data?.length ?? 0} processo(s) · {tarefas.data?.length ?? 0} tarefa(s)</Chip>
            <Chip title="Cobertura = % de tarefas com potencial IA ≥ limiar do processo">Cobertura por limiar do processo</Chip>
          </div>
          <Tabela
            estado={procs}
            vazio="Nenhum processo mapeado — não há detalhamento a exportar."
            head={["Processo", "Área", "Tarefas", "Cobertura IA", "Limiar", "Risco", "Cenário predominante"]}
            rows={linhas.map((l) => [<strong key="p">{l.processo}</strong>, l.area, l.tarefas, l.automatizavel, l.limiar, l.risco, l.cenario])}
            keys={(procs.data ?? []).map((p) => p.id)}
          />
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--gold btn--sm" disabled={!procs.data?.length || !tarefas.data} onClick={exportar}>Exportar CSV</button>
        </div>
      </div>
    </div>
  );
}

// ── Detalhe da tarefa (somente leitura — inclui validação e decisão do cliente) ──

function F({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div><div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 10, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 14 }}>{value}</div></div>
  );
}

function TarefaModal({ tarefa: t, onClose }: { tarefa: WorkTaskData; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <span className="card__hint">{t.code} · {t.processName} · {t.role} · {t.area}</span>
            <h2 style={{ marginTop: 4 }}>{t.name}</h2>
          </div>
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip>{INSIGHT_ORIGIN_LABEL[t.origin]}</Chip>
            <Chip>Criticidade: {WORK_CRITICALITY_LABEL[t.criticality]}</Chip>
            <Chip tone={riskTone(t.risk)}>Risco: {WORK_RISK_LABEL[t.risk]}</Chip>
            <Chip tone={stageTone(t.stage)}>{WORK_TASK_STAGE_LABEL[t.stage]}</Chip>
          </div>
          <F label="Entrada" value={t.input || "—"} />
          <F label="Saída" value={t.output || "—"} />
          <F label="Volume mensal" value={`${t.volumePerMonth} · Duração ${t.durationMin} min`} />
          <F label="Potencial IA vs. Essencialidade humana" value={`${t.aiPotential}% · ${t.humanEssentiality}% (julgamento informado)`} />
          <F label="Prontidão" value={`${t.readiness}%`} />
          <F label="Cenário de redesenho" value={WORKFORCE_SCENARIO_LABEL[t.scenario]} />
          <F label="Validação CRIVO" value={t.validatedAt ? `${t.validatedByName ?? "CRIVO"} · ${fmtDateTime(t.validatedAt)} — ${t.validationNote ?? ""}` : t.validationNote ? `Devolvida — ${t.validationNote}` : "—"} />
          <F label="Decisão do cliente" value={t.decision ? `${WORK_DECISION_LABEL[t.decision]} · ${t.decidedByName} · ${fmtDateTime(t.decidedAt)}${t.decisionNote ? ` — ${t.decisionNote}` : ""}` : "— (sem decisão)"} />
          <p className="card__hint" style={{ margin: 0 }}>A decisão é do cliente, no portal; a CRIVO valida o cenário.</p>
        </div>
      </div>
    </div>
  );
}

// ── Formulários (CRUD pelo consultor CRIVO) ──

function ProcessoForm({ tenantId, initial, onClose, onSaved }: { tenantId: string; initial: WorkProcessData | null; onClose: () => void; onSaved: () => void }) {
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
      if (initial) await updateTenantWorkProcess(tenantId, initial.id, dto);
      else await createTenantWorkProcess(tenantId, dto);
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
        <header className="modal__head"><h2>{initial ? "Editar processo" : "Novo processo"}</h2><button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Processo</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fechamento contábil mensal" /></label>
            <label className="prod-field"><span>Área</span><input required value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Financeiro" /></label>
            <label className="prod-field"><span>Limiar de cobertura de IA (%)</span><input type="number" min={0} max={100} required value={limiar} onChange={(e) => setLimiar(e.target.value)} /></label>
          </div>
          <p className="card__hint" style={{ marginTop: 8 }}>Tarefas com potencial IA ≥ limiar contam na cobertura. O limiar é da empresa (combine com o cliente); 60 é só o default do campo.</p>
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

function TarefaForm({ tenantId, initial, processos, onClose, onSaved }: { tenantId: string; initial: WorkTaskData | null; processos: WorkProcessData[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<UpsertWorkTaskRequest>({
    processId: initial?.processId ?? processos[0]?.id ?? "",
    role: initial?.role ?? "",
    area: initial?.area ?? processos[0]?.area ?? "",
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
    origin: initial?.origin ?? "HIPOTESE",
    stage: initial?.stage === "EM_VALIDACAO_CRIVO" ? "EM_VALIDACAO_CRIVO" : "RASCUNHO",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof UpsertWorkTaskRequest>(k: K, v: UpsertWorkTaskRequest[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const pct = (v: string) => Math.min(100, num(v));
  const travada = !!initial && (initial.stage === "VALIDADO_CRIVO" || initial.stage === "DECIDIDO");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      if (initial) await updateTenantWorkTask(tenantId, initial.id, f);
      else await createTenantWorkTask(tenantId, f);
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
        <header className="modal__head"><h2>{initial ? `Editar ${initial.code}` : "Nova tarefa"}</h2><button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button></header>
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
              <span>Origem (Fato / Inferência / Hipótese / Recomendação)</span>
              <select value={f.origin} onChange={(e) => set("origin", e.target.value as InsightOrigin)}>
                {INSIGHT_ORIGINS.map((o) => <option key={o} value={o}>{INSIGHT_ORIGIN_LABEL[o]}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Entrada</span><input value={f.input} onChange={(e) => set("input", e.target.value)} /></label>
            <label className="prod-field"><span>Saída</span><input value={f.output} onChange={(e) => set("output", e.target.value)} /></label>
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
            <label className="prod-field"><span>Potencial IA (%)</span><input type="number" min={0} max={100} value={f.aiPotential} onChange={(e) => set("aiPotential", pct(e.target.value))} /></label>
            <label className="prod-field"><span>Essencialidade humana (%)</span><input type="number" min={0} max={100} value={f.humanEssentiality} onChange={(e) => set("humanEssentiality", pct(e.target.value))} /></label>
            <label className="prod-field"><span>Prontidão (%)</span><input type="number" min={0} max={100} value={f.readiness} onChange={(e) => set("readiness", pct(e.target.value))} /></label>
            <label className="prod-field">
              <span>Cenário de redesenho</span>
              <select value={f.scenario} onChange={(e) => set("scenario", e.target.value as WorkforceScenario)}>
                {WORKFORCE_SCENARIOS.map((s) => <option key={s} value={s}>{WORKFORCE_SCENARIO_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="prod-field">
              <span>Estágio</span>
              <select value={f.stage} disabled={travada} onChange={(e) => set("stage", e.target.value as "RASCUNHO" | "EM_VALIDACAO_CRIVO")}>
                <option value="RASCUNHO">Rascunho</option>
                <option value="EM_VALIDACAO_CRIVO">Enviar para validação CRIVO</option>
              </select>
            </label>
          </div>
          <p className="card__hint" style={{ marginTop: 8 }}>
            {travada ? `Tarefa ${WORK_TASK_STAGE_LABEL[initial!.stage].toLowerCase()}: o estágio só muda por validação ou decisão do cliente. ` : ""}
            Potencial IA, essencialidade humana e prontidão são julgamentos de quem mapeou — não são calculados pela CRIVO.
          </p>
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

function SkillsForm({ tenantId, initial, onClose, onSaved }: { tenantId: string; initial: WorkSkillData[]; onClose: () => void; onSaved: () => void }) {
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
      await saveTenantWorkSkills(tenantId, { skills: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), current: r.current, target: r.target })) });
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
        <header className="modal__head"><h2>Skills e capacidade</h2><button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button></header>
        <div className="modal__body prod-form">
          <table className="data-table">
            <thead><tr><th>Skill</th><th style={{ width: 110 }}>Atual (0–100)</th><th style={{ width: 110 }}>Desejado (0–100)</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Ex.: Colaboração com IA" style={{ width: "100%" }} /></td>
                  <td><input type="number" min={0} max={100} value={r.current} onChange={(e) => upd(i, { current: clamp(e.target.value) })} style={{ width: "100%" }} /></td>
                  <td><input type="number" min={0} max={100} value={r.target} onChange={(e) => upd(i, { target: clamp(e.target.value) })} style={{ width: "100%" }} /></td>
                  <td><button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn--outline-dark btn--sm" style={{ marginTop: 10 }} onClick={() => setRows((x) => [...x, { name: "", current: 0, target: 0 }])}>Adicionar skill</button>
          <p className="card__hint" style={{ marginTop: 8 }}>A lista substitui o conjunto atual da empresa (auditado).</p>
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

function PilotoForm({ tenantId, initial, onClose, onSaved }: { tenantId: string; initial: WorkPilotData | null; onClose: () => void; onSaved: () => void }) {
  const procs = useLista(() => listTenantWorkProcesses(tenantId), [tenantId]);
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
      if (initial) await updateTenantWorkPilot(tenantId, initial.id, dto);
      else await createTenantWorkPilot(tenantId, dto);
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? "Editar piloto / blueprint" : "Novo piloto / blueprint"}</h2><button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Nome</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Blueprint Atendimento N1" /></label>
            <label className="prod-field">
              <span>Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as WorkPilotKind)}>{WORK_PILOT_KINDS.map((k) => <option key={k} value={k}>{WORK_PILOT_KIND_LABEL[k]}</option>)}</select>
            </label>
            <label className="prod-field">
              <span>Processo (opcional)</span>
              <select value={processId} onChange={(e) => setProcessId(e.target.value)}><option value="">—</option>{(procs.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="prod-field"><span>Baseline</span><input value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="Ex.: 18 min/nota" /></label>
            <label className="prod-field"><span>Indicador</span><input value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Ex.: Tempo médio / exceções" /></label>
            <label className="prod-field prod-field--full"><span>Resultado medido (vazio até medir — nunca estimativa)</span><input value={result} onChange={(e) => setResult(e.target.value)} /></label>
            <label className="prod-field">
              <span>Confiança</span>
              <select value={confidence} onChange={(e) => setConfidence(e.target.value as WorkConfidence)}>{WORK_CONFIDENCES.map((c) => <option key={c} value={c}>{WORK_CONFIDENCE_LABEL[c]}</option>)}</select>
            </label>
            <label className="prod-field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as WorkPilotStatus)}>{WORK_PILOT_STATUSES.map((s) => <option key={s} value={s}>{WORK_PILOT_STATUS_LABEL[s]}</option>)}</select>
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

// ── Tabela genérica com estados (carregando / erro / vazio) ──

function Tabela<T>({ estado, vazio, head, rows, keys }: {
  estado: { data: T | null; err: string | null };
  vazio: string;
  head: string[];
  rows: ReactNode[][];
  keys: string[];
}) {
  if (estado.err) return <div className="dash-state dash-state--error">{estado.err}</div>;
  if (!estado.data) return <p className="dash-state">Carregando…</p>;
  if (rows.length === 0) return <p className="dash-state" style={{ margin: 0 }}>{vazio}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead><tr>{head.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={keys[i] ?? i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
