"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MODULES } from "@crivo/types";
import {
  getIntelligenceCompanies,
  getIntelligenceOverview,
  type IntelligenceCompany,
  type IntelligenceOverview,
} from "@/lib/admin-api";
import "./cnae.css";

type Tab = "diagnostico" | "plano" | "lideranca" | "custos" | "evolucao" | "prova";

const MODULE_LABEL: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.code, m.name]));
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

/** Nível de score → faixa de cor (reusa badges do cnae.css). */
function bandOf(score: number | null): string {
  if (score == null) return "cnae-badge--medio";
  if (score >= 70) return "cnae-badge--baixo"; // maior = melhor → verde/baixo risco
  if (score >= 50) return "cnae-badge--medio";
  return "cnae-badge--alto";
}

/**
 * Inteligência CRIVO (Caderno §10) — camada analítica por cliente/CNPJ.
 * Separada do Dashboard operacional e da Base CRIVO. Acesso auditado.
 */
export function IntelligenceSection() {
  const [companies, setCompanies] = useState<IntelligenceCompany[] | null>(null);
  const [tenantId, setTenantId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<IntelligenceOverview | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [tab, setTab] = useState<Tab>("diagnostico");

  useEffect(() => {
    getIntelligenceCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  async function load(tid = tenantId, f = from, t = to) {
    if (!tid) return;
    setStatus("loading");
    try {
      setData(await getIntelligenceOverview(tid, { from: f || undefined, to: t || undefined }));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function onSelect(tid: string) {
    setTenantId(tid);
    setData(null);
    if (tid) void load(tid, from, to);
  }

  const selected = useMemo(() => companies?.find((c) => c.tenantId === tenantId) ?? null, [companies, tenantId]);

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Inteligência CRIVO</h1>
          <p className="page-sub">
            Camada analítica da CRIVO — cruza diagnóstico, plano, evidências, indicadores, ICD/liderança,
            custos e evolução de <strong>um cliente identificável</strong>, por CNPJ e período. Não é o
            Dashboard operacional nem a Base CRIVO.
          </p>
        </div>
      </div>

      <div className="adm-callout">
        <strong>Individual identificável × Base CRIVO agregada.</strong> Aqui a análise é do cliente/CNPJ
        (identificável) — o isolamento por CNPJ é garantido por RLS, então <strong>não há mistura</strong>
        entre empresas. O que pode alimentar a <em>Base CRIVO</em> (benchmark/cases) só ocorre lá, com
        <strong> autorização + anonimização + volume mínimo</strong> (aba Prova Social). Todo acesso é
        registrado na Auditoria.
      </div>

      {/* Filtros */}
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
          <label className="prod-field">
            <span>De</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="prod-field">
            <span>Até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div>
            <button className="btn btn--terra btn--sm" disabled={!tenantId} onClick={() => load()}>
              Aplicar período
            </button>
          </div>
        </div>
      </div>

      {!tenantId && <p className="dash-state">Selecione uma empresa para ver a análise cruzada.</p>}
      {status === "loading" && <p className="dash-state">Cruzando dados do cliente…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar a análise.</div>}

      {status === "idle" && data && (
        <>
          <CompanyHeader data={data} selected={selected} />
          <Cards data={data} />
          <div className="adm-tabs" style={{ marginTop: 18 }}>
            {([
              ["diagnostico", "Diagnóstico"],
              ["plano", "Plano & Evidências"],
              ["lideranca", "Liderança / ICD"],
              ["custos", "Custos & People"],
              ["evolucao", "Evolução"],
              ["prova", "Prova Social"],
            ] as const).map(([key, label]) => (
              <button key={key} className={`adm-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            {tab === "diagnostico" && <DiagnosticoTab data={data} />}
            {tab === "plano" && <PlanoTab data={data} />}
            {tab === "lideranca" && <LiderancaTab data={data} />}
            {tab === "custos" && <CustosTab data={data} />}
            {tab === "evolucao" && <EvolucaoTab data={data} />}
            {tab === "prova" && <ProvaTab data={data} />}
          </div>
        </>
      )}
    </div>
  );
}

function CompanyHeader({ data }: { data: IntelligenceOverview; selected: IntelligenceCompany | null }) {
  const c = data.company;
  const contract = data.contract;
  return (
    <div className="cnae-card__hero" style={{ display: "block", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
        <div>
          <strong style={{ fontSize: 16 }}>{c.name}</strong>{" "}
          <span className="cnae-muted">{c.cnpj ?? "CNPJ não informado"}{c.headquarterType ? ` · ${c.headquarterType}` : ""}</span>
          {c.groupName && <span className="cnae-badge cnae-badge--baixo" style={{ marginLeft: 8 }}>grupo {c.groupName}</span>}
        </div>
        <div>
          {contract.hasContract ? (
            <span className="pattern-tag">Contrato {contract.status}{contract.byGroup ? " (por grupo)" : ""}</span>
          ) : (
            <span className="cnae-muted">sem contrato registrado</span>
          )}
        </div>
      </div>
      {data.modules.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.modules.map((m) => (
            <span key={m} className="pattern-tag" style={{ fontSize: 10.5 }}>{MODULE_LABEL[m] ?? m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Cards({ data }: { data: IntelligenceOverview }) {
  const k = data.cards;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
      <Card title="Proteção psicossocial" hint={k.protecao ? `${k.protecao.respondents} respondente(s)` : "sem respostas"}>
        {k.protecao == null ? <Empty /> : k.protecao.suppressed ? <span className="cnae-muted">confidencial (&lt; 3)</span> : (
          <span className={`cnae-badge ${bandOf(k.protecao.score)}`}>{k.protecao.score}/100</span>
        )}
      </Card>
      <Card title="ICD agregado" hint={k.icd ? `${k.icd.cyclesClosed} ciclo(s) · ${k.icd.eligibleLeaders} líderes` : "sem fechamento"}>
        {k.icd == null ? <Empty /> : k.icd.suppressed || k.icd.score == null ? <span className="cnae-muted">confidencial (&lt; 5)</span> : (
          <span className={`cnae-badge ${bandOf(k.icd.score)}`}>{k.icd.score}/100</span>
        )}
      </Card>
      <Card title="Plano executado" hint={`${k.plano.concluidas}/${k.plano.total} ações concluídas`}>
        <strong style={{ fontSize: 22 }}>{k.plano.pct}%</strong>
      </Card>
      <Card title="Nível de evidência" hint={`${k.nivelEvidencia.acoesComEvidencia}/${k.nivelEvidencia.totalAcoes} ações com evidência`}>
        <strong style={{ fontSize: 22 }}>{k.nivelEvidencia.pct}%</strong>
      </Card>
      <Card title="Custos invisíveis" hint={k.custos?.confidence ? `confiança ${k.custos.confidence}` : "sem estimativa"}>
        {k.custos?.moderado != null ? <strong style={{ fontSize: 18 }}>R$ {Number(k.custos.moderado).toLocaleString("pt-BR")}</strong> : <Empty />}
      </Card>
      <Card title="Pendências" hint="atrasadas · sem evidência · planos p/ validar">
        <strong style={{ fontSize: 18 }}>{k.pendencias.acoesAtrasadas} · {k.pendencias.acoesSemEvidencia} · {k.pendencias.planosNaoValidados}</strong>
      </Card>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="cnae-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      <div style={{ minHeight: 30, display: "flex", alignItems: "center" }}>{children}</div>
      {hint && <div className="cnae-muted" style={{ fontSize: 11, marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

const Empty = () => <span className="cnae-muted">—</span>;

function DiagnosticoTab({ data }: { data: IntelligenceOverview }) {
  const p = data.diagnostico.psychosocial;
  if (!p) return <p className="dash-state">Sem diagnóstico psicossocial no período.</p>;
  return (
    <div className="card">
      <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap", marginBottom: 12 }}>
        <span className={`cnae-badge ${bandOf(p.score)}`}>{p.suppressed ? "confidencial" : `${p.score}/100`}</span>
        <span className="cnae-muted">{p.respondents} respondente(s)</span>
        {p.methodologyMixed && (
          <span className="cnae-badge cnae-badge--alto" title="Respostas pontuadas por versões diferentes de metodologia — comparabilidade limitada">
            mistura {p.methodologyVersionIds.length} versões de metodologia
          </span>
        )}
        {!p.methodologyMixed && p.methodologyVersionIds.length === 1 && (
          <span className="cnae-muted" style={{ fontSize: 11 }}>metodologia única (comparável) · {p.methodologyVersionIds[0].slice(0, 8)}…</span>
        )}
      </div>
      {!p.suppressed && Object.keys(p.byDimension).length > 0 && (
        <table className="cnae-table">
          <thead><tr><th>Dimensão</th><th>Média (0–100)</th></tr></thead>
          <tbody>
            {Object.entries(p.byDimension).map(([dim, v]) => (
              <tr key={dim}><td style={{ textTransform: "capitalize" }}>{dim}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlanoTab({ data }: { data: IntelligenceOverview }) {
  const items = data.planoEvidencias.items;
  if (items.length === 0) return <p className="dash-state">Nenhuma ação registrada no período.</p>;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Cruzamento fator → ação → evidência. {data.planoEvidencias.evidenciasRegistradas} evidência(s) registrada(s).
      </p>
      <table className="cnae-table">
        <thead><tr><th>Ponto / fator</th><th>Ação</th><th>Status</th><th>Responsável</th><th>Prazo</th><th>Evidências</th></tr></thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}>
              <td>{i.point}</td>
              <td>{i.action}</td>
              <td><span className="pattern-tag">{i.status}</span></td>
              <td>{i.responsible ?? "—"}</td>
              <td>{fmtDate(i.dueDate)}</td>
              <td>{i.evidenceCount > 0 ? `✓ ${i.evidenceCount}` : <span className="cnae-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiderancaTab({ data }: { data: IntelligenceOverview }) {
  const l = data.lideranca;
  return (
    <div className="card">
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        ICD agregado por ciclo (§11 — sem ranking individual). Pocket: {l.pocket.completed}/{l.pocket.total} sessões concluídas.
      </p>
      {l.icdCycles.length === 0 ? (
        <p className="dash-state">Nenhum fechamento de ICD no período.</p>
      ) : (
        <table className="cnae-table">
          <thead><tr><th>Ciclo</th><th>ICD</th><th>Líderes elegíveis</th><th>Fechado em</th></tr></thead>
          <tbody>
            {l.icdCycles.map((c, idx) => (
              <tr key={idx}>
                <td>{c.cycleName}</td>
                <td>{c.suppressed || c.score == null ? <span className="cnae-muted">confidencial (&lt; 5)</span> : <span className={`cnae-badge ${bandOf(c.score)}`}>{c.score}</span>}</td>
                <td>{c.eligibleLeaders}</td>
                <td>{fmtDate(c.computedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CustosTab({ data }: { data: IntelligenceOverview }) {
  const custos = data.custos;
  const people = data.peopleAnalytics;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Custos invisíveis</h4>
        {!custos ? <p className="cnae-muted">Módulo sem estimativa registrada para esta empresa.</p> : (
          <table className="cnae-table">
            <thead><tr><th>Cenário</th><th>Valor</th></tr></thead>
            <tbody>
              {Object.entries(custos.scenarios).map(([k, v]) => (
                <tr key={k}><td style={{ textTransform: "capitalize" }}>{k}</td><td>R$ {Number(v).toLocaleString("pt-BR")}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>People Analytics</h4>
        {!people ? <p className="cnae-muted">Módulo sem dados de People Analytics para esta empresa.</p> : (
          <>
            <p className="cnae-muted" style={{ marginTop: 0 }}>Último período: <strong>{people.period}</strong> · {people.alerts} alerta(s)</p>
            <table className="cnae-table">
              <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
              <tbody>
                {Object.entries(people.values).map(([k, v]) => (
                  <tr key={k}><td style={{ textTransform: "capitalize" }}>{k}</td><td>{v ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function EvolucaoTab({ data }: { data: IntelligenceOverview }) {
  const s = data.evolucao.icd.filter((c) => c.score != null);
  if (s.length === 0) return <p className="dash-state">Sem série histórica de ICD suficiente para evolução (recortes confidenciais são omitidos).</p>;
  const max = 100;
  return (
    <div className="card">
      <p className="cnae-muted" style={{ marginTop: 0 }}>Evolução do ICD agregado por ciclo (usa a versão de metodologia pinada — comparável).</p>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 160, padding: "10px 0", overflowX: "auto" }}>
        {s.map((c, idx) => (
          <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{c.score}</div>
            <div style={{ width: 30, height: `${((c.score ?? 0) / max) * 120}px`, background: "var(--azul-cobalto)", borderRadius: "3px 3px 0 0" }} />
            <div className="cnae-muted" style={{ fontSize: 10, textAlign: "center" }}>{c.cycleName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvaTab({ data }: { data: IntelligenceOverview }) {
  const b = data.baseCrivoBoundary;
  const rows: [string, boolean][] = [
    ["Benchmark (Base CRIVO agregada)", b.consentBenchmark],
    ["Case (história autorizada)", b.consentCase],
    ["Uso de logo", b.consentLogo],
    ["Depoimento", b.consentTestimonial],
    ["Dados anonimizados", b.consentAnonymized],
  ];
  return (
    <div className="card">
      <div className="adm-callout" style={{ margin: "0 0 14px" }}>
        <strong>Fronteira com a Base CRIVO.</strong> Esta empresa só entra na inteligência agregada
        (benchmark/cases/prova social) nos itens <strong>autorizados</strong> abaixo. Sem autorização, o dado
        fica só nesta análise individual. A anonimização e o volume mínimo são aplicados na Base CRIVO.
      </div>
      <table className="cnae-table">
        <thead><tr><th>Autorização de uso</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(([label, on]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{on ? <span className="cnae-badge cnae-badge--baixo">autorizado</span> : <span className="cnae-muted">não autorizado</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
