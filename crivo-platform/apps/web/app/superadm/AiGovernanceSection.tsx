"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AI_DECISION_LABEL,
  AI_DECISION_TO_STATUS,
  AI_INCIDENT_SEVERITY_LABEL,
  AI_INCIDENT_STATUS_LABEL,
  AI_LINK_KIND_LABEL,
  AI_POLICY_STATUS_LABEL,
  AI_RISK_LABEL,
  AI_RISK_LEVELS,
  AI_USE_CASE_STATUSES,
  AI_USE_CASE_STATUS_LABEL,
  type AiGovernanceAdminSummary,
  type AiIncidentData,
  type AiPolicyData,
  type AiReviewEntry,
  type AiRiskLevel,
  type AiUseCaseDecisionData,
  type AiUseCaseDetail,
  type AiUseCaseStatus,
} from "@crivo/types";
import {
  getAuditLog,
  getIntelligenceCompanies,
  getTenantAiGovernanceSummary,
  getTenantAiUseCase,
  listTenantAiDecisions,
  listTenantAiIncidents,
  listTenantAiPolicies,
  listTenantAiReviews,
  listTenantAiUseCases,
  type AuditEntry,
  type IntelligenceCompany,
} from "@/lib/admin-api";

/**
 * Módulos › Governança de IA — acompanhamento, POR EMPRESA, do workspace que
 * o cliente governa no portal (Programas › Governança de IA), no layout do
 * protótipo Lovable do Super Admin (KPIs + 10 abas). SOMENTE LEITURA sobre os
 * MESMOS AiUseCase / AiUseCaseDecision / AiUseCaseLink / AiIncident / AiPolicy
 * (GET /admin/tenants/:id/ai-governance/*): a CRIVO acompanha, não decide.
 *
 * Separado de IA da Plataforma (AiSettings — configura o motor CRIVO) e de
 * Contexto e Diretrizes (IA contextualizada do cliente). A liberação do
 * módulo 'govia' continua em Contratos e Liberações (chip aqui é só leitura).
 * Nada demonstrativo: toda aba nasce com estado vazio honesto.
 */

type Tab = "visao" | "inventario" | "casos" | "riscos" | "politicas" | "aprovacoes" | "incidentes" | "evidencias" | "indicadores" | "auditoria";
const TABS: Array<[Tab, string]> = [
  ["visao", "Visão Executiva"],
  ["inventario", "Inventário"],
  ["casos", "Casos de Uso"],
  ["riscos", "Riscos e Classificação"],
  ["politicas", "Políticas e Controles"],
  ["aprovacoes", "Aprovações"],
  ["incidentes", "Incidentes"],
  ["evidencias", "Evidências"],
  ["indicadores", "Indicadores"],
  ["auditoria", "Auditoria"],
];

const AUDIT_PREFIXES = ["ai_governance."];
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

/** Caixa tracejada "Regras desta tela" (RuleBox do protótipo) — reusa .adm-callout. */
function RuleBox({ children }: { children: ReactNode }) {
  return <div className="adm-callout" style={{ borderStyle: "dashed", borderLeftStyle: "solid", marginTop: 16 }}>{children}</div>;
}

/** Chip de leitura (StatusChip do protótipo) — reusa .pill. */
function Chip({ tone, children }: { tone?: "gold" | "danger"; children: ReactNode }) {
  return <span className={`pill${tone ? ` pill--${tone}` : ""}`} style={{ fontSize: 11 }}>{children}</span>;
}
const statusTone = (s: AiUseCaseStatus): "gold" | "danger" | undefined => (s === "APROVADO" ? "gold" : s === "RESTRITO" || s === "REJEITADO" ? "danger" : undefined);
const riskTone = (r: AiRiskLevel): "gold" | "danger" | undefined => (r === "ALTO" ? "danger" : r === "MEDIO" ? "gold" : undefined);

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

export function AiGovernanceSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [companies, setCompanies] = useState<IntelligenceCompany[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [data, setData] = useState<AiGovernanceAdminSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [tab, setTab] = useState<Tab>("visao");
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    getIntelligenceCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  async function load(tid = tenantId) {
    if (!tid) return;
    setStatus("loading");
    try {
      setData(await getTenantAiGovernanceSummary(tid));
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
          <h1 className="page-title">Governança de IA</h1>
          <p className="page-sub">Workspace do cliente para governar seus próprios casos de uso de IA. Separado de IA da Plataforma e de Contexto e Diretrizes.</p>
        </div>
      </div>

      {/* Seletor de empresa — obrigatório (padrão Inteligência CRIVO / Liderança) */}
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

      {!tenantId && <p className="dash-state">Selecione uma empresa para acompanhar o programa de Governança de IA.</p>}
      {status === "loading" && !data && <p className="dash-state">Lendo inventário, decisões, incidentes e políticas da empresa…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar a Governança de IA desta empresa.</div>}

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
            <p className="dash-state">Módulo Governança de IA não liberado para esta empresa — liberação em Contratos e Liberações. O que aparece abaixo é o que a empresa já cadastrou (se houver).</p>
          )}

          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label" title="Casos de uso cadastrados pela empresa (qualquer status)">Casos de uso</span>
              <strong className="kpi__value">{s.useCases}</strong>
              <span className="card__hint">{s.approved} aprovado(s) · {s.byStatus.EM_AVALIACAO} em avaliação</span>
            </div>
            <div className="kpi">
              <span className="kpi__label" title="Risco inerente Alto, conforme classificação da própria empresa (não certificadora)">Riscos altos</span>
              <strong className="kpi__value">{s.highInherentRisk}</strong>
              <span className="card__hint">{s.byResidualRisk.ALTO} com residual alto após controles</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Incidentes abertos</span>
              <strong className="kpi__value">{s.openIncidents}</strong>
              <span className="card__hint">{s.incidents12m} nos últimos 12 meses</span>
            </div>
            <div className="kpi">
              <span className="kpi__label" title="Casos com próxima revisão já vencida (nextReviewAt < hoje)">Revisões pendentes</span>
              <strong className="kpi__value">{s.reviewsOverdue}</strong>
              <span className="card__hint">{s.reviewsNext30d} nos próximos 30 dias</span>
            </div>
          </div>

          <div className="adm-tabs" style={{ marginTop: 18 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`adm-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {/* key por empresa: cada aba remonta com estado limpo ao trocar o select */}
          {tab === "visao" && <VisaoTab key={tenantId} tenantId={tenantId} data={data} onOpen={setAberto} />}
          {tab === "inventario" && <InventarioTab key={tenantId} tenantId={tenantId} onOpen={setAberto} />}
          {tab === "casos" && <CasosTab key={tenantId} tenantId={tenantId} areas={s.areas} onOpen={setAberto} />}
          {tab === "riscos" && <RiscosTab key={tenantId} tenantId={tenantId} onOpen={setAberto} />}
          {tab === "politicas" && <PoliticasTab key={tenantId} tenantId={tenantId} />}
          {tab === "aprovacoes" && <AprovacoesTab key={tenantId} tenantId={tenantId} onOpen={setAberto} />}
          {tab === "incidentes" && <IncidentesTab key={tenantId} tenantId={tenantId} onOpen={setAberto} />}
          {tab === "evidencias" && <EvidenciasTab key={tenantId} tenantId={tenantId} onOpen={setAberto} />}
          {tab === "indicadores" && <IndicadoresTab key={tenantId} tenantId={tenantId} data={data} />}
          {tab === "auditoria" && <AuditoriaTab key={data.company.organizationId} organizationId={data.company.organizationId} />}

          <RuleBox>
            <strong>Regras desta tela.</strong> <b>IA da Plataforma</b> configura o motor CRIVO (token, modelo, prompts); <b>Governança de IA</b> é o
            serviço contratado para o cliente governar as PRÓPRIAS IAs — a CRIVO acompanha, não decide. Cadastro, classificação de risco (avaliação do
            cliente, não certificadora), decisão humana com justificativa, incidentes e políticas são feitos pela empresa no portal
            (Programas › Governança de IA). Aqui é somente leitura; a liberação do módulo fica em Contratos e Liberações.
          </RuleBox>
        </>
      )}

      {aberto && tenantId && <CasoModal tenantId={tenantId} useCaseId={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

// ── Visão Executiva ──

function VisaoTab({ tenantId, data, onOpen }: { tenantId: string; data: AiGovernanceAdminSummary; onOpen: (id: string) => void }) {
  const s = data.summary;
  const casos = useLista(() => listTenantAiUseCases(tenantId), [tenantId]);
  const revisoes = useLista(() => listTenantAiReviews(tenantId, "overdue"), [tenantId]);
  const matriz = useMemo(() => {
    const m: Record<AiRiskLevel, Record<AiRiskLevel, number>> = { ALTO: { ALTO: 0, MEDIO: 0, BAIXO: 0 }, MEDIO: { ALTO: 0, MEDIO: 0, BAIXO: 0 }, BAIXO: { ALTO: 0, MEDIO: 0, BAIXO: 0 } };
    for (const c of casos.data ?? []) m[c.inherentRisk][c.residualRisk] += 1;
    return m;
  }, [casos.data]);

  if (s.useCases === 0) {
    return (
      <div className="card">
        <div className="card__head"><div><h3>Panorama executivo do programa de IA do cliente</h3><span className="card__sub">Matriz de risco, pendências e revisões — a partir do que a empresa cadastrou.</span></div></div>
        <p className="dash-state" style={{ margin: 0 }}>Esta empresa ainda não cadastrou casos de uso. O panorama aparece quando o inventário for iniciado no portal (Programas › Governança de IA).</p>
      </div>
    );
  }
  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head"><div><h3>Matriz de risco (inerente × residual)</h3><span className="card__sub">Classificação feita pela empresa — avaliação não certificadora.</span></div></div>
        {casos.err && <div className="dash-state dash-state--error">{casos.err}</div>}
        {!casos.data && !casos.err && <p className="dash-state">Carregando…</p>}
        {casos.data && (
          <table className="data-table">
            <thead><tr><th>Inerente ↓ · Residual →</th>{AI_RISK_LEVELS.map((r) => <th key={r}>{AI_RISK_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {AI_RISK_LEVELS.map((i) => (
                <tr key={i}><td><Chip tone={riskTone(i)}>{AI_RISK_LABEL[i]}</Chip></td>{AI_RISK_LEVELS.map((r) => <td key={r}><strong>{matriz[i][r]}</strong></td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card__head"><div><h3>Pendências</h3><span className="card__sub">O que aguarda a empresa — a decisão é dela.</span></div></div>
        <table className="data-table">
          <tbody>
            {AI_USE_CASE_STATUSES.map((st) => (
              <tr key={st}><td>{AI_USE_CASE_STATUS_LABEL[st]}</td><td><strong>{s.byStatus[st]}</strong></td></tr>
            ))}
            <tr><td>Incidentes abertos</td><td><strong>{s.openIncidents}</strong></td></tr>
            <tr><td>Revisões vencidas</td><td><strong>{s.reviewsOverdue}</strong></td></tr>
            <tr><td>Políticas aprovadas</td><td><strong>{s.policies.approved}</strong> de {s.policies.total}</td></tr>
          </tbody>
        </table>
        {revisoes.data && revisoes.data.length > 0 && (
          <>
            <p className="card__hint" style={{ marginTop: 12 }}>Revisões vencidas:</p>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {revisoes.data.map((r) => (
                <li key={r.useCaseId}><a href="#" onClick={(e) => { e.preventDefault(); onOpen(r.useCaseId); }} style={{ color: "var(--gold-deep)" }}>{r.code} · {r.name}</a> — venceu em {fmtDate(r.nextReviewAt)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inventário (sistemas, agentes e integrações = tecnologia/fornecedor dos casos) ──

function InventarioTab({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const casos = useLista(() => listTenantAiUseCases(tenantId), [tenantId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Inventário de sistemas, agentes e integrações de IA</h3><span className="card__sub">Por tecnologia, fornecedor, dados sensíveis, público e responsável — campos do próprio caso de uso (não há cadastro separado de fornecedores).</span></div></div>
      <Tabela
        estado={casos}
        vazio="Esta empresa ainda não cadastrou casos de uso."
        head={["Caso de uso", "Tecnologia", "Fornecedor", "Dados utilizados", "Público", "Responsável", "Status"]}
        rows={(casos.data ?? []).map((c) => [
          <a key="n" href="#" onClick={(e) => { e.preventDefault(); onOpen(c.id); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{c.code} · {c.name}</a>,
          c.technology, c.vendor ?? "—", c.dataUsed, c.audience, c.ownerName,
          <Chip key="s" tone={statusTone(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</Chip>,
        ])}
        keys={(casos.data ?? []).map((c) => c.id)}
      />
    </div>
  );
}

// ── Casos de Uso (com filtros área/risco/status) ──

function CasosTab({ tenantId, areas, onOpen }: { tenantId: string; areas: string[]; onOpen: (id: string) => void }) {
  const [area, setArea] = useState("");
  const [risk, setRisk] = useState("");
  const [st, setSt] = useState("");
  const casos = useLista(() => listTenantAiUseCases(tenantId, { area, risk, status: st }), [tenantId, area, risk, st]);
  return (
    <div className="card">
      <div className="card__head">
        <div><h3>Casos de uso</h3><span className="card__sub">Inventário governado pela empresa. Clique para abrir o detalhe (decisões, controles, vínculos).</span></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <label className="prod-field" style={{ minWidth: 160 }}><span>Área</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <label className="prod-field" style={{ minWidth: 150 }}><span>Risco inerente</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">Todos os riscos</option>{AI_RISK_LEVELS.map((r) => <option key={r} value={r}>{AI_RISK_LABEL[r]}</option>)}</select>
        </label>
        <label className="prod-field" style={{ minWidth: 160 }}><span>Status</span>
          <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">Todos os status</option>{AI_USE_CASE_STATUSES.map((x) => <option key={x} value={x}>{AI_USE_CASE_STATUS_LABEL[x]}</option>)}</select>
        </label>
      </div>
      <Tabela
        estado={casos}
        vazio={area || risk || st ? "Nenhum caso para os filtros aplicados." : "Esta empresa ainda não cadastrou casos de uso."}
        head={["Caso de uso", "Área", "Risco", "Responsável", "Status"]}
        rows={(casos.data ?? []).map((c) => [
          <a key="n" href="#" onClick={(e) => { e.preventDefault(); onOpen(c.id); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{c.code} · {c.name}</a>,
          c.area,
          <Chip key="r" tone={riskTone(c.inherentRisk)}>{AI_RISK_LABEL[c.inherentRisk]}</Chip>,
          c.ownerName,
          <Chip key="s" tone={statusTone(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</Chip>,
        ])}
        keys={(casos.data ?? []).map((c) => c.id)}
      />
    </div>
  );
}

// ── Riscos e Classificação (linhas derivadas: caso × inerente/residual × controles) ──

function RiscosTab({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const casos = useLista(() => listTenantAiUseCases(tenantId), [tenantId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Riscos e classificação</h3><span className="card__sub">Uma linha por caso: risco inerente → residual e os controles declarados. Classificação da empresa, não score CRIVO.</span></div></div>
      <Tabela
        estado={casos}
        vazio="Sem casos de uso — não há riscos classificados."
        head={["Risco", "Controle", "Status"]}
        rows={(casos.data ?? []).map((c) => [
          <span key="r"><a href="#" onClick={(e) => { e.preventDefault(); onOpen(c.id); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{c.code}</a> · <Chip tone={riskTone(c.inherentRisk)}>inerente {AI_RISK_LABEL[c.inherentRisk]}</Chip> <Chip tone={riskTone(c.residualRisk)}>residual {AI_RISK_LABEL[c.residualRisk]}</Chip></span>,
          c.controls.length ? c.controls.join(" · ") : "— nenhum controle declarado",
          <Chip key="s" tone={statusTone(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</Chip>,
        ])}
        keys={(casos.data ?? []).map((c) => c.id)}
      />
    </div>
  );
}

// ── Políticas e Controles ──

function PoliticasTab({ tenantId }: { tenantId: string }) {
  const pols = useLista<AiPolicyData[]>(() => listTenantAiPolicies(tenantId), [tenantId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Políticas de uso, dados, humanos no loop e transparência</h3><span className="card__sub">Documentos que a empresa mantém no portal, com versão, status e data.</span></div></div>
      <Tabela
        estado={pols}
        vazio="Esta empresa ainda não cadastrou políticas."
        head={["Política", "Versão", "Data", "Documento", "Status"]}
        rows={(pols.data ?? []).map((p) => [
          <strong key="t">{p.title}</strong>, p.version, fmtDate(p.publishedAt ?? p.updatedAt),
          p.url ? <a key="u" href={p.url} target="_blank" rel="noreferrer" style={{ color: "var(--gold-deep)" }}>Abrir</a> : "—",
          <Chip key="s" tone={p.status === "APROVADO" ? "gold" : undefined}>{AI_POLICY_STATUS_LABEL[p.status]}</Chip>,
        ])}
        keys={(pols.data ?? []).map((p) => p.id)}
      />
    </div>
  );
}

// ── Aprovações (trilha AiUseCaseDecision) ──

function AprovacoesTab({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const dec = useLista<AiUseCaseDecisionData[]>(() => listTenantAiDecisions(tenantId), [tenantId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Aprovações</h3><span className="card__sub">Trilha das decisões humanas registradas pela empresa (aprovador, data, justificativa). Nunca editada — só sucedida por outra.</span></div></div>
      <Tabela
        estado={dec}
        vazio="Nenhuma decisão registrada por esta empresa ainda."
        head={["Item", "Aprovador", "Data", "Justificativa", "Status"]}
        rows={(dec.data ?? []).map((d) => [
          <a key="i" href="#" onClick={(e) => { e.preventDefault(); onOpen(d.useCaseId); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{d.useCaseCode ?? "—"} · {d.useCaseName ?? ""}</a>,
          d.decidedByName, fmtDateTime(d.decidedAt),
          <span key="j" style={{ color: "var(--text-sec)" }}>{d.justification}</span>,
          <Chip key="s" tone={statusTone(AI_DECISION_TO_STATUS[d.decision])}>{AI_DECISION_LABEL[d.decision]} → {AI_USE_CASE_STATUS_LABEL[AI_DECISION_TO_STATUS[d.decision]]}</Chip>,
        ])}
        keys={(dec.data ?? []).map((d) => d.id)}
      />
    </div>
  );
}

// ── Incidentes ──

function IncidentesTab({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const inc = useLista<AiIncidentData[]>(() => listTenantAiIncidents(tenantId), [tenantId]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Incidentes</h3><span className="card__sub">Ocorrências registradas pela empresa, com severidade e situação.</span></div></div>
      <Tabela
        estado={inc}
        vazio="Nenhum incidente registrado por esta empresa."
        head={["Título", "Caso", "Severidade", "Data", "Status"]}
        rows={(inc.data ?? []).map((i) => [
          <span key="d">{i.description}</span>,
          i.useCaseId ? <a key="c" href="#" onClick={(e) => { e.preventDefault(); onOpen(i.useCaseId!); }} style={{ color: "var(--gold-deep)" }}>{i.useCaseCode}</a> : "—",
          <Chip key="s" tone={i.severity === "ALTA" ? "danger" : i.severity === "MEDIA" ? "gold" : undefined}>{AI_INCIDENT_SEVERITY_LABEL[i.severity]}</Chip>,
          fmtDate(i.occurredAt),
          <Chip key="st" tone={i.status === "ABERTO" ? "danger" : undefined}>{AI_INCIDENT_STATUS_LABEL[i.status]}</Chip>,
        ])}
        keys={(inc.data ?? []).map((i) => i.id)}
      />
    </div>
  );
}

// ── Evidências (casos × vínculos × revisão) ──

function EvidenciasTab({ tenantId, onOpen }: { tenantId: string; onOpen: (id: string) => void }) {
  const casos = useLista(() => listTenantAiUseCases(tenantId), [tenantId]);
  const revisoes = useLista<AiReviewEntry[]>(() => listTenantAiReviews(tenantId, "all"), [tenantId]);
  const porCaso = useMemo(() => new Map((revisoes.data ?? []).map((r) => [r.useCaseId, r])), [revisoes.data]);
  return (
    <div className="card">
      <div className="card__head"><div><h3>Evidências e revisões</h3><span className="card__sub">Vínculos do caso com Evidências / Plano de Evolução (contagem; os títulos ficam no detalhe) e a próxima revisão. Não há “ciclo” próprio: a revisão é a data informada pela empresa.</span></div></div>
      <Tabela
        estado={casos}
        vazio="Esta empresa ainda não cadastrou casos de uso."
        head={["Caso de uso", "Próxima revisão", "Evidências / vínculos", "Status"]}
        rows={(casos.data ?? []).map((c) => {
          const r = porCaso.get(c.id);
          return [
            <a key="n" href="#" onClick={(e) => { e.preventDefault(); onOpen(c.id); }} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{c.code} · {c.name}</a>,
            r ? <span key="r">{fmtDate(r.nextReviewAt)} {r.overdue && <Chip tone="danger">vencida</Chip>}</span> : "—",
            c.linksCount > 0 ? `${c.linksCount} vínculo(s)` : "nenhum",
            <Chip key="s" tone={statusTone(c.status)}>{AI_USE_CASE_STATUS_LABEL[c.status]}</Chip>,
          ];
        })}
        keys={(casos.data ?? []).map((c) => c.id)}
      />
    </div>
  );
}

// ── Indicadores (derivados do que existe — sem meta inventada) ──

function IndicadoresTab({ tenantId, data }: { tenantId: string; data: AiGovernanceAdminSummary }) {
  const s = data.summary;
  const casos = useLista(() => listTenantAiUseCases(tenantId), [tenantId]);
  const dec = useLista<AiUseCaseDecisionData[]>(() => listTenantAiDecisions(tenantId), [tenantId]);
  const lista = useMemo(() => casos.data ?? [], [casos.data]);
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
  const decididos = lista.filter((c) => c.lastDecision).length;
  const comControles = lista.filter((c) => c.controls.length > 0).length;
  const comRevisao = lista.filter((c) => c.nextReviewAt).length;
  // Tempo médio até a 1ª decisão: da criação do caso à decisão mais antiga dele.
  const tempoMedio = useMemo(() => {
    if (!dec.data || lista.length === 0) return null;
    const primeira = new Map<string, number>();
    for (const d of dec.data) {
      const t = new Date(d.decidedAt).getTime();
      const cur = primeira.get(d.useCaseId);
      if (cur === undefined || t < cur) primeira.set(d.useCaseId, t);
    }
    const dias: number[] = [];
    for (const c of lista) {
      const t = primeira.get(c.id);
      if (t !== undefined) dias.push((t - new Date(c.createdAt).getTime()) / 86400000);
    }
    if (!dias.length) return null;
    return Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
  }, [dec.data, lista]);

  return (
    <div className="card">
      <div className="card__head"><div><h3>Indicadores do programa</h3><span className="card__sub">Cobertura, revisões, incidentes e tempo médio — calculados sobre o inventário real da empresa. Sem meta: a CRIVO acompanha.</span></div></div>
      {s.useCases === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>Sem casos de uso cadastrados não há indicador a calcular.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Indicador</th><th>Valor</th><th>Como é calculado</th></tr></thead>
          <tbody>
            <tr><td>Cobertura de decisão</td><td><strong>{pct(decididos, lista.length)}</strong></td><td>casos com ao menos uma decisão humana / casos cadastrados ({decididos} de {lista.length})</td></tr>
            <tr><td>Casos com controles declarados</td><td><strong>{pct(comControles, lista.length)}</strong></td><td>{comControles} de {lista.length}</td></tr>
            <tr><td>Casos com revisão agendada</td><td><strong>{pct(comRevisao, lista.length)}</strong></td><td>{comRevisao} de {lista.length} · {s.reviewsOverdue} vencida(s) · {s.reviewsNext30d} nos próximos 30 dias</td></tr>
            <tr><td>Incidentes (12m)</td><td><strong>{s.incidents12m}</strong></td><td>ocorrências com data nos últimos 12 meses · {s.openIncidents} em aberto</td></tr>
            <tr><td>Tempo médio até a 1ª decisão</td><td><strong>{tempoMedio == null ? "—" : `${tempoMedio} dia(s)`}</strong></td><td>da criação do caso à primeira decisão registrada (só casos decididos)</td></tr>
            <tr><td>Políticas aprovadas</td><td><strong>{s.policies.approved}</strong> de {s.policies.total}</td><td>status APROVADO no cadastro de políticas</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Auditoria (AuditLog filtrado por empresa + prefixo ai_governance.) ──

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
      <div className="card__head"><div><h3>Trilha completa de decisões, aprovações e incidentes</h3><span className="card__sub">Eventos ai_governance.* desta empresa: decisões humanas registradas no portal e consultas deste painel.</span></div></div>
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
  "ai_governance.decision": "Decisão humana registrada (portal)",
  "ai_governance.view": "Painel de Governança de IA consultado",
};

// ── Detalhe do caso (somente leitura) ──

function F({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div><div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 10, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 14 }}>{value}</div></div>
  );
}

function CasoModal({ tenantId, useCaseId, onClose }: { tenantId: string; useCaseId: string; onClose: () => void }) {
  const [caso, setCaso] = useState<AiUseCaseDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getTenantAiUseCase(tenantId, useCaseId)
      .then((c) => { if (alive) setCaso(c); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Falha ao abrir o caso."); });
    return () => { alive = false; };
  }, [tenantId, useCaseId]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            {caso && <span className="card__hint">{caso.code} · {caso.area} · {caso.technology}</span>}
            <h2 style={{ marginTop: 4 }}>{caso?.name ?? "Caso de uso"}</h2>
          </div>
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{err}</div>}
          {!caso && !err && <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>}
          {caso && (
            <>
              <F label="Finalidade" value={caso.purpose} />
              <F label="Responsável" value={caso.ownerName} />
              <F label="Fornecedor" value={caso.vendor ?? "—"} />
              <F label="Dados utilizados" value={caso.dataUsed} />
              <F label="Público afetado" value={caso.audience} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip tone={riskTone(caso.inherentRisk)}>Risco inerente: {AI_RISK_LABEL[caso.inherentRisk]}</Chip>
                <Chip tone={riskTone(caso.residualRisk)}>Risco residual: {AI_RISK_LABEL[caso.residualRisk]}</Chip>
                <Chip tone={statusTone(caso.status)}>{AI_USE_CASE_STATUS_LABEL[caso.status]}</Chip>
              </div>
              <F label="Controles" value={caso.controls.length ? caso.controls.join(" · ") : "—"} />
              <F label="Justificativa vigente" value={caso.justification ?? "—"} />
              <F label="Próxima revisão" value={fmtDate(caso.nextReviewAt)} />
              <F label="Vínculos" value={caso.links.length ? caso.links.map((l) => `${AI_LINK_KIND_LABEL[l.kind]}: ${l.label ?? "(removido)"}`).join(" · ") : "—"} />
              <F label="Incidentes" value={caso.incidents.length ? caso.incidents.map((i) => `${fmtDate(i.occurredAt)} · ${AI_INCIDENT_SEVERITY_LABEL[i.severity]} · ${AI_INCIDENT_STATUS_LABEL[i.status]}`).join(" · ") : "nenhum"} />
              <div>
                <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>Trilha de decisões (do cliente)</div>
                {caso.decisions.length === 0 ? (
                  <div style={{ fontSize: 14 }}>Nenhuma decisão registrada.</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Quando</th><th>Decisão</th><th>Quem</th><th>Justificativa</th></tr></thead>
                    <tbody>
                      {caso.decisions.map((d) => (
                        <tr key={d.id}><td>{fmtDateTime(d.decidedAt)}</td><td>{AI_DECISION_LABEL[d.decision]}</td><td>{d.decidedByName}</td><td style={{ color: "var(--text-sec)" }}>{d.justification}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="card__hint" style={{ margin: 0 }}>Somente leitura: a CRIVO acompanha; quem decide é a empresa, no portal.</p>
            </>
          )}
        </div>
      </div>
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
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={keys[i] ?? i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
