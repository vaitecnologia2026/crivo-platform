"use client";

import { useEffect, useState } from "react";
import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";
import { listActionPlans } from "@/lib/api";
import {
  ACTION_STATUS_LABEL,
  getIcdMaturityBand,
  MIN_LEADERS_FOR_DISCLOSURE,
  type ActionItemData,
  type ActionPlanData,
  type ActionStatus,
} from "@crivo/types";

/**
 * Dashboard Executivo — Análise Preliminar Portal §7.
 *
 * § HIERARQUIA: o dashboard principal representa o DIAGNÓSTICO CRIVO + PLANO
 *   DE AÇÃO; o ICD entra apenas como CAMADA COMPLEMENTAR (com supressão <5).
 *   Removido: ICD como primeiro card (§7 explícito).
 * § PRIVACIDADE: agregados; sem ranking ou identificação nominal de líderes (§11).
 * § FRASE OBRIGATÓRIA de governança visível ao final.
 */

const PORTAL_S11 =
  "O ICD do Líder é ferramenta de desenvolvimento e sustentação da liderança. Não deve ser utilizado para ranking individual, punição, promoção, avaliação de performance ou comparação nominal entre líderes.";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function scoreClass(score: number): string {
  if (score >= 80) return "is-high";
  if (score >= 60) return "is-mid";
  return "is-low";
}

/** Anexo ICD §10 — leitura executiva derivada da faixa de maturidade. */
function attention(score: number | null): { label: string; tone: "ok" | "alert" | "crit" | "na" } {
  if (score === null || Number.isNaN(score)) return { label: "Sem dados", tone: "na" };
  if (score < 50) return { label: "Crítico", tone: "crit" };
  if (score < 75) return { label: "Em atenção", tone: "alert" };
  return { label: "Em equilíbrio", tone: "ok" };
}

interface PlanStats {
  total: number;
  open: number; // sugeridas/em revisão/aprovadas/em andamento
  done: number; // concluídas
  byStatus: Partial<Record<ActionStatus, number>>;
  latest: ActionPlanData[];
}

function computePlanStats(plans: ActionPlanData[]): PlanStats {
  const byStatus: Partial<Record<ActionStatus, number>> = {};
  let open = 0;
  let done = 0;
  const items: ActionItemData[] = plans.flatMap((p) => p.items);
  for (const it of items) {
    byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
    if (it.status === "CONCLUIDA") done += 1;
    else if (it.status !== "REAVALIADA") open += 1;
  }
  return {
    total: items.length,
    open,
    done,
    byStatus,
    latest: plans.slice(0, 3),
  };
}

export function DashboardScreen() {
  const { data, status, refresh } = useIcdDashboard();
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);

  useEffect(() => {
    let alive = true;
    listActionPlans()
      .then((p) => { if (alive) setPlans(p); })
      .catch(() => { if (alive) setPlans([]); });
    return () => { alive = false; };
  }, []);

  const planStats = plans ? computePlanStats(plans) : null;

  // ICD agregado (camada complementar) — com supressão §11.
  const icdScore = status === "ok" ? data?.icdMedio ?? null : null;
  const leadersN = status === "ok" ? data?.totalLideres ?? 0 : 0;
  const icdSuppressed = leadersN > 0 && leadersN < MIN_LEADERS_FOR_DISCLOSURE;
  const icdBand = icdScore !== null ? getIcdMaturityBand(icdScore) : null;
  const orgAttention = attention(icdScore); // proxy temporário até termos Índice Geral CRIVO próprio

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Visão Executiva</h1>
          <p className="page-sub">
            Diagnóstico organizacional, plano de ação e camada complementar de coerência decisória.
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
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>Tentar novamente</button>
        </div>
      )}

      {status === "ok" && (
        <>
          {/* ─── CARDS PRINCIPAIS (Diagnóstico + Plano de Ação) ─────────── */}
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Índice Geral CRIVO</span>
              {icdScore === null ? (
                <>
                  <strong className="kpi__value">—</strong>
                  <span className="kpi__delta">
                    Pendente: aplique o Diagnóstico CRIVO para gerar o índice.
                  </span>
                </>
              ) : (
                <>
                  <strong className="kpi__value">{icdScore}<small> /100</small></strong>
                  {icdBand && <span className="pill pill--gold" style={{ marginTop: 4 }}>{icdBand.label}</span>}
                  <div className="kpi__bar" style={{ marginTop: 6 }}>
                    <div style={{ width: `${icdScore}%` }} />
                  </div>
                </>
              )}
            </div>

            <div className="kpi">
              <span className="kpi__label">Nível de Atenção Organizacional</span>
              <strong className={`kpi__value dash-attn dash-attn--${orgAttention.tone}`}>
                {orgAttention.label}
              </strong>
              <span className="kpi__delta">
                {orgAttention.tone === "crit" && "Fragilidades relevantes — ação executiva recomendada."}
                {orgAttention.tone === "alert" && "Pontos de atenção para reduzir retrabalho e desalinhamento."}
                {orgAttention.tone === "ok" && "Boa qualidade decisória e condições de implementação."}
                {orgAttention.tone === "na" && "Aplique o diagnóstico para ler o nível de atenção."}
              </span>
            </div>

            <div className="kpi">
              <span className="kpi__label">Plano de Ação & Evidências</span>
              {planStats === null ? (
                <span className="kpi__delta">Carregando…</span>
              ) : (
                <>
                  <strong className="kpi__value">
                    {planStats.open}
                    <small> aberta{planStats.open === 1 ? "" : "s"}</small>
                  </strong>
                  <span className="kpi__delta">
                    {planStats.done} concluída{planStats.done === 1 ? "" : "s"} · {planStats.total} no total
                  </span>
                </>
              )}
            </div>

            <div className="kpi">
              <span className="kpi__label">Líderes elegíveis</span>
              <strong className="kpi__value">{leadersN}</strong>
              <span className="kpi__delta">
                {icdSuppressed
                  ? `Volume mínimo: ${MIN_LEADERS_FOR_DISCLOSURE} (§11)`
                  : leadersN === 0
                    ? "Aguardando primeiras avaliações."
                    : "Ciclo em andamento."}
              </span>
            </div>
          </div>

          {/* ─── PROPRIEDADES ORGANIZACIONAIS (sumário §7) ───────────────── */}
          <div className="grid grid--2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Sustentação Organizacional</h3>
                  <span className="card__sub">Clareza, demandas, autonomia, comunicação, previsibilidade e rotina.</span>
                </div>
              </div>
              <p className="dash-state" style={{ margin: 0 }}>
                Disponível após aplicação da <strong>Campanha de Diagnóstico</strong>.
                A leitura por dimensão fica vinculada ao ciclo e respeita supressão {MIN_LEADERS_FOR_DISCLOSURE}+ por recorte.
              </p>
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Fatores Psicossociais</h3>
                  <span className="card__sub">Leitura estruturada dos riscos relacionados ao trabalho (NR-1).</span>
                </div>
              </div>
              <p className="dash-state" style={{ margin: 0 }}>
                Será habilitado quando o módulo <strong>Campanhas de Diagnóstico (NR-1)</strong> for aplicado.
              </p>
            </div>
          </div>

          {/* ─── GOVERNANÇA E PLANO DE AÇÃO ──────────────────────────────── */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card__head">
              <div>
                <h3>Governança e Plano de Ação</h3>
                <span className="card__sub">Responsáveis, prazos, status, evidências e acompanhamento.</span>
              </div>
            </div>
            {planStats === null ? (
              <p className="dash-state" style={{ margin: 0 }}>Carregando planos…</p>
            ) : planStats.total === 0 ? (
              <p className="dash-state" style={{ margin: 0 }}>
                Nenhuma ação registrada ainda. Quando uma campanha for validada, as ações sugeridas aparecem aqui.
              </p>
            ) : (
              <>
                <div className="dash-dist" style={{ marginBottom: 12 }}>
                  {(Object.entries(planStats.byStatus) as [ActionStatus, number][]).map(([s, n]) => (
                    <span key={s} className="dash-dist__item">
                      {ACTION_STATUS_LABEL[s]}: <strong>{n}</strong>
                    </span>
                  ))}
                </div>
                {planStats.latest.length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Plano</th>
                        <th>Ações</th>
                        <th>Validado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planStats.latest.map((p) => (
                        <tr key={p.id}>
                          <td>{p.title}</td>
                          <td>{p.items.length}</td>
                          <td>
                            {p.validatedAt
                              ? new Date(p.validatedAt).toLocaleDateString("pt-BR")
                              : <span className="card__sub">Pendente</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>

          {/* ─── CAMADA COMPLEMENTAR — Coerência Decisória (ICD) ─────────── */}
          <div className="card" style={{ marginTop: 16, borderTop: "3px solid var(--gold-soft)" }}>
            <div className="card__head">
              <div>
                <h3>Coerência Decisória da Liderança <span className="pill" style={{ marginLeft: 8, verticalAlign: "middle" }}>Camada complementar</span></h3>
                <span className="card__sub">
                  Indicadores AGREGADOS do Radar da Decisão / ICD. Não compõe o Índice Geral CRIVO. Não exibe ranking individual (§11).
                </span>
              </div>
            </div>

            {leadersN === 0 ? (
              <p className="dash-state" style={{ margin: 0 }}>
                Nenhuma avaliação registrada no ciclo. Quando os líderes responderem, os indicadores aparecem aqui.
              </p>
            ) : icdSuppressed ? (
              <p className="dash-state" style={{ margin: 0 }}>
                Dados insuficientes para preservar a confidencialidade (mínimo {MIN_LEADERS_FOR_DISCLOSURE} respondentes — §11).
                Atualmente {leadersN} líder{leadersN === 1 ? "" : "es"}.
              </p>
            ) : data && (
              <>
                <div className="dash-dist" style={{ marginBottom: 14 }}>
                  {Object.entries(data.distribuicaoPadrao).map(([p, n]) => (
                    <span key={p} className="dash-dist__item">
                      {PATTERN_LABEL[p] ?? p}: <strong>{n}</strong>
                    </span>
                  ))}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dimensão (modelo legado · 4 Rs)</th>
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
                <p className="card__sub" style={{ marginTop: 10 }}>
                  O <strong>novo modelo de 4 Eixos</strong> (Clareza/Critério/Alinhamento/Sustentação) entra em uso ao
                  iniciar um <strong>ciclo trimestral</strong> e registrar decisões reais.
                </p>
              </>
            )}
          </div>

          {/* ─── FRASE OBRIGATÓRIA DE GOVERNANÇA (Anexo ICD §11) ─────────── */}
          <p className="dash-privacy" role="note">
            <strong>Governança ICD · §11 — </strong>{PORTAL_S11}
          </p>
        </>
      )}
    </>
  );
}
