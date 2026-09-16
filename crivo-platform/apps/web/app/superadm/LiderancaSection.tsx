"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  DECISION_IMPACT_LABEL,
  DECISION_IMPACT_WEIGHT,
  DECISION_IMPACTS,
  ICD_AXES,
  ICD_AXIS_DESCRIPTION,
  ICD_AXIS_LABEL,
  ICD_AXIS_QUESTIONS,
  ICD_AXIS_SCALE,
  ICD_MATURITY_BANDS,
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_DIMENSIONS,
  POCKET_DIMENSION_FUNCTION,
  POCKET_DIMENSION_LABEL,
  POCKET_QUESTIONS,
  POCKET_QUESTIONS_VERSION,
  type IcdAxis,
  type IcdCycleData,
  type IcdCycleHistoryEntry,
  type LiderancaAdminSummary,
  type PocketAggregate,
} from "@crivo/types";
import {
  closeTenantIcdCycle,
  createTenantIcdCycle,
  getAuditLog,
  getIntelligenceCompanies,
  getLiderancaSummary,
  getTenantIcdHistory,
  getTenantPocketAggregate,
  listTenantIcdCycles,
  type AuditEntry,
  type IntelligenceCompany,
} from "@/lib/admin-api";

/**
 * Módulos › Liderança — workspace administrativo do programa Liderança
 * (Mapa Executivo CRIVO™ / ICD CRIVO™ / CRIVO Pocket™) POR EMPRESA, no layout
 * do protótipo Lovable (KPIs + 10 abas). Separado do cadastro comercial
 * (preço/liberação ficam em Soluções / Adicionais / Contratos).
 *
 * Fontes reais: GET /admin/tenants/:id/lideranca/summary (KPIs, chip de
 * liberação icd/lider/pocket, agregados do ciclo aberto), icd-cycles (listar/
 * abrir/fechar), icd-cycles/history (resultados congelados), pocket/aggregate
 * e /admin/audit filtrado por empresa + prefixo icd./pocket./lideranca.
 *
 * O que é DEFINIÇÃO (eixos, afirmações, escala, pesos, faixas, banco Pocket,
 * versões) vive em código (@crivo/types) e aparece aqui SOMENTE LEITURA — uma
 * alteração é nova versão de metodologia, publicada por deploy. Nada por
 * líder: só agregados com supressão n < MIN_LEADERS_FOR_DISCLOSURE.
 */

type Tab = "visao" | "mapa" | "icd" | "pocket" | "perguntas" | "escalas" | "ciclos" | "resultados" | "versoes" | "auditoria";
const TABS: Array<[Tab, string]> = [
  ["visao", "Visão Geral"],
  ["mapa", "Mapa Executivo CRIVO™"],
  ["icd", "ICD CRIVO™"],
  ["pocket", "CRIVO Pocket™"],
  ["perguntas", "Perguntas e Dimensões"],
  ["escalas", "Escalas e Regras"],
  ["ciclos", "Aplicações e Ciclos"],
  ["resultados", "Resultados e Relatórios"],
  ["versoes", "Versões"],
  ["auditoria", "Auditoria"],
];

const AUDIT_PREFIXES = ["icd.", "pocket.", "lideranca."];
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const cycleLabel = (c: IcdCycleData) => c.name || `${c.quarter}º tri/${c.year}`;
const AXIS_SHORT: Record<IcdAxis, string> = { CLAREZA: "Clareza", CRITERIO: "Critério", ALINHAMENTO: "Alinhamento", SUSTENTACAO: "Sustentação" };

/** Caixa tracejada "Regras desta tela" (RuleBox do protótipo) — reusa .adm-callout. */
function RuleBox({ children }: { children: ReactNode }) {
  return <div className="adm-callout" style={{ borderStyle: "dashed", borderLeftStyle: "solid", marginTop: 16 }}>{children}</div>;
}

/** Chip de leitura (StatusChip do protótipo) — reusa .pill. */
function Chip({ tone, children }: { tone?: "gold" | "danger"; children: ReactNode }) {
  return <span className={`pill${tone ? ` pill--${tone}` : ""}`} style={{ fontSize: 11 }}>{children}</span>;
}

export function LiderancaSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [companies, setCompanies] = useState<IntelligenceCompany[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [data, setData] = useState<LiderancaAdminSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [tab, setTab] = useState<Tab>("visao");

  useEffect(() => {
    getIntelligenceCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  async function load(tid = tenantId) {
    if (!tid) return;
    setStatus("loading");
    try {
      setData(await getLiderancaSummary(tid));
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

  const icdOn = useMemo(() => data?.modules.find((m) => m.code === "icd")?.enabled ?? false, [data]);

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Liderança</h1>
          <p className="page-sub">
            Workspace administrativo do módulo Liderança. Conteúdo autoral (Mapa Executivo CRIVO™, ICD CRIVO™, CRIVO Pocket™)
            separado do cadastro comercial em Soluções / Adicionais / Contratos.
          </p>
        </div>
      </div>

      {/* Seletor de empresa — obrigatório (padrão Inteligência CRIVO) */}
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

      {!tenantId && <p className="dash-state">Selecione uma empresa para administrar o programa Liderança.</p>}
      {status === "loading" && !data && <p className="dash-state">Lendo ciclos, agregados e liberações da empresa…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar o painel de Liderança desta empresa.</div>}

      {data && (
        <>
          <ModulesChip data={data} onNavigate={onNavigate} />
          <Kpis data={data} />

          <div className="adm-tabs" style={{ marginTop: 18 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`adm-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === "visao" && <VisaoTab data={data} icdOn={icdOn} />}
          {tab === "mapa" && <MapaTab onNavigate={onNavigate} />}
          {tab === "icd" && <IcdTab />}
          {tab === "pocket" && <PocketTab data={data} />}
          {tab === "perguntas" && <PerguntasTab />}
          {tab === "escalas" && <EscalasTab />}
          {/* key por empresa: a aba remonta com estado limpo ao trocar o select (sem reset síncrono em effect) */}
          {tab === "ciclos" && <CiclosTab key={tenantId} tenantId={tenantId} icdOn={icdOn} onChanged={() => load()} />}
          {tab === "resultados" && <ResultadosTab key={tenantId} tenantId={tenantId} data={data} />}
          {tab === "versoes" && <VersoesTab data={data} onNavigate={onNavigate} />}
          {tab === "auditoria" && <AuditoriaTab key={data.company.organizationId} organizationId={data.company.organizationId} />}

          <RuleBox>
            <strong>Regras desta tela.</strong> Registros de decisão e reflexões Pocket são de leitura restrita ao líder — o Super Admin
            vê apenas agregados com supressão n &lt; {MIN_LEADERS_FOR_DISCLOSURE} (Anexo ICD §11 / Anexo Pocket §13). O ICD segue quatro
            eixos (Clareza · Critério · Alinhamento · Sustentação) com pesos iguais. Perguntas, escalas, pesos e faixas são definição em
            código (@crivo/types): alteração é nova versão de metodologia, publicada por deploy — nunca editada aqui.
          </RuleBox>
        </>
      )}
    </div>
  );
}

// ── Chip de liberação icd / lider / pocket (mesma fonte do ModulesModal) ──

function ModulesChip({ data, onNavigate }: { data: LiderancaAdminSummary; onNavigate?: (s: string) => void }) {
  return (
    <div className="adm-callout" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <span><strong>Recorte:</strong> {data.company.name}{data.company.cnpj ? ` · ${data.company.cnpj}` : ""}</span>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
        {data.modules.map((m) => (
          <Chip key={m.code} tone={m.enabled ? "gold" : !m.availableForPlan ? "danger" : undefined}>
            {m.code}: {m.enabled ? "ativo" : !m.availableForPlan ? `requer plano ${m.minPlan}` : "inativo"}
          </Chip>
        ))}
        {onNavigate && (
          <button className="btn btn--outline-dark btn--sm" onClick={() => onNavigate("contratos")} title="A liberação continua em Contratos e Liberações">
            Liberar em Contratos
          </button>
        )}
      </span>
    </div>
  );
}

// ── KPIs (definições reais, não os literais do protótipo) ──

function Kpis({ data }: { data: LiderancaAdminSummary }) {
  const icd = data.icd;
  const cyc = icd.cycle;
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <span className="kpi__label" title="Decisões avaliadas pelo ICD (DecisionIcdScore) no ciclo aberto">Aplicações (decisões avaliadas)</span>
        <strong className="kpi__value">{cyc ? icd.decisionsEvaluated : "—"}</strong>
        <span className="card__hint">{cyc ? `no ciclo aberto ${cycleLabel(cyc)}` : "nenhum ciclo aberto"}</span>
      </div>
      <div className="kpi">
        <span className="kpi__label" title="Líderes ativos (User.role LIDER) vs. líderes com ≥ 1 decisão avaliada no ciclo aberto">Líderes elegíveis · participantes</span>
        <strong className="kpi__value">{icd.eligibleLeaders}<small> · {cyc ? icd.participatingLeaders : "—"}</small></strong>
        <span className="card__hint">{cyc ? "elegíveis · com avaliação no ciclo aberto" : "líderes ativos cadastrados"}</span>
      </div>
      <div className="kpi">
        <span className="kpi__label">Ciclos em andamento</span>
        <strong className="kpi__value">{cyc ? 1 : 0}</strong>
        <span className="card__hint">{icd.closedCycles} ciclo(s) fechado(s) · máx. 1 aberto por empresa</span>
      </div>
      <div className="kpi">
        <span className="kpi__label" title="Versão vigente do banco de perguntas Pocket (POCKET_QUESTIONS_VERSION)">Última publicação</span>
        <strong className="kpi__value">{data.pocketQuestionsVersion}</strong>
        <span className="card__hint">Banco Pocket · definido em código (deploy)</span>
      </div>
    </div>
  );
}

// ── Visão Geral ──

function VisaoTab({ data, icdOn }: { data: LiderancaAdminSummary; icdOn: boolean }) {
  const icd = data.icd;
  const p = data.pocket;
  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head"><div><h3>Panorama do módulo Liderança</h3><span className="card__sub">Três capacidades autorais — não confundir com o cadastro comercial em Adicionais.</span></div></div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li><strong>Mapa Executivo CRIVO™</strong> — leitura executiva por C-level; gerido no Motor de Diagnósticos (instrumento Diagnóstico Executivo).</li>
          <li><strong>ICD CRIVO™</strong> — Índice de Coerência Decisória: 4 eixos, ciclo trimestral, agregado n ≥ {MIN_LEADERS_FOR_DISCLOSURE}.</li>
          <li><strong>CRIVO Pocket™</strong> — 10 perguntas reflexivas em 5 dimensões (C/R/I/V/O); sem score; sessões privadas do líder.</li>
        </ul>
      </div>
      <div className="card">
        <div className="card__head"><div><h3>Estado atual da empresa</h3><span className="card__sub">Leitura real — nada demonstrativo.</span></div></div>
        {!icdOn && <p className="dash-state" style={{ marginBottom: 12 }}>Módulo ICD não liberado para esta empresa — liberação em Contratos e Liberações.</p>}
        <table className="data-table">
          <tbody>
            <tr><td>Ciclo aberto</td><td>{icd.cycle ? `${cycleLabel(icd.cycle)} · ${fmtDate(icd.cycle.startsAt)} → ${fmtDate(icd.cycle.endsAt)}` : "Nenhum ciclo aberto"}</td></tr>
            <tr><td>ICD parcial (ciclo aberto)</td><td>{icd.icdMedio != null ? `${icd.icdMedio}/100 · ${icd.band?.label ?? ""}` : icd.suppressed ? `Suprimido (${icd.participatingLeaders} líder(es) — mínimo ${MIN_LEADERS_FOR_DISCLOSURE})` : "Sem avaliações no ciclo"}</td></tr>
            <tr><td>Último ciclo fechado</td><td>{icd.lastClosed ? `${icd.lastClosed.cycleName} · ${icd.lastClosed.score != null ? `${icd.lastClosed.score}/100` : "suprimido"} · ${icd.lastClosed.eligibleLeaders} líderes` : "Nenhum ciclo fechado ainda"}</td></tr>
            <tr><td>Pocket</td><td>{p.suppressed ? (p.participatingLeaders === 0 ? "Sem sessões concluídas no período" : `Suprimido (${p.participatingLeaders} líder(es) — mínimo ${p.minLeadersForDisclosure})`) : `${p.completedSessions} sessões · adesão ${p.adhesionPct ?? "—"}%`}{p.period ? ` · ${p.period.cycleName}` : " · todo o histórico"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Mapa Executivo — sem entidade própria: encaminha ao Motor de Diagnósticos ──

function MapaTab({ onNavigate }: { onNavigate?: (s: string) => void }) {
  return (
    <div className="card">
      <div className="card__head"><div><h3>Mapa Executivo CRIVO™</h3><span className="card__sub">Instrumento de leitura executiva por C-level.</span></div></div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-sec)" }}>
        O Mapa Executivo não tem entidade própria nesta seção: as perguntas, o template do relatório e as versões são geridos no
        <strong> Motor de Diagnósticos › Diagnóstico Executivo</strong> (instrumento PRE_DIAGNOSTIC e seus modelos de relatório). Aqui ele
        aparece só como capacidade do programa, para não duplicar cadastro.
      </p>
      {onNavigate && (
        <button className="btn btn--gold btn--sm" onClick={() => onNavigate("metodologia")}>Abrir Motor de Diagnósticos</button>
      )}
    </div>
  );
}

// ── ICD CRIVO™ — eixos + pesos iguais (somente leitura das constantes) ──

function IcdTab() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>ICD CRIVO™ — Índice de Coerência Decisória</h3>
          <span className="card__sub">Anexo Técnico ICD do Líder v1 · trimestral (organizacional) · sob demanda (individual, na decisão registrada).</span>
        </div>
        <Chip tone="gold">definição em código</Chip>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {ICD_AXES.map((ax) => (
          <div key={ax} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong>{ICD_AXIS_LABEL[ax]}</strong>
              <span className="card__hint" style={{ fontSize: 11 }}>peso 1/4 (igual)</span>
            </div>
            <p className="card__sub" style={{ marginTop: 6 }}>{ICD_AXIS_DESCRIPTION[ax]}</p>
            <span className="card__hint">{ICD_AXIS_QUESTIONS.filter((q) => q.axis === ax).map((q) => q.id).join(" · ")}</span>
          </div>
        ))}
      </div>
      <p className="card__hint" style={{ marginTop: 12 }}>
        Cada eixo é a média das suas 2 afirmações; o ICD da decisão é a média dos 4 eixos (§9.1–§9.2). Ciclo trimestral: média ponderada
        por impacto das decisões do líder (§9.4) e média dos líderes elegíveis na empresa (§9.5). O cálculo real vive no motor
        (@crivo/types) — esta aba não edita pesos nem eixos.
      </p>
    </div>
  );
}

// ── CRIVO Pocket™ — banco de perguntas (tabela) + agregado do período ──

function PocketTab({ data }: { data: LiderancaAdminSummary }) {
  const p = data.pocket;
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div><h3>Banco de perguntas Pocket</h3><span className="card__sub">10 perguntas reflexivas C1–O2 nas 5 dimensões CRIVO (Anexo Pocket §6). Sem score.</span></div>
          <Chip tone="gold">versão {POCKET_QUESTIONS_VERSION}</Chip>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Categoria / dimensão</th><th>Texto</th><th>Público</th><th>Versão</th><th>Status</th></tr></thead>
            <tbody>
              {POCKET_QUESTIONS.map((q, i) => (
                <tr key={q.code}>
                  <td>{i + 1} · {q.code}</td>
                  <td><Chip>{q.dimension} · {POCKET_DIMENSION_LABEL[q.dimension]}</Chip></td>
                  <td style={{ maxWidth: 520 }}>{q.text}</td>
                  <td>Líderes com módulo Pocket</td>
                  <td>{POCKET_QUESTIONS_VERSION}</td>
                  <td><Chip tone="gold">vigente (código)</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PocketAggregateCard p={p} title="Pocket agregado — ciclo aberto" />
    </>
  );
}

function PocketAggregateCard({ p, title }: { p: PocketAggregate; title: string }) {
  const max = Math.max(1, ...(p.byDimension?.map((d) => d.sessions) ?? [0]));
  return (
    <div className="card">
      <div className="card__head">
        <div><h3>{title}</h3><span className="card__sub">Sessões concluídas com ≥ 1 reflexão por dimensão + adesão (líderes com ≥ 1 sessão / líderes ativos). Nunca por pessoa.</span></div>
        {!p.suppressed && p.adhesionPct != null && <Chip tone="gold">adesão {p.adhesionPct}% · {p.participatingLeaders}/{p.eligibleLeaders}</Chip>}
      </div>
      {p.suppressed ? (
        <p className="dash-state">
          {p.participatingLeaders === 0
            ? `Pocket sem sessões concluídas no período${p.period ? ` (${p.period.cycleName})` : ""}.`
            : `Suprimido: ${p.participatingLeaders} líder(es) com sessão concluída — mínimo ${p.minLeadersForDisclosure}.`}
        </p>
      ) : (
        <div className="bars">
          {(p.byDimension ?? []).map((d) => (
            <div className="bar-row" key={d.dimension}>
              <span className="bar-row__label">{d.label}</span>
              <div className="bar"><div className="bar__fill" style={{ width: `${(d.sessions / max) * 100}%`, background: "var(--success)" }} /></div>
              <span className="bar-row__value">{d.sessions}</span>
            </div>
          ))}
        </div>
      )}
      <span className="card__eyebrow" style={{ display: "block", marginTop: 10 }}>
        {p.period ? `Ciclo ${p.period.cycleName} · ${fmtDate(p.period.from)} → ${fmtDate(p.period.to)}` : "Todo o histórico"} · {p.completedSessions ?? "—"} sessões · banco {p.questionsVersion}
      </span>
    </div>
  );
}

// ── Perguntas e Dimensões (somente leitura) ──

function PerguntasTab() {
  return (
    <>
      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><div><h3>ICD — afirmações P1–P8 por eixo</h3><span className="card__sub">Sempre em formato de afirmação (§7); o líder responde concordância 1–5.</span></div></div>
          {ICD_AXES.map((ax) => (
            <div key={ax} style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13 }}>{AXIS_SHORT[ax]}</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-sec)" }}>
                {ICD_AXIS_QUESTIONS.filter((q) => q.axis === ax).map((q) => <li key={q.id}><strong>{q.id}</strong> — {q.text}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Pocket — perguntas por dimensão</h3><span className="card__sub">Função de cada dimensão (Anexo Pocket §4.1) e suas 2 perguntas.</span></div></div>
          {POCKET_DIMENSIONS.map((d) => (
            <div key={d} style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13 }}>{d} · {POCKET_DIMENSION_LABEL[d]}</strong>
              <p className="card__hint" style={{ margin: "2px 0 4px" }}>{POCKET_DIMENSION_FUNCTION[d]}</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-sec)" }}>
                {POCKET_QUESTIONS.filter((q) => q.dimension === d).map((q) => <li key={q.code}><strong>{q.code}</strong> — {q.text}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <RuleBox><strong>Definição em código.</strong> Perguntas e dimensões não são editáveis aqui: uma alteração é nova versão de metodologia (bump de POCKET_QUESTIONS_VERSION / Anexo ICD), publicada por deploy e homologada com o cliente.</RuleBox>
    </>
  );
}

// ── Escalas e Regras (somente leitura) ──

function EscalasTab() {
  return (
    <>
      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><div><h3>Escala de concordância (ICD)</h3><span className="card__sub">Anexo §8 — score = (valor − 1) × 25.</span></div></div>
          <table className="data-table">
            <thead><tr><th>Valor</th><th>Rótulo</th><th>Score</th></tr></thead>
            <tbody>{ICD_AXIS_SCALE.map((s) => <tr key={s.value}><td>{s.value}</td><td>{s.label}</td><td>{s.score}</td></tr>)}</tbody>
          </table>
          <div className="card__head" style={{ marginTop: 16 }}><div><h3>Peso por impacto da decisão</h3><span className="card__sub">Anexo §9.3 — entra no ICD trimestral do líder.</span></div></div>
          <table className="data-table">
            <thead><tr><th>Impacto</th><th>Peso</th></tr></thead>
            <tbody>{DECISION_IMPACTS.map((i) => <tr key={i}><td>{DECISION_IMPACT_LABEL[i]}</td><td>{DECISION_IMPACT_WEIGHT[i]}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="card__head"><div><h3>Faixas de Maturidade Decisória</h3><span className="card__sub">Anexo §10 — aplicadas ao ICD 0–100.</span></div></div>
          <table className="data-table">
            <thead><tr><th>Faixa</th><th>Intervalo</th></tr></thead>
            <tbody>{ICD_MATURITY_BANDS.map((b) => <tr key={b.key}><td>{b.label}</td><td>{b.min}–{b.max}</td></tr>)}</tbody>
          </table>
          <div className="card__head" style={{ marginTop: 16 }}><div><h3>Regras de cálculo e confidencialidade</h3></div></div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-sec)" }}>
            <li>Eixo = média das 2 afirmações; ICD da decisão = média dos 4 eixos (pesos iguais).</li>
            <li>ICD trimestral do líder = Σ(score × peso) / Σ(pesos), só decisões de impacto MÉDIO/ALTO.</li>
            <li>ICD da empresa = média dos ICDs trimestrais dos líderes elegíveis; congelado no fechamento do ciclo.</li>
            <li>Supressão: abaixo de <strong>{MIN_LEADERS_FOR_DISCLOSURE} líderes</strong> nenhum agregado (score, eixos, distribuição, Pocket) é exibido.</li>
            <li>Pocket não pontua: só contagem de sessões por dimensão e adesão.</li>
          </ul>
        </div>
      </div>
      <RuleBox><strong>Definição em código.</strong> Escalas, pesos, faixas e regras de cálculo vivem no motor (@crivo/types). Alteração é nova versão de metodologia por deploy — esta aba é somente leitura.</RuleBox>
    </>
  );
}

// ── Aplicações e Ciclos — listar / abrir / fechar (com confirmação) ──

function CiclosTab({ tenantId, icdOn, onChanged }: { tenantId: string; icdOn: boolean; onChanged: () => void }) {
  const [cycles, setCycles] = useState<IcdCycleData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [closing, setClosing] = useState<IcdCycleData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    listTenantIcdCycles(tenantId)
      .then((rows) => { if (alive) { setCycles(rows); setErr(null); } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Falha ao listar ciclos."); });
    return () => { alive = false; };
  }, [tenantId, tick]);
  const reload = () => setTick((t) => t + 1);

  const hasOpen = !!cycles?.some((c) => c.status === "OPEN");

  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Ciclos trimestrais do ICD</h3><span className="card__sub">Um ciclo agrupa as decisões avaliadas cujo registro cai em [início, fim]. Só 1 aberto por empresa; fechar congela o resultado oficial (§9.6).</span></div>
        <button className="btn btn--gold btn--sm" disabled={hasOpen} title={hasOpen ? "Feche o ciclo aberto antes de abrir outro" : "Abrir novo ciclo"} onClick={() => setOpenModal(true)}>Abrir ciclo</button>
      </div>
      {!icdOn && <p className="dash-state" style={{ marginBottom: 12 }}>Módulo ICD não liberado para esta empresa — o portal do cliente não verá os ciclos até a liberação em Contratos e Liberações.</p>}
      {err && <div className="dash-state dash-state--error">{err}</div>}
      {cycles === null && !err && <p className="dash-state">Carregando ciclos…</p>}
      {cycles && cycles.length === 0 && <p className="dash-state">Nenhum ciclo aberto nem fechado ainda. Abra o primeiro ciclo trimestral.</p>}
      {cycles && cycles.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Ciclo</th><th>Trimestre</th><th>Início</th><th>Fim</th><th>Status</th><th>Fechado em</th><th></th></tr></thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id}>
                <td><strong>{cycleLabel(c)}</strong></td>
                <td>{c.quarter}º/{c.year}</td>
                <td>{fmtDate(c.startsAt)}</td>
                <td>{fmtDate(c.endsAt)}</td>
                <td>{c.status === "OPEN" ? <Chip tone="gold">Em andamento</Chip> : <Chip>Fechado</Chip>}</td>
                <td>{fmtDateTime(c.closedAt)}</td>
                <td>{c.status === "OPEN" && <button className="btn btn--outline-dark btn--sm" onClick={() => setClosing(c)}>Fechar ciclo</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openModal && (
        <OpenCycleModal
          tenantId={tenantId}
          onClose={() => setOpenModal(false)}
          onCreated={() => { setOpenModal(false); reload(); onChanged(); }}
        />
      )}
      {closing && (
        <CloseCycleModal
          tenantId={tenantId}
          cycle={closing}
          onClose={() => setClosing(null)}
          onClosed={() => { setClosing(null); reload(); onChanged(); }}
        />
      )}
    </div>
  );
}

function OpenCycleModal({ tenantId, onClose, onCreated }: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const [form, setForm] = useState({ quarter: q, year: now.getFullYear(), startsAt: "", endsAt: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await createTenantIcdCycle(tenantId, {
        quarter: Number(form.quarter),
        year: Number(form.year),
        startsAt: new Date(`${form.startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
      });
      onCreated();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Não foi possível abrir o ciclo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      {/* Clique fora NÃO fecha (padrão ContractModal): há formulário. */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Abrir ciclo trimestral do ICD</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>
        <form onSubmit={submit} className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field"><span>Trimestre</span>
              <select value={form.quarter} onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}º trimestre</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Ano</span><input type="number" min={2024} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} required /></label>
            <label className="prod-field"><span>Início</span><input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label>
            <label className="prod-field"><span>Fim</span><input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required /></label>
            <label className="prod-field prod-field--full"><span>Nome (opcional — padrão AAAA-Qn)</span><input maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          </div>
          <p className="card__hint">Ao abrir, as avaliações de decisão já registradas cujo `decidedAt` cai no intervalo entram no ciclo. Só pode haver um ciclo aberto por empresa.</p>
          {err && <div className="dash-state dash-state--error">{err}</div>}
          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Abrindo…" : "Abrir ciclo"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseCycleModal({ tenantId, cycle, onClose, onClosed }: { tenantId: string; cycle: IcdCycleData; onClose: () => void; onClosed: () => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function confirm() {
    setSaving(true);
    setErr(null);
    try { await closeTenantIcdCycle(tenantId, cycle.id); onClosed(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Não foi possível fechar o ciclo."); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Fechar o ciclo {cycleLabel(cycle)}?</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>
        <div className="modal__body">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            O fechamento <strong>congela</strong> o ICD trimestral de cada líder e o ICD oficial da empresa (§9.6) e não pode ser desfeito.
            Com menos de {MIN_LEADERS_FOR_DISCLOSURE} líderes elegíveis o resultado da empresa fica <strong>suprimido</strong> (§11). A ação fica registrada na Auditoria.
          </p>
          {err && <div className="dash-state dash-state--error">{err}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn--gold btn--sm" disabled={saving} onClick={confirm}>{saving ? "Fechando…" : "Fechar ciclo"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Resultados e Relatórios — CompanyQuarterlyIcd por ciclo (agregado) ──

function ResultadosTab({ tenantId, data }: { tenantId: string; data: LiderancaAdminSummary }) {
  const [history, setHistory] = useState<IcdCycleHistoryEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pocketCycle, setPocketCycle] = useState("");
  const [pocketAgg, setPocketAgg] = useState<PocketAggregate | null>(null);

  useEffect(() => {
    let alive = true;
    getTenantIcdHistory(tenantId)
      .then((h) => { if (alive) setHistory(h); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Falha ao carregar resultados."); });
    return () => { alive = false; };
  }, [tenantId]);

  // O agregado do ciclo escolhido: zerado no handler do select (evento), buscado no effect.
  useEffect(() => {
    if (!pocketCycle) return;
    let alive = true;
    getTenantPocketAggregate(tenantId, pocketCycle).then((a) => { if (alive) setPocketAgg(a); }).catch(() => { if (alive) setPocketAgg(null); });
    return () => { alive = false; };
  }, [tenantId, pocketCycle]);

  const fechados = (history ?? []).filter((e) => e.cycle.status === "CLOSED");

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head"><div><h3>Resultados por ciclo</h3><span className="card__sub">ICD oficial congelado no fechamento (CompanyQuarterlyIcd). Sem ranking individual — agregado, suprimido abaixo de {MIN_LEADERS_FOR_DISCLOSURE} líderes.</span></div></div>
        {err && <div className="dash-state dash-state--error">{err}</div>}
        {history === null && !err && <p className="dash-state">Carregando…</p>}
        {history && fechados.length === 0 && <p className="dash-state">Nenhum ciclo fechado ainda. Os resultados aparecem após o fechamento de um ciclo.</p>}
        {fechados.length > 0 && (
          <table className="data-table">
            <thead><tr><th>Ciclo</th><th>Fechado em</th><th>Líderes elegíveis</th><th>ICD</th><th>Faixa</th><th>Eixos (C · Cr · A · S)</th></tr></thead>
            <tbody>
              {fechados.map((e) => {
                const r = e.company;
                return (
                  <tr key={e.cycle.id}>
                    <td><strong>{cycleLabel(e.cycle)}</strong></td>
                    <td>{fmtDateTime(e.cycle.closedAt)}</td>
                    <td>{r?.eligibleLeaders ?? "—"}</td>
                    <td>{!r ? "—" : r.suppressed || r.score == null ? <Chip>Suprimido (&lt; {MIN_LEADERS_FOR_DISCLOSURE})</Chip> : <strong>{r.score}/100</strong>}</td>
                    <td>{r?.band?.label ?? "—"}</td>
                    <td>{r?.axesAverage ? ICD_AXES.map((ax) => Math.round(r.axesAverage![ax] ?? 0)).join(" · ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div><h3>Pocket agregado por ciclo</h3><span className="card__sub">Escolha um ciclo para ver sessões por dimensão e adesão naquele período.</span></div>
          <select value={pocketCycle} onChange={(e) => { setPocketAgg(null); setPocketCycle(e.target.value); }} style={{ minWidth: 220 }}>
            <option value="">{data.icd.cycle ? `Ciclo aberto (${cycleLabel(data.icd.cycle)})` : "Todo o histórico"}</option>
            {(history ?? []).map((e) => <option key={e.cycle.id} value={e.cycle.id}>{cycleLabel(e.cycle)} · {e.cycle.status === "OPEN" ? "aberto" : "fechado"}</option>)}
          </select>
        </div>
        <PocketAggregateCard p={pocketCycle && pocketAgg ? pocketAgg : data.pocket} title={pocketCycle && pocketAgg ? `Pocket — ${pocketAgg.period?.cycleName ?? ""}` : "Pocket — período atual"} />
      </div>
    </>
  );
}

// ── Versões (somente leitura) ──

function VersoesTab({ data, onNavigate }: { data: LiderancaAdminSummary; onNavigate?: (s: string) => void }) {
  return (
    <>
      <div className="card">
        <div className="card__head"><div><h3>Versões publicadas</h3><span className="card__sub">O que está em vigor para esta e para todas as empresas — versionado em código.</span></div></div>
        <table className="data-table">
          <thead><tr><th>Capacidade</th><th>Versão vigente</th><th>Onde vive</th><th>Como muda</th></tr></thead>
          <tbody>
            <tr><td>ICD CRIVO™ (4 eixos, P1–P8, escala, faixas)</td><td>Anexo Técnico ICD do Líder v1</td><td>@crivo/types (ICD_AXES, ICD_AXIS_QUESTIONS, ICD_MATURITY_BANDS)</td><td>Nova versão de metodologia por deploy</td></tr>
            <tr><td>CRIVO Pocket™ (banco C1–O2)</td><td>{data.pocketQuestionsVersion}</td><td>@crivo/types (POCKET_QUESTIONS, POCKET_QUESTIONS_VERSION)</td><td>Bump da versão por deploy; sessões antigas guardam a versão usada</td></tr>
            <tr><td>Mapa Executivo CRIVO™</td><td>—</td><td>Motor de Diagnósticos › Diagnóstico Executivo</td><td>{onNavigate ? <a href="#" onClick={(e) => { e.preventDefault(); onNavigate("metodologia"); }}>versionado no Motor</a> : "versionado no Motor"}</td></tr>
          </tbody>
        </table>
      </div>
      <RuleBox><strong>Definição em código.</strong> Não há editor de versões aqui: publicar uma versão nova do Pocket, do ICD ou das faixas é alteração de metodologia, homologada com o cliente e liberada por deploy.</RuleBox>
    </>
  );
}

// ── Auditoria — GET /admin/audit filtrado por empresa e prefixo ──

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
      <div className="card__head"><div><h3>Trilha de eventos do programa</h3><span className="card__sub">Abertura/fechamento de ciclo e consultas ao painel desta empresa (ações icd.*, pocket.*, lideranca.*).</span></div></div>
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
  "icd.cycle.create": "Ciclo ICD aberto",
  "icd.cycle.close": "Ciclo ICD fechado",
  "lideranca.view": "Painel de Liderança consultado",
};
