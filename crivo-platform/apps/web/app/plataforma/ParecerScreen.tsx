"use client";

import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function barClass(v: number): string {
  if (v >= 80) return "is-high";
  if (v >= 60) return "is-mid";
  return "is-low";
}

/**
 * Parecer Consultivo CRIVO (Portal §6). Mostra a diferença da CRIVO: indicadores
 * CONSOLIDADOS (automáticos, agregados — sem dados individuais) + a leitura
 * HUMANA de um especialista. O parecer não é gerado por IA nem promete
 * conformidade automática: trabalha com sinais, hipóteses, prioridades e
 * recomendações. A redação do parecer entra quando houver o módulo de autoria.
 */
export function ParecerScreen() {
  const { data, status, refresh } = useIcdDashboard();

  const temaCritico = (() => {
    if (!data) return null;
    const entries = Object.entries(data.distribuicaoPadrao).filter(([k]) => k !== "EQUILIBRADO");
    if (!entries.length) return "EQUILIBRADO";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  })();

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Parecer Consultivo CRIVO</h1>
          <p className="page-sub">Os dados são automáticos. A leitura final é de um especialista — não de um algoritmo.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando indicadores consolidados…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar os indicadores.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && (
        <>
          {/* Fluxo: dados consolidados → análise do consultor → parecer entregue */}
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">1 · Dados consolidados</span>
              <strong className="kpi__value">✓</strong>
              <span className="kpi__delta">{data.totalAvaliacoes} respostas · {data.totalLideres} líderes</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">2 · Análise do consultor</span>
              <strong className="kpi__value">●</strong>
              <span className="kpi__delta">leitura humana especializada — em curso</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">3 · Parecer entregue</span>
              <strong className="kpi__value">—</strong>
              <span className="kpi__delta">previsto após a devolutiva</span>
            </div>
          </div>

          <div className="grid grid--2">
            {/* Indicadores consolidados (agregados — sem dados individuais) */}
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Indicadores consolidados</h3>
                  <span className="card__sub">Gerados pela plataforma — base para o parecer humano</span>
                </div>
              </div>
              <div className="kpi-grid">
                <div className="kpi">
                  <span className="kpi__label">Índice Geral CRIVO</span>
                  <strong className="kpi__value">{data.icdMedio ?? "—"}</strong>
                  <span className="kpi__delta">leitura agregada da liderança</span>
                </div>
                <div className="kpi">
                  <span className="kpi__label">Tema crítico predominante</span>
                  <strong className="kpi__value" style={{ fontSize: "20px" }}>
                    {temaCritico ? (PATTERN_LABEL[temaCritico] ?? temaCritico) : "—"}
                  </strong>
                  <span className="kpi__delta">tensão dominante nos 4 Rs</span>
                </div>
              </div>
              <div className="icd-dims" style={{ marginTop: "16px" }}>
                {DIMENSIONS.map((d) => {
                  const v = data.dimensionAverages?.[d] ?? 0;
                  return (
                    <div className="icd-dim" key={d}>
                      <div className="icd-dim__top">
                        <span>{DIMENSION_LABEL[d] ?? d}</span>
                        <strong>{v}</strong>
                      </div>
                      <div className="icd-dim__bar">
                        <div className={`icd-dim__fill ${barClass(v)}`} style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parecer do especialista (camada humana) */}
            <div className="card card--feature">
              <span className="card__eyebrow">PARECER DO ESPECIALISTA</span>
              <p className="card__hint" style={{ marginTop: "8px" }}>
                A leitura final é humana: trabalha com <strong>sinais, hipóteses, prioridades e recomendações</strong> —
                sem causalidade absoluta e sem prometer conformidade automática.
              </p>
              <p className="card__hint">
                O consultor consolida os indicadores acima, cruza com o contexto da empresa e entrega o parecer com a
                devolutiva.
              </p>
              <div className="hero__ctas" style={{ marginTop: "16px" }}>
                <button className="btn btn--terra btn--sm" disabled title="Disponível após a entrega do parecer">
                  Baixar parecer (em breve)
                </button>
                <button className="btn btn--outline-dark btn--sm" disabled title="Agendamento em breve">
                  Agendar devolutiva
                </button>
              </div>
              <p className="card__hint" style={{ marginTop: "12px", opacity: 0.8 }}>
                A redação e o agendamento do parecer entram em uma próxima entrega (módulo de autoria do consultor).
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
