"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTION_STATUS_LABEL,
  DECISION_PRESSURE_FACTOR_LABEL,
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_MOMENT_LABEL,
  PEOPLE_CATALOG_CONFIDENCES,
  PEOPLE_CATALOG_STATUS_LABEL,
  PEOPLE_CATALOG_STATUSES,
  PEOPLE_INDICATORS,
  PEOPLE_MIN_SLICE_N,
  computePeopleTrends,
  type ActionStatus,
  type DecisionPressureFactor,
  type PeopleCatalogEntry,
  type PeopleHeadcountByArea,
  type PeopleTrend,
  type PocketMomentOfUse,
  type PeoplePeriod,
} from "@crivo/types";
import {
  getMyAnalytics,
  getPeopleCatalog,
  getPeopleIndicators,
  savePeopleCatalog,
  savePeopleIndicators,
  analyzePeople,
  type AnalyticsData,
  type PeopleAnalysis,
} from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext } from "@/lib/exports";
import { IconClose, IconDownload, IconFileText, IconPlus } from "./Icons";

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

          {/* Catálogo de indicadores — metadados de governança (fonte, fórmula,
             responsável, versão, confiança, status) + indicadores customizados.
             Nunca escreve em score metodológico (validado no backend). */}
          <PeopleCatalogCard />
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
  const [areaEditor, setAreaEditor] = useState<number | null>(null); // índice do período em edição de headcountByArea
  const exportCtx = useExportContext();

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

  function exportSheets() {
    const kpiRows = trends.trends.filter((t) => t.latest != null).map((t) => ({
      Indicador: t.label, Valor: t.latest, Unidade: t.unit,
      "Δ vs período anterior": t.delta ?? "—", "Δ%": t.deltaPct ?? "—",
    }));
    const seriesRows = [...periods].sort((a, b) => a.period.localeCompare(b.period)).map((p) => ({
      Período: p.period, Turnover: p.values?.turnover ?? "—", Absenteísmo: p.values?.absenteismo ?? "—",
    }));
    return { kpiRows, seriesRows };
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx || periods.length === 0}
            onClick={() => { if (!exportCtx) return; const { kpiRows, seriesRows } = exportSheets(); exportXLSX("crivo-people-analytics", [{ name: "Indicadores destaque", rows: kpiRows }, { name: "Turnover e absenteísmo", rows: seriesRows }], exportCtx); }}
          >
            <IconDownload size={14} /> XLSX
          </button>
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx || periods.length === 0}
            onClick={() => { if (!exportCtx) return; const { kpiRows } = exportSheets(); exportPDF("crivo-people-analytics", "People Analytics · Indicadores", [{ heading: "Indicadores destaque", rows: kpiRows }], exportCtx); }}
          >
            <IconFileText size={14} /> PDF
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={addPeriod}>+ período</button>
          <button className="btn btn--gold btn--sm" onClick={save} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Salvando…" : saveState === "done" ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
      </div>

      {err && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Linha de KPIs com delta (§ blueprint) — último período vs. anterior, mesmo motor computePeopleTrends. */}
      {trends.trends.some((t) => t.latest != null) && (
        <div className="kpi-grid kpi-grid--inset" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {trends.trends.filter((t) => t.latest != null).map((t) => (
            <KpiTrendCard key={t.key} trend={t} />
          ))}
        </div>
      )}

      {/* Série mensal turnover/absenteísmo — SVG simples, sem lib de gráfico. */}
      {periods.length > 1 && <TurnoverAbsenteismoChart periods={periods} />}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table cost-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Período</th>
              <th>Headcount</th>
              {PEOPLE_INDICATORS.map((d) => (
                <th key={d.key} title={d.unit}>{d.label}</th>
              ))}
              <th>Áreas</th>
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
                <td>
                  <button className="lib-act" onClick={() => setAreaEditor(i)}>
                    {p.headcountByArea?.length ? `${p.headcountByArea.length} área(s)` : "+ recorte"}
                  </button>
                </td>
                <td><button className="cost-del" title="Remover" onClick={() => removePeriod(i)}>✕</button></td>
              </tr>
            ))}
            {loaded && periods.length === 0 && (
              <tr><td colSpan={PEOPLE_INDICATORS.length + 4} style={{ color: "var(--ink-soft, #888)" }}>Sem períodos — clique "+ período" e informe turnover, absenteísmo, etc.</td></tr>
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

      {/* Headcount por área — sempre a partir do período mais recente que tiver o recorte;
         supressão n<5 (§11) aplicada aqui, no RENDER (o dado gravado pode ter qualquer n). */}
      <HeadcountByAreaCard periods={periods} />

      {areaEditor !== null && (
        <HeadcountAreaModal
          areas={periods[areaEditor]?.headcountByArea ?? []}
          onClose={() => setAreaEditor(null)}
          onSave={(areas) => { setPeriodField(areaEditor, { headcountByArea: areas.length ? areas : null }); setAreaEditor(null); }}
        />
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

// ── Fatia 6 — KPI com delta, série mensal, headcount por área, catálogo ──

/** Um card de KPI (indicador + delta vs. período anterior) — mesmo motor
 *  computePeopleTrends que a tabela já usava; só muda a apresentação. */
function KpiTrendCard({ trend: t }: { trend: PeopleTrend }) {
  const deltaClass =
    t.direction === "na" || t.direction === "flat" ? "kpi__delta--neutral" : t.good ? "kpi__delta--up" : "kpi__delta--bad";
  const deltaText =
    t.direction === "na" ? "sem período anterior"
    : t.direction === "flat" ? "estável"
    : `${t.direction === "up" ? "▲" : "▼"} ${t.deltaPct != null ? `${Math.abs(t.deltaPct)}%` : Math.abs(t.delta ?? 0)}`;
  return (
    <div className="kpi">
      <span className="kpi__label">{t.label}</span>
      <strong className="kpi__value" style={{ fontSize: 24 }}>{t.latest}{t.unit === "%" ? "%" : ""}</strong>
      <span className={`kpi__delta ${deltaClass}`}>{deltaText}</span>
    </div>
  );
}

/** Série mensal Turnover × Absenteísmo — SVG de traço simples (sem lib de gráfico).
 *  Só desenha os dois indicadores fixos do protótipo; os demais ficam na tabela. */
function TurnoverAbsenteismoChart({ periods }: { periods: PeoplePeriod[] }) {
  const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
  const turnover = sorted.map((p) => (typeof p.values?.turnover === "number" ? p.values.turnover : null));
  const absent = sorted.map((p) => (typeof p.values?.absenteismo === "number" ? p.values.absenteismo : null));
  const hasAny = turnover.some((v) => v != null) || absent.some((v) => v != null);
  if (!hasAny) return null;

  const W = 600, H = 160, PAD = 24;
  const all = [...turnover, ...absent].filter((v): v is number => v != null);
  const max = Math.max(...all, 1);
  const n = sorted.length;
  const x = (i: number) => PAD + (n > 1 ? (i * (W - 2 * PAD)) / (n - 1) : (W - 2 * PAD) / 2);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const pathOf = (vals: (number | null)[]) => {
    const pts = vals.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter((p): p is string => p != null);
    return pts.join(" ");
  };

  return (
    <div className="card" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="card__head">
        <div>
          <h3>Turnover e absenteísmo — série mensal</h3>
          <span className="card__sub">Percentuais informados por período</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <polyline points={pathOf(turnover)} fill="none" stroke="var(--gold-deep)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pathOf(absent)} fill="none" stroke="var(--azul-cobalto)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {sorted.map((p, i) => (
          <text key={p.period} x={x(i)} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--text-sec)">{p.period}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 3, background: "var(--gold-deep)", display: "inline-block", borderRadius: 2 }} /> Turnover (%)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 3, background: "var(--azul-cobalto)", display: "inline-block", borderRadius: 2 }} /> Absenteísmo (%)</span>
      </div>
    </div>
  );
}

/** Headcount por área do período mais recente que tiver o recorte preenchido —
 *  supressão n<5 (§11) aplicada aqui, no RENDER. */
function HeadcountByAreaCard({ periods }: { periods: PeoplePeriod[] }) {
  const withAreas = [...periods].sort((a, b) => b.period.localeCompare(a.period)).find((p) => p.headcountByArea?.length);
  if (!withAreas?.headcountByArea) return null;
  const areas = withAreas.headcountByArea;
  const visible = areas.filter((a) => a.n >= PEOPLE_MIN_SLICE_N);
  const suppressed = areas.length - visible.length;
  const max = Math.max(...visible.map((a) => a.n), 1);
  return (
    <div className="card" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="card__head">
        <div>
          <h3>Headcount por área</h3>
          <span className="card__sub">Período {withAreas.period} · recortes com n≥{PEOPLE_MIN_SLICE_N} (§11)</span>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>Todas as áreas informadas têm menos de {PEOPLE_MIN_SLICE_N} pessoas — suprimidas.</p>
      ) : (
        <ul className="camp-sectors" style={{ margin: 0 }}>
          {visible.map((a) => (
            <li key={a.area}>
              <span>{a.area}</span>
              <div className="bar"><div className="bar__fill bar__fill--mid" style={{ width: `${Math.round((a.n / max) * 100)}%` }} /></div>
              <em>{a.n}</em>
            </li>
          ))}
        </ul>
      )}
      {suppressed > 0 && (
        <p className="card__sub" style={{ fontSize: 11, marginTop: 10 }}>
          {suppressed} área{suppressed === 1 ? "" : "s"} suprimida{suppressed === 1 ? "" : "s"} (n&lt;{PEOPLE_MIN_SLICE_N}).
        </p>
      )}
    </div>
  );
}

/** Editor de recorte por área de um período — modal simples de linhas área/n. */
function HeadcountAreaModal({
  areas, onClose, onSave,
}: { areas: PeopleHeadcountByArea[]; onClose: () => void; onSave: (areas: PeopleHeadcountByArea[]) => void }) {
  const [rows, setRows] = useState<PeopleHeadcountByArea[]>(areas.length ? areas : [{ area: "", n: 0 }]);
  const setRow = (i: number, patch: Partial<PeopleHeadcountByArea>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Headcount por área</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body">
          <p className="card__sub" style={{ marginBottom: 10 }}>
            Recortes com menos de {PEOPLE_MIN_SLICE_N} pessoas ficam gravados, mas a tela nunca os exibe (§11).
          </p>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input className="cost-in" style={{ flex: 1 }} placeholder="Área" value={r.area} onChange={(e) => setRow(i, { area: e.target.value })} />
              <input className="cost-in cost-in--num" style={{ width: 90 }} inputMode="numeric" placeholder="n" value={r.n || ""} onChange={(e) => setRow(i, { n: Number(e.target.value) || 0 })} />
              <button className="cost-del" title="Remover" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn btn--outline-dark btn--sm" onClick={() => setRows((rs) => [...rs, { area: "", n: 0 }])}>+ área</button>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn--terra btn--sm"
            onClick={() => onSave(rows.map((r) => ({ area: r.area.trim(), n: r.n })).filter((r) => r.area && r.n >= 0))}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catálogo de indicadores (metadados de governança) ──

function PeopleCatalogCard() {
  const [entries, setEntries] = useState<PeopleCatalogEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [adding, setAdding] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      const d = await getPeopleCatalog();
      setEntries(d.entries);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  const categorias = Array.from(new Set((entries ?? []).map((e) => e.category))).sort();
  const filtered = (entries ?? []).filter(
    (e) => (filterCat === "todas" || e.category === filterCat) && (filterStatus === "todos" || e.status === filterStatus),
  );

  async function persist(next: PeopleCatalogEntry[]) {
    setSaveState("saving");
    try {
      // Só o que o tenant pode gravar entra no PUT; o servidor recusaria SCORE_METODOLOGICO.
      const payload = next.filter((e) => e.nature === "IMPORTADO");
      const d = await savePeopleCatalog(payload);
      setEntries(d.entries);
      setSaveState("idle");
    } catch {
      setSaveState("error");
    }
  }

  async function addIndicator(entry: PeopleCatalogEntry) {
    setAdding(false);
    await persist([...(entries ?? []), entry]);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <div>
          <h3>Catálogo de indicadores</h3>
          <span className="card__sub">Metadados de governança por indicador — não altera scores metodológicos (ICD/NR-1)</span>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setAdding(true)}><IconPlus size={14} /> Adicionar indicador</button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando catálogo…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar o catálogo.</div>}

      {status === "ok" && entries && entries.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <select className="cost-in" style={{ width: "auto" }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="todas">Todas as categorias</option>
              {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <select className="cost-in" style={{ width: "auto" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              {PEOPLE_CATALOG_STATUSES.map((s) => (<option key={s} value={s}>{PEOPLE_CATALOG_STATUS_LABEL[s]}</option>))}
            </select>
            {saveState === "error" && <span className="dash-state dash-state--error" style={{ padding: "4px 10px" }}>Falha ao salvar.</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Indicador</th><th>Categoria</th><th>Unidade</th><th>Fonte</th><th>Frequência</th>
                  <th>Versão</th><th>Confiança</th><th>Status</th><th>Natureza</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.key}>
                    <td>{e.name}</td>
                    <td>{e.category}</td>
                    <td>{e.unit ?? "—"}</td>
                    <td>{e.source ?? "—"}</td>
                    <td>{e.frequency ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e.version ?? "—"}</td>
                    <td>{e.confidence ?? "—"}</td>
                    <td><span className="pill pill--outline pill--sm">{PEOPLE_CATALOG_STATUS_LABEL[e.status]}</span></td>
                    <td>
                      <span className="pill pill--sm" style={e.nature === "SCORE_METODOLOGICO" ? { background: "var(--line-soft)", color: "var(--text-sec)" } : undefined}>
                        {e.nature === "SCORE_METODOLOGICO" ? "Score metodológico" : "Importado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status === "ok" && entries && entries.length === 0 && (
        <p className="dash-state">Nenhum indicador no catálogo ainda.</p>
      )}

      {adding && (
        <AddIndicatorModal existingKeys={new Set((entries ?? []).map((e) => e.key))} onClose={() => setAdding(false)} onSave={addIndicator} />
      )}
    </div>
  );
}

/** Modal "Adicionar indicador" — cria um indicador customizado (natureza sempre
 *  Importado; o servidor recusa qualquer tentativa de gravar Score metodológico
 *  ou reaproveitar a chave de um score). Grava como Rascunho. */
function AddIndicatorModal({
  existingKeys, onClose, onSave,
}: { existingKeys: Set<string>; onClose: () => void; onSave: (entry: PeopleCatalogEntry) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [period, setPeriod] = useState("");
  const [frequency, setFrequency] = useState("");
  const [owner, setOwner] = useState("");
  const [version, setVersion] = useState("v0.1");
  const [confidence, setConfidence] = useState<(typeof PEOPLE_CATALOG_CONFIDENCES)[number] | "">("MEDIA");
  const [slices, setSlices] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function slugify(s: string): string {
    return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const key = slugify(name);
    if (!key) { setErr("Informe um nome válido."); return; }
    if (existingKeys.has(key)) { setErr(`Já existe um indicador com a chave "${key}".`); return; }
    onSave({
      key, name: name.trim(), category: category.trim() || "Geral",
      formula: formula.trim() || null, unit: unit.trim() || null, source: source.trim() || null,
      period: period.trim() || null, frequency: frequency.trim() || null, owner: owner.trim() || null,
      version: version.trim() || null, confidence: confidence || null, slices: slices.trim() || null,
      status: "RASCUNHO", nature: "IMPORTADO",
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Adicionar indicador</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <form onSubmit={submit} className="modal__body prod-form">
          {err && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{err}</div>}
          <div className="prod-form__grid">
            <label className="prod-field"><span>Nome</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="prod-field"><span>Categoria</span><input required value={category} onChange={(e) => setCategory(e.target.value)} /></label>
            <label className="prod-field prod-field--full"><span>Fórmula</span><input value={formula} onChange={(e) => setFormula(e.target.value)} /></label>
            <label className="prod-field"><span>Unidade</span><input value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
            <label className="prod-field"><span>Fonte</span><input value={source} onChange={(e) => setSource(e.target.value)} /></label>
            <label className="prod-field"><span>Período</span><input value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
            <label className="prod-field"><span>Frequência</span><input value={frequency} onChange={(e) => setFrequency(e.target.value)} /></label>
            <label className="prod-field"><span>Responsável</span><input value={owner} onChange={(e) => setOwner(e.target.value)} /></label>
            <label className="prod-field"><span>Versão</span><input value={version} onChange={(e) => setVersion(e.target.value)} /></label>
            <label className="prod-field"><span>Confiança</span>
              <select value={confidence} onChange={(e) => setConfidence(e.target.value as typeof confidence)}>
                {PEOPLE_CATALOG_CONFIDENCES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </label>
            <label className="prod-field prod-field--full"><span>Recortes autorizados</span><input value={slices} onChange={(e) => setSlices(e.target.value)} placeholder="ex.: Unidade, Área (n≥5)" /></label>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--terra btn--sm"><IconPlus size={14} /> Adicionar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
