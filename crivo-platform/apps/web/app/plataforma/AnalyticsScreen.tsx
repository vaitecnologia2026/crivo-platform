"use client";

import { useEffect, useState } from "react";
import {
  ACTION_STATUS_LABEL,
  DECISION_PRESSURE_FACTOR_LABEL,
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_MOMENT_LABEL,
  type ActionStatus,
  type DecisionPressureFactor,
  type PocketMomentOfUse,
} from "@crivo/types";
import { getMyAnalytics, type AnalyticsData } from "@/lib/api";

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

          {/* Indicadores importados — placeholder honesto */}
          <div className="card" style={{ marginBottom: 16, borderTop: "3px solid var(--gold-soft)" }}>
            <div className="card__head">
              <div>
                <h3>Indicadores Importados <span className="pill" style={{ marginLeft: 8, verticalAlign: "middle" }}>Em breve</span></h3>
                <span className="card__sub">
                  Cruzamentos com turnover, absenteísmo, clima e custos invisíveis — entram quando esses indicadores
                  forem conectados via Super Admin (importação CSV / integração HR).
                </span>
              </div>
            </div>
            <p className="dash-state" style={{ margin: 0 }}>
              <strong>Não inventamos números.</strong> Quando a empresa conectar suas fontes de dados,
              o sistema cruza com o ICD, fatores psicossociais e plano de ação automaticamente.
            </p>
          </div>
        </>
      )}
    </>
  );
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
