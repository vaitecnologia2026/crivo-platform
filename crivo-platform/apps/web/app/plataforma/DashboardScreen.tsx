"use client";

import { useIcdDashboard, PATTERN_LABEL } from "./useIcdDashboard";

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

      {status === "ok" && data && (data.icdMedio === null || data.ranking.length === 0) && (
        <div className="dash-state">
          Nenhuma avaliação registrada ainda. Assim que os líderes responderem ao ICD, os indicadores
          aparecem aqui.
        </div>
      )}

      {status === "ok" && data && data.icdMedio !== null && data.ranking.length > 0 && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">ICD Geral</span>
              <strong className="kpi__value">{data.icdMedio}</strong>
              <span className="kpi__delta">média dos líderes avaliados</span>
              <div className="kpi__bar">
                <div style={{ width: `${data.icdMedio}%` }} />
              </div>
            </div>
            <div className="kpi">
              <span className="kpi__label">Líderes avaliados</span>
              <strong className="kpi__value">{data.totalLideres ?? data.ranking.length}</strong>
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
                <h3>Ranking de líderes — ICD</h3>
                <span className="card__sub">Último score por líder, do maior ao menor</span>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Líder</th>
                  <th>ICD</th>
                  <th>Tensão dominante</th>
                  <th>Reatividade</th>
                  <th>Rigidez</th>
                  <th>Repercussão</th>
                  <th>Risco</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r) => (
                  <tr key={r.leaderId}>
                    <td>{r.nome}</td>
                    <td>
                      <strong className={`dash-score ${scoreClass(r.score)}`}>{r.score}</strong>
                    </td>
                    <td>{PATTERN_LABEL[r.padraoDominante] ?? r.padraoDominante}</td>
                    <td>{r.dimensoes?.reatividade ?? "—"}</td>
                    <td>{r.dimensoes?.rigidez ?? "—"}</td>
                    <td>{r.dimensoes?.repercussao ?? "—"}</td>
                    <td>{r.dimensoes?.risco ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
