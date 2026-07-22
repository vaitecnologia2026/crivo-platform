"use client";

import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function barClass(v: number): string {
  if (v >= 80) return "is-high";
  if (v >= 60) return "is-mid";
  return "is-low";
}

export function IcdScreen() {
  const { data, status, refresh } = useIcdDashboard();

  // Média agregada por dimensão (vinda do servidor — sem dados individuais).
  function dimensionAverages(): { key: string; label: string; value: number }[] {
    if (!data) return [];
    return DIMENSIONS.map((key) => ({
      key,
      label: DIMENSION_LABEL[key] ?? key,
      value: data.dimensionAverages?.[key] ?? 0,
    }));
  }

  // Tensão dominante mais frequente entre os líderes.
  function topPattern(): string | null {
    if (!data) return null;
    const entries = Object.entries(data.distribuicaoPadrao);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  const dims = dimensionAverages();
  const pattern = topPattern();

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Índice de Coerência Decisória</h1>
          <p className="page-sub">A coerência decisória da liderança sob pressão — nos 4 Eixos.</p>
          <p className="page-sub" style={{ marginTop: 4, fontSize: 12.5 }}>
            Visão exclusivamente agregada — nenhuma métrica ou resposta individual de líder é
            exibida no portal da empresa.
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
          Não foi possível carregar os indicadores.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && (data.icdMedio === null || data.totalLideres === 0) && (
        <div className="dash-state">Nenhuma avaliação registrada ainda neste ciclo.</div>
      )}

      {status === "ok" && data && data.icdMedio !== null && dims.length > 0 && (
        <div className="grid grid--2">
          <div className="card">
            <div className="card__head">
              <div>
                <h3>Coerência por dimensão</h3>
                <span className="card__sub">Média da liderança nos 4 Eixos do ICD</span>
              </div>
            </div>
            <div className="icd-dims">
              {dims.map((d) => (
                <div className="icd-dim" key={d.key}>
                  <div className="icd-dim__top">
                    <span>{d.label}</span>
                    <strong>{d.value}</strong>
                  </div>
                  <div className="icd-dim__bar">
                    <div className={`icd-dim__fill ${barClass(d.value)}`} style={{ width: `${d.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="icd-side">
            <div className="card card--feature">
              <span className="card__eyebrow">ICD MÉDIO</span>
              <strong className="big-num">
                {data.icdMedio}
                <small>/100</small>
              </strong>
              <span className="card__hint">
                Média agregada de {data.totalLideres} líderes — sem identificação individual.
              </span>
              <div className="kpi__bar">
                <div style={{ width: `${data.icdMedio}%` }} />
              </div>
            </div>

            <div className="card card--pattern">
              <span className="card__eyebrow">TENSÃO DOMINANTE</span>
              <strong className="pattern-label">{pattern ? (PATTERN_LABEL[pattern] ?? pattern) : "—"}</strong>
              <span className="card__hint">O driver que mais governa as decisões da liderança hoje.</span>
            </div>

            <div className="card">
              <h4>Distribuição de padrões</h4>
              <div className="dash-dist">
                {Object.entries(data.distribuicaoPadrao).map(([p, n]) => (
                  <span key={p} className="dash-dist__item">
                    {PATTERN_LABEL[p] ?? p}: <strong>{n}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
