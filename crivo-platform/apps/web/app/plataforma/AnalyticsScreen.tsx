"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTION_STATUS_LABEL,
  DECISION_PRESSURE_FACTOR_LABEL,
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_MOMENT_LABEL,
  PEOPLE_INDICATORS,
  computePeopleTrends,
  type ActionStatus,
  type DecisionPressureFactor,
  type PocketMomentOfUse,
  type PeoplePeriod,
} from "@crivo/types";
import {
  getMyAnalytics,
  getPeopleIndicators,
  savePeopleIndicators,
  analyzePeople,
  type AnalyticsData,
  type PeopleAnalysis,
} from "@/lib/api";

type LoadStatus = "loading" | "ok" | "error";

/**
 * People Analytics — Briefing §10 / Matriz §People Analytics avançado.
 * MVP com cruzamentos disponíveis nos dados que o sistema já coleta.
 * Indicadores importados (turnover/clima/absenteísmo) entram quando forem
 * conectados via Super Admin — placeholder honesto até lá.
 */
export function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  async function refresh() {
    setStatus("loading");
    try {
      setData(await getMyAnalytics());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    getMyAnalytics()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  const hasIcd = (data?.icdEvolution.length ?? 0) > 0;
  const hasDecisions = (data?.decisionsByCategory.length ?? 0) > 0;
  const hasPocket = (data?.pocketUsage.totalSessions ?? 0) > 0;
  const hasPlan = (data?.planSummary.total ?? 0) > 0;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">People Analytics</h1>
          <p className="page-sub">
            Cruzamentos agregados de indicadores CRIVO. Sem dados nominativos (§11).
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando indicadores…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar.</div>}

      {status === "ok" && data && (
        <>
          {/* Evolução ICD trimestral */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__head">
              <div>
                <h3>Evolução do ICD oficial</h3>
                <span className="card__sub">Últimos 12 ciclos trimestrais — supressão {MIN_LEADERS_FOR_DISCLOSURE}+ (§11)</span>
              </div>
            </div>
            {!hasIcd ? (
              <p className="dash-state" style={{ margin: 0 }}>
                Nenhum ciclo fechado ainda. Quando você encerrar o primeiro ciclo trimestral,
                a evolução aparece aqui.
              </p>
            ) : (
              <IcdBars data={data.icdEvolution} />
            )}
          </div>

          {/* Decisões */}
          <div className="grid grid--2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Decisões por categoria</h3>
                  <span className="card__sub">Distribuição agregada do registro de decisões</span>
                </div>
              </div>
              {!hasDecisions ? (
                <p className="dash-state" style={{ margin: 0 }}>Nenhuma decisão registrada ainda.</p>
              ) : (
                <BarList rows={data.decisionsByCategory.slice(0, 8).map((r) => ({ label: r.category, count: r.count }))} />
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Fator de pressão dominante</h3>
                  <span className="card__sub">O que mais pesa nas decisões</span>
                </div>
              </div>
              {data.decisionsByPressure.length === 0 ? (
                <p className="dash-state" style={{ margin: 0 }}>Sem dados — registre decisões para ver os padrões.</p>
              ) : (
                <BarList
                  rows={data.decisionsByPressure.slice(0, 9).map((r) => ({
                    label: DECISION_PRESSURE_FACTOR_LABEL[r.pressureFactor as DecisionPressureFactor] ?? r.pressureFactor,
                    count: r.count,
                  }))}
                />
              )}
            </div>
          </div>

          {/* Pocket + Plano */}
          <div className="grid grid--2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Uso do Pocket CRIVO</h3>
                  <span className="card__sub">Total de sessões e momento de uso (§13 — sem conteúdo individual)</span>
                </div>
              </div>
              {!hasPocket ? (
                <p className="dash-state" style={{ margin: 0 }}>Nenhuma sessão Pocket registrada.</p>
              ) : (
                <>
                  <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
                    <div className="kpi">
                      <span className="kpi__label">Sessões totais</span>
                      <strong className="kpi__value">{data.pocketUsage.totalSessions}</strong>
                      <span className="kpi__delta">{data.pocketUsage.concluded} concluídas</span>
                    </div>
                    <div className="kpi">
                      <span className="kpi__label">Conclusão</span>
                      <strong className="kpi__value">
                        {data.pocketUsage.totalSessions
                          ? Math.round((data.pocketUsage.concluded / data.pocketUsage.totalSessions) * 100)
                          : 0}%
                      </strong>
                      <span className="kpi__delta">do total iniciado</span>
                    </div>
                  </div>
                  <BarList
                    rows={(Object.entries(data.pocketUsage.byMoment) as [PocketMomentOfUse, number][]).map(([m, n]) => ({
                      label: POCKET_MOMENT_LABEL[m] ?? m,
                      count: n,
                    }))}
                  />
                </>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Plano de Ação</h3>
                  <span className="card__sub">Status × origem dos itens</span>
                </div>
              </div>
              {!hasPlan ? (
                <p className="dash-state" style={{ margin: 0 }}>Nenhum plano de ação registrado.</p>
              ) : (
                <>
                  <div className="dash-dist" style={{ marginBottom: 12 }}>
                    {(Object.entries(data.planSummary.byStatus) as [ActionStatus, number][]).map(([s, n]) => (
                      <span key={s} className="dash-dist__item">
                        {ACTION_STATUS_LABEL[s] ?? s}: <strong>{n}</strong>
                      </span>
                    ))}
                  </div>
                  <BarList
                    rows={Object.entries(data.planSummary.byOrigin).map(([o, n]) => ({ label: o, count: n }))}
                  />
                </>
              )}
            </div>
          </div>

          {/* Indicadores de RH + IA Analítica (Fase 4) */}
          <PeopleIndicators crivo={data} />
        </>
      )}
    </>
  );
}

// ── People Analytics: indicadores de RH editáveis + IA Analítica (Fase 4) ──

function PeopleIndicators({ crivo }: { crivo: AnalyticsData }) {
  const [periods, setPeriods] = useState<PeoplePeriod[]>([]);
  const [analysis, setAnalysis] = useState<PeopleAnalysis | null>(null);
  const [analysisAt, setAnalysisAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done">("idle");
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPeopleIndicators()
      .then((d) => {
        setPeriods(d.periods ?? []);
        setAnalysis(d.analysis);
        setAnalysisAt(d.analysisAt);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const trends = useMemo(() => computePeopleTrends(periods), [periods]);

  const setPeriodField = (i: number, patch: Partial<PeoplePeriod>) =>
    setPeriods((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setVal = (i: number, key: string, v: string) =>
    setPeriods((ps) =>
      ps.map((p, j) => (j === i ? { ...p, values: { ...p.values, [key]: v === "" ? null : Number(v.replace(",", ".")) } } : p)),
    );
  const addPeriod = () => setPeriods((ps) => [...ps, { period: "", headcount: null, values: {} }]);
  const removePeriod = (i: number) => setPeriods((ps) => ps.filter((_, j) => j !== i));

  async function save() {
    setSaveState("saving");
    setErr(null);
    try {
      const d = await savePeopleIndicators(periods);
      setPeriods(d.periods);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
      setSaveState("idle");
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setErr(null);
    try {
      await savePeopleIndicators(periods); // analisa o que está na tela
      const r = await analyzePeople(buildCrivoContext(crivo));
      setAnalysis(r.analysis);
      setAnalysisAt(r.analysisAt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha na análise.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderTop: "3px solid var(--gold-deep)" }}>
      <div className="card__head">
        <div>
          <h3>Indicadores de RH &amp; IA Analítica</h3>
          <span className="card__sub">
            Informe seus indicadores por período; a IA cruza com os dados CRIVO e sugere — sem afirmar causalidade.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--outline-dark btn--sm" onClick={addPeriod}>+ período</button>
          <button className="btn btn--gold btn--sm" onClick={save} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Salvando…" : saveState === "done" ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
      </div>

      {err && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table cost-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Período</th>
              <th>Headcount</th>
              {PEOPLE_INDICATORS.map((d) => (
                <th key={d.key} title={d.unit}>{d.label}</th>
              ))}
              <th aria-label="remover" />
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr key={i}>
                <td><input className="cost-in" style={{ minWidth: 88 }} value={p.period} placeholder="2026-Q1" onChange={(e) => setPeriodField(i, { period: e.target.value })} /></td>
                <td><input className="cost-in cost-in--num" inputMode="decimal" value={p.headcount ?? ""} onChange={(e) => setPeriodField(i, { headcount: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                {PEOPLE_INDICATORS.map((d) => (
                  <td key={d.key}><input className="cost-in cost-in--num" inputMode="decimal" value={p.values?.[d.key] ?? ""} onChange={(e) => setVal(i, d.key, e.target.value)} /></td>
                ))}
                <td><button className="cost-del" title="Remover" onClick={() => removePeriod(i)}>✕</button></td>
              </tr>
            ))}
            {loaded && periods.length === 0 && (
              <tr><td colSpan={PEOPLE_INDICATORS.length + 3} style={{ color: "var(--ink-soft, #888)" }}>Sem períodos — clique "+ período" e informe turnover, absenteísmo, etc.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {trends.trends.some((t) => t.latest != null) && (
        <div className="dash-dist" style={{ marginTop: 14 }}>
          {trends.trends.filter((t) => t.latest != null).map((t) => (
            <span key={t.key} className="dash-dist__item" title={`Δ ${t.delta ?? "—"}`}>
              {t.label}: <strong>{t.latest}{t.unit === "%" ? "%" : ""}</strong>
              {t.direction !== "na" && t.direction !== "flat" && (
                <em style={{ marginLeft: 4, color: t.good ? "var(--green,#2f9e64)" : "#c0392b" }}>
                  {t.direction === "up" ? "▲" : "▼"}{t.deltaPct != null ? ` ${Math.abs(t.deltaPct)}%` : ""}
                </em>
              )}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong>Análise por IA</strong>
          <button className="btn btn--terra btn--sm" onClick={analyze} disabled={analyzing || periods.length === 0}>
            {analyzing ? "Analisando…" : analysis ? "Gerar novamente" : "Gerar análise"}
          </button>
        </div>
        {analysisAt && <span className="card__sub" style={{ fontSize: 11 }}>Última análise: {new Date(analysisAt).toLocaleString("pt-BR")}</span>}
        {analysis ? (
          <div style={{ marginTop: 10 }}>
            {analysis.summary && <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{analysis.summary}</p>}
            <IaList title="Alertas" items={analysis.alerts} color="#c0392b" />
            <IaList title="Hipóteses (a investigar)" items={analysis.hypotheses} color="var(--gold-deep)" />
            <IaList title="Recomendações" items={analysis.recommendations} color="var(--green,#2f9e64)" />
          </div>
        ) : (
          <p className="card__sub" style={{ marginTop: 8 }}>
            Informe ao menos um período e clique em "Gerar análise" — a IA interpreta os indicadores + o contexto CRIVO.
          </p>
        )}
        <p className="card__sub" style={{ fontSize: 11, marginTop: 10 }}>
          A IA interpreta e sugere — <strong>não afirma causalidade automática nem economia garantida</strong>. As decisões são da gestão.
        </p>
      </div>
    </div>
  );
}

function IaList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <strong style={{ fontSize: 12.5, color }}>{title}</strong>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function buildCrivoContext(c: AnalyticsData): string {
  const parts: string[] = [];
  const lastIcd = [...(c.icdEvolution ?? [])].reverse().find((x) => x.score != null);
  if (lastIcd) parts.push(`ICD oficial mais recente: ${lastIcd.score}/100 (${lastIcd.cycleName}).`);
  if (c.planSummary?.total) {
    const st = Object.entries(c.planSummary.byStatus ?? {}).map(([k, v]) => `${k}:${v}`).join(", ");
    parts.push(`Plano de ação: ${c.planSummary.total} itens (${st}).`);
  }
  if (c.pocketUsage?.totalSessions) parts.push(`Pocket CRIVO: ${c.pocketUsage.totalSessions} sessões (${c.pocketUsage.concluded} concluídas).`);
  if (c.decisionsByCategory?.length) parts.push(`Decisões registradas em ${c.decisionsByCategory.length} categorias.`);
  return parts.join(" ") || "(sem dados CRIVO agregados ainda)";
}

// ── Componentes auxiliares (sem dependências de chart libs) ──────────

function BarList({ rows }: { rows: Array<{ label: string; count: number }> }) {
  if (rows.length === 0) return <p className="dash-state" style={{ margin: 0 }}>Sem dados.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="camp-sectors" style={{ margin: 0 }}>
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <div className="bar">
            <div className="bar__fill bar__fill--mid" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </div>
          <em>{r.count}</em>
        </li>
      ))}
    </ul>
  );
}

function IcdBars({ data }: { data: AnalyticsData["icdEvolution"] }) {
  // Mini chart de barras — última coluna mais escura. Supressão fica visível
  // como barra vazia + nota textual.
  const max = 100;
  return (
    <div>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 140, padding: "8px 0" }}>
        {data.map((d, i) => {
          const isSuppressed = d.suppressed || d.score === null;
          const h = isSuppressed ? 4 : Math.max(6, ((d.score ?? 0) / max) * 100);
          const isLatest = i === data.length - 1;
          return (
            <div key={`${d.year}-${d.quarter}-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                title={isSuppressed
                  ? `${d.cycleName}: suprimido (<${MIN_LEADERS_FOR_DISCLOSURE} líderes elegíveis)`
                  : `${d.cycleName}: ICD ${d.score}/100 (${d.eligibleLeaders} líderes)`}
                style={{
                  width: "100%",
                  height: `${h}%`,
                  background: isSuppressed ? "var(--line)" : isLatest ? "var(--gold-deep)" : "var(--gold)",
                  borderRadius: "3px 3px 0 0",
                  transition: "height .3s ease",
                }}
              />
              <span style={{ fontSize: 10, color: "var(--text-sec)" }}>
                {d.cycleName}
              </span>
              <strong style={{ fontSize: 12 }}>
                {isSuppressed ? "—" : d.score}
              </strong>
            </div>
          );
        })}
      </div>
      {data.some((d) => d.suppressed) && (
        <p className="card__sub" style={{ fontSize: 11, marginTop: 8 }}>
          Ciclos marcados com "—" tinham menos de {MIN_LEADERS_FOR_DISCLOSURE} líderes elegíveis (§11).
        </p>
      )}
    </div>
  );
}
