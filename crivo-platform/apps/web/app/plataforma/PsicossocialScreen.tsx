"use client";

import { useEffect, useState } from "react";
import {
  getPsychosocialResults,
  type PsychosocialResults,
  listActionPlans,
} from "@/lib/api";
import {
  PSYCHOSOCIAL_DIMENSION_LABEL,
  PSYCHOSOCIAL_RISK_LABEL,
  type PsychosocialDimension,
  type PsychosocialRiskLevel,
  classifyTechnicalRisk,
  RISK_LEVELS_3,
  type RiskLevel3,
  type ActionPlanData,
  PSYCHOSOCIAL_PROBABILITY_LABEL,
  PSYCHOSOCIAL_SEVERITY_LABEL,
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  PSYCHOSOCIAL_RISK_CLASS_ACTION,
  type PsychosocialProfileRow,
  type PsychosocialRiskClass,
  type PsychosocialRiskMatrixRow,
 } from "@crivo/types";

/**
 * Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO).
 * Duas abas: "Responder" (anônimo, qualquer colaborador) e "Resultados" (RH/gestão,
 * agregado por setor com supressão §14). É distinto do ICD (líder) e do
 * Pré-Diagnóstico (maturidade). v1 — instrumento revisável com o cliente.
 */
const RISK_COLOR: Record<PsychosocialRiskLevel, string> = {
  BAIXO: "var(--green, #2f9e64)",
  MODERADO: "var(--gold-deep, #C4894A)",
  ALTO: "#d98324",
  CRITICO: "#c0392b",
};

// Fase 1C — a metodologia ATIVA pode trazer rótulos/códigos próprios; helpers caem
// no padrão se vier um código/slug desconhecido (nunca quebram a tela).
const riskColor = (lvl: string | undefined) =>
  RISK_COLOR[lvl as PsychosocialRiskLevel] ?? "var(--ink-soft, #8a8174)";
const dimLabel = (src: unknown, k: string) =>
  (src as { dimensionLabels?: Record<string, string> }).dimensionLabels?.[k] ??
  PSYCHOSOCIAL_DIMENSION_LABEL[k as PsychosocialDimension] ??
  k;
const riskLabel = (src: unknown) => {
  const s = src as { level?: string; levelLabel?: string };
  return s.levelLabel ?? PSYCHOSOCIAL_RISK_LABEL[s.level as PsychosocialRiskLevel] ?? s.level ?? "—";
};

/**
 * Diagnóstico Organizacional (NR-1) no portal: LEITURA dos resultados.
 *
 * Regra do produto: no Organizacional a coleta acontece SEMPRE dentro de uma
 * campanha — pelo convite ao colaborador (link nominal, uma resposta por ciclo)
 * ou pelo link da campanha. Por isso saíram daqui a aba "Responder" (quem
 * responderia era o usuário logado, em geral o RH ou o dono) e o link aberto da
 * empresa, que coletava fora de qualquer ciclo e não entrava na adesão.
 * Preencher direto pelo painel é do Diagnóstico ESSENCIAL, na tela dele.
 */
export function PsicossocialScreen() {
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Questionário Psicossocial</h1>
          <p className="page-sub">
            Diagnóstico organizacional amplo por colaborador (anônimo) — percepção de fatores
            psicossociais, agregada por setor. Confidencial (§14): recortes com menos de 5
            respostas não são exibidos. A coleta acontece <strong>dentro de uma campanha</strong>:
            convide pela tela <strong>Colaboradores</strong> ou use o link da campanha em{" "}
            <strong>Campanhas de Diagnóstico</strong>.
          </p>
        </div>
      </div>

      <Resultados />
    </>
  );
}

// A aba "Responder" e o painel do link aberto saíram: no Organizacional a coleta
// acontece dentro de uma campanha (convite ao colaborador ou link da campanha).

function Resultados() {
  const [data, setData] = useState<PsychosocialResults | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "forbidden" | "ok">("loading");

  useEffect(() => {
    getPsychosocialResults()
      .then((d) => {
        setData(d);
        setStatus("ok");
      })
      .catch((e: Error) => {
        setStatus(/permiss|403|forbidden/i.test(e.message) ? "forbidden" : "error");
      });
  }, []);

  if (status === "loading") return <p className="dash-state">Carregando resultados…</p>;
  if (status === "forbidden")
    return (
      <div className="dash-state">Apenas RH e gestão podem ver os resultados agregados.</div>
    );

  return <ResultadosBody data={data} status={status} />;
}

function ResultadosBody({
  data,
  status,
}: {
  data: PsychosocialResults | null;
  status: "loading" | "error" | "forbidden" | "ok";
}) {
  if (status === "error" || !data)
    return <div className="dash-state dash-state--error">Não foi possível carregar os resultados.</div>;

  if (data.totalRespondents === 0)
    return (
      <>
        <div className="dash-state">
          Ainda não há respostas. Compartilhe o questionário com os colaboradores na aba “Responder”.
        </div>
        {/* A matriz técnica vem do PLANO (independe do questionário); o heatmap
            mostra seu estado vazio honesto — mockup 22/07. */}
        <SectorHeatmap data={data} />
        <TechnicalRiskMatrix />
      </>
    );

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi" style={{ gridColumn: "span 2" }}>
          <span className="kpi__label">Proteção psicossocial geral</span>
          {data.overall.suppressed ? (
            <>
              <strong className="kpi__value" style={{ fontSize: 24 }}>—</strong>
              <span className="kpi__delta">
                Supresso · menos de {data.minRespondents} respostas
              </span>
            </>
          ) : (
            <>
              <strong className="kpi__value" style={{ color: riskColor(data.overall.level) }}>
                {data.overall.score}
                <small style={{ fontSize: 16 }}>/100</small>
              </strong>
              <span className="kpi__delta">
                {riskLabel(data.overall)} · {data.totalRespondents} respostas ·
                maior risco: {PSYCHOSOCIAL_DIMENSION_LABEL[data.overall.topRisk]}
              </span>
            </>
          )}
        </div>
        <div className="kpi">
          <span className="kpi__label">Respostas</span>
          <strong className="kpi__value" style={{ fontSize: 28 }}>{data.totalRespondents}</strong>
          <span className="kpi__delta">anônimas, agregadas por setor</span>
        </div>
      </div>

      {!data.overall.suppressed && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card__head">
            <div>
              <h3>Proteção por dimensão (geral)</h3>
              <span className="card__sub">0–100 · maior = menor risco</span>
            </div>
          </div>
          <div className="bars">
            {(Object.entries(data.overall.byDimension) as [PsychosocialDimension, number][]).map(
              ([k, v]) => (
                <div className="bar-row" key={k}>
                  <span className="bar-row__label">{dimLabel(data.overall, k)}</span>
                  <div className="bar">
                    <div
                      className="bar__fill"
                      style={{ width: `${v}%`, background: (data.overall as { dimensionBands?: Record<string, { color: string | null }> }).dimensionBands?.[k]?.color ?? RISK_COLOR[levelOf(v)] }}
                    />
                  </div>
                  <span className="bar-row__value">{v}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {!data.overall.suppressed && <RiskMatrix rows={data.overall.riskMatrix} />}
      {!data.overall.suppressed && <GroupProfile rows={data.overall.profile} />}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card__head">
          <div>
            <h3>Por setor</h3>
            <span className="card__sub">
              Recortes com menos de {data.minRespondents} respostas são omitidos (§14)
            </span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Setor</th>
              <th>Respostas</th>
              <th>Proteção</th>
              <th>Nível</th>
              <th>Maior risco</th>
            </tr>
          </thead>
          <tbody>
            {data.sectors.map((s) => (
              <tr key={s.sector}>
                <td>{s.sector}</td>
                <td>{s.respondents}</td>
                {s.suppressed ? (
                  <td colSpan={3} style={{ color: "var(--ink-soft, #888)" }}>
                    confidencial (menos de {data.minRespondents})
                  </td>
                ) : (
                  <>
                    <td>
                      <strong style={{ color: riskColor(s.level) }}>{s.score}</strong>
                    </td>
                    <td style={{ color: riskColor(s.level) }}>
                      {riskLabel(s)}
                    </td>
                    <td>{dimLabel(s, s.topRisk ?? "")}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mockup 22/07 — detalhe NR-1: heatmap + matriz técnica. */}
      <SectorHeatmap data={data} />
      <TechnicalRiskMatrix />
    </>
  );
}


/** Mockup 22/07 (/diagnosticos/nr1): HEATMAP Setor × Dimensão com dado REAL do
 *  diagnóstico e a mesma supressão de anonimato dos recortes (§14). */
function SectorHeatmap({ data }: { data: PsychosocialResults }) {
  const dims = Object.keys(PSYCHOSOCIAL_DIMENSION_LABEL) as PsychosocialDimension[];
  const visible = data.sectors.filter((s) => !s.suppressed && s.byDimension);
  if (!visible.length) {
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card__head"><h3>Heatmap por setor e dimensão</h3></div>
        <p className="dash-state">
          O heatmap aparece quando ao menos um setor atinge o mínimo de {data.minRespondents}{" "}
          respostas (proteção de anonimato).
        </p>
      </div>
    );
  }
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card__head">
        <div>
          <h3>Heatmap por setor e dimensão</h3>
          <span className="card__sub">Score 0–100 por recorte; célula colorida pela faixa de risco.</span>
        </div>
      </div>
      <div className="heatmap-wrap">
        <table className="heatmap">
          <thead>
            <tr>
              <th>Setor</th>
              {dims.map((d) => (<th key={d}>{PSYCHOSOCIAL_DIMENSION_LABEL[d]}</th>))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.sector}>
                <td>{s.sector} <em>({s.respondents})</em></td>
                {dims.map((d) => {
                  const v = s.byDimension?.[d];
                  if (v == null) return <td key={d} className="hm hm--na">—</td>;
                  const lvl = levelOf(v);
                  return <td key={d} className={`hm hm--${lvl.toLowerCase()}`} title={`${PSYCHOSOCIAL_DIMENSION_LABEL[d]}: ${v}`}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Cor da classificação — do verde (aceitável) ao vermelho (intolerável). */
const RISK_CLASS_COLOR: Record<PsychosocialRiskClass, string> = {
  BAIXO: "#2E7D4F",
  MODERADO: "#8A6D1F",
  ALTO: "#C4671D",
  MUITO_ALTO: "#B3541E",
  CRITICO: "#8E2F1B",
};

/**
 * MATRIZ DE RISCO psicossocial — o resultado que o método prevê: para cada
 * ESCALA, combina a exposição crítica do grupo (Probabilidade, do percentual de
 * respondentes na faixa crítica) com a gravidade plausível (Severidade,
 * parametrizada no Motor) → Risco = P × S, de 1 a 25.
 *
 * Derivada das RESPOSTAS, nunca digitada. É outra coisa da "Matriz de fatores de
 * risco (classificação técnica)" logo abaixo, que vem do Plano de Evolução e usa
 * 3 níveis preenchidos à mão — as duas convivem de propósito.
 *
 * Ausente quando a metodologia ativa não tem faixas ou nenhuma escala tem
 * severidade parametrizada: nesse caso não há matriz a mostrar, e inventar um
 * valor daria uma leitura falsa de "aceitável".
 */
function RiskMatrix({ rows }: { rows?: PsychosocialRiskMatrixRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card__head">
        <div>
          <h3>Matriz de Risco psicossocial</h3>
          <span className="card__sub">
            Risco = Probabilidade × Severidade (1 a 25), conforme o subitem 1.5.4.4.2 da NR-1. A
            probabilidade vem da exposição média das respostas vinculadas ao risco (exposição = 6 −
            resposta); a severidade é fixa por fator. Recurso de apoio à gestão — não é diagnóstico
            clínico individual.
          </span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fator</th>
              <th>Exposição média</th>
              <th>Probabilidade</th>
              <th>Severidade</th>
              <th>Risco</th>
              <th>Classificação</th>
              <th>Ação recomendada</th>
              <th>Plano de ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td><strong>{r.label}</strong></td>
                <td className="cell-mute" title={`${r.highExposureCount} resposta(s) em exposição alta (1 ou 2)`}>
                  {r.exposureAvg.toFixed(2).replace(".", ",")}
                </td>
                <td title={PSYCHOSOCIAL_PROBABILITY_LABEL[r.probability]}>{r.probability}</td>
                <td title={PSYCHOSOCIAL_SEVERITY_LABEL[r.severity]}>{r.severity}</td>
                <td><strong>{r.risk}</strong></td>
                <td>
                  <span
                    className="pattern-tag"
                    style={{ background: `${RISK_CLASS_COLOR[r.riskClass]}1F`, color: RISK_CLASS_COLOR[r.riskClass] }}
                  >
                    {PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass]}
                  </span>
                </td>
                <td className="cell-mute">{r.actionLabel ?? PSYCHOSOCIAL_RISK_CLASS_ACTION[r.riskClass]}</td>
                <td className="cell-mute">
                  {r.planRequired ? <strong>Obrigatório</strong> : "Não obrigatório"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * PERFIL DE GRUPO — quantas PESSOAS caem em cada faixa, dimensão a dimensão.
 * Complementa a média: duas dimensões com a mesma média podem ter distribuições
 * muito diferentes, e é a concentração na faixa crítica que move a matriz.
 */
function GroupProfile({ rows }: { rows?: PsychosocialProfileRow[] }) {
  if (!rows || rows.length === 0) return null;
  const bands = rows[0].byBand;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card__head">
        <div>
          <h3>Perfil de grupo</h3>
          <span className="card__sub">
            Distribuição das pessoas por faixa, em cada dimensão. A primeira faixa é a crítica —
            é dela que sai a probabilidade da matriz acima.
          </span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Dimensão</th>
              {bands.map((b) => <th key={b.code}>{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td><strong>{r.label}</strong></td>
                {r.byBand.map((b) => (
                  <td key={b.code}>
                    {b.percent}% <span className="cell-mute">({b.count})</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Mockup 22/07: matriz técnica dos fatores (Prob. × Sev. → Nível), a MESMA do
 *  dossiê (doc 09 §6) — risco derivado, nunca digitado. Fonte: Plano de Evolução. */
function TechnicalRiskMatrix() {
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  useEffect(() => { listActionPlans().then(setPlans).catch(() => setPlans([])); }, []);
  const items = (plans ?? []).flatMap((p) => p.items);
  const rows = items.map((i, n) => {
    const sev = i.severity as RiskLevel3 | null;
    const prob = i.probability as RiskLevel3 | null;
    const ok = sev && prob && RISK_LEVELS_3.includes(sev) && RISK_LEVELS_3.includes(prob);
    return {
      id: `FP-${String(n + 1).padStart(3, "0")}`,
      fator: i.point,
      grupo: i.exposedGroup ?? "—",
      prob: prob ?? "—",
      sev: sev ?? "—",
      nivel: ok ? classifyTechnicalRisk(prob!, sev!) : (i.riskLevel ? "manual" : "—"),
    };
  });
  if (!plans) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card__head">
        <div>
          <h3>Matriz de fatores de risco (classificação técnica)</h3>
          <span className="card__sub">
            Nível derivado de Severidade × Probabilidade (doc 09 §6) — separado do índice do
            questionário. Editável no Plano de Evolução.
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="dash-state">Nenhum fator registrado no Plano de Evolução ainda.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Fator</th><th>Grupo exposto</th><th>Prob.</th><th>Sev.</th><th>Nível</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="cell-code">{r.id}</td>
                <td><strong>{r.fator}</strong></td>
                <td>{r.grupo}</td>
                <td>{r.prob}</td>
                <td>{r.sev}</td>
                <td>
                  {r.nivel === "manual"
                    ? <span className="risk-pill risk-pill--legacy">manual</span>
                    : r.nivel === "—" ? <span className="cell-na">—</span>
                    : <span className={`risk-pill risk-pill--${r.nivel === "Alto" ? "alto" : r.nivel === "Moderado" ? "moderado" : "baixo"}`}>{r.nivel}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function levelOf(v: number): PsychosocialRiskLevel {
  return v >= 75 ? "BAIXO" : v >= 55 ? "MODERADO" : v >= 35 ? "ALTO" : "CRITICO";
}
