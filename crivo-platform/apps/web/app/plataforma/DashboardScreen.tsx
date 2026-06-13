"use client";

import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

// Confidencialidade (Portal §5): cortes só com volume mínimo de respondentes.
const MIN_RESPONDENTES = 5;
const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function scoreClass(score: number): string {
  if (score >= 80) return "is-high";
  if (score >= 60) return "is-mid";
  return "is-low";
}

export function DashboardScreen() {
  const { data, status, refresh } = useIcdDashboard();

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Visão Executiva</h1>
          <p className="page-sub">
            Coerência decisória e saúde de liderança da sua organização — dados do ciclo atual.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando indicadores…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o dashboard.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && (data.icdMedio === null || data.totalLideres === 0) && (
        <div className="dash-state">
          Nenhuma avaliação registrada ainda. Assim que os líderes responderem ao ICD, os indicadores
          aparecem aqui.
        </div>
      )}

      {status === "ok" && data && data.icdMedio !== null && data.totalLideres > 0 && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Índice Geral CRIVO</span>
              <strong className="kpi__value">{data.icdMedio}</strong>
              <span className="kpi__delta">coerência decisória média da liderança</span>
              <div className="kpi__bar">
                <div style={{ width: `${data.icdMedio}%` }} />
              </div>
            </div>
            <div className="kpi">
              <span className="kpi__label">Líderes avaliados</span>
              <strong className="kpi__value">{data.totalLideres}</strong>
              <span className="kpi__delta">no ciclo atual</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Avaliações</span>
              <strong className="kpi__value">{data.totalAvaliacoes}</strong>
              <span className="kpi__delta">respostas computadas</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Tensões dominantes</span>
              <div className="dash-dist">
                {Object.entries(data.distribuicaoPadrao).map(([p, n]) => (
                  <span key={p} className="dash-dist__item">
                    {PATTERN_LABEL[p] ?? p}: <strong>{n}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <h3>Coerência decisória da liderança — agregada</h3>
                <span className="card__sub">Média por dimensão (4 Rs). Sem identificação individual de líderes.</span>
              </div>
            </div>
            {data.totalLideres < MIN_RESPONDENTES ? (
              <p className="dash-state">
                Dados insuficientes para preservar a confidencialidade (mínimo de {MIN_RESPONDENTES} respondentes).
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dimensão (R)</th>
                    <th>Coerência média</th>
                  </tr>
                </thead>
                <tbody>
                  {DIMENSIONS.map((d) => (
                    <tr key={d}>
                      <td>{DIMENSION_LABEL[d] ?? d}</td>
                      <td>
                        <strong className={`dash-score ${scoreClass(data.dimensionAverages?.[d] ?? 0)}`}>
                          {data.dimensionAverages?.[d] ?? 0}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
