"use client";

import { useEffect, useState } from "react";
import {
  getPsychosocialQuestions,
  submitPsychosocial,
  getPsychosocialResults,
  getPsychosocialLink,
  ensurePsychosocialLink,
  type PsychosocialResults,
} from "@/lib/api";
import {
  PSYCHOSOCIAL_DIMENSION_LABEL,
  PSYCHOSOCIAL_RISK_LABEL,
  type PsychosocialQuestion,
  type PsychosocialResult,
  type PsychosocialDimension,
  type PsychosocialRiskLevel,
} from "@crivo/types";
import { ScaleHelpBox } from "@crivo/ui";
import { publicOrigin } from "@/lib/share-url";
import { IconCheck } from "./Icons";

/**
 * Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO).
 * Duas abas: "Responder" (anônimo, qualquer colaborador) e "Resultados" (RH/gestão,
 * agregado por setor com supressão §14). É distinto do ICD (líder) e do
 * Pré-Diagnóstico (maturidade). v1 — instrumento revisável com o cliente.
 */
const LIKERT = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
];

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

export function PsicossocialScreen() {
  const [tab, setTab] = useState<"responder" | "resultados">("responder");
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Questionário Psicossocial</h1>
          <p className="page-sub">
            Diagnóstico organizacional amplo por colaborador (anônimo) — percepção de fatores
            psicossociais, agregada por setor. Confidencial (§14): recortes com menos de 5
            respostas não são exibidos.
          </p>
        </div>
        <div className="route__actions">
          <div className="seg">
            <button
              className={`seg__btn ${tab === "responder" ? "is-active" : ""}`}
              onClick={() => setTab("responder")}
            >
              Responder
            </button>
            <button
              className={`seg__btn ${tab === "resultados" ? "is-active" : ""}`}
              onClick={() => setTab("resultados")}
            >
              Resultados
            </button>
          </div>
        </div>
      </div>

      {tab === "responder" ? <Responder /> : <Resultados />}
    </>
  );
}

// ───────────────────────── Responder (anônimo) ─────────────────────────
function Responder() {
  const [questions, setQuestions] = useState<PsychosocialQuestion[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [sector, setSector] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<PsychosocialResult | null>(null);

  useEffect(() => {
    getPsychosocialQuestions()
      .then((qs) => {
        setQuestions(qs);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  async function submit() {
    if (!allAnswered) return;
    setSubmitState("submitting");
    try {
      const res = await submitPsychosocial({
        sector: sector.trim() || undefined,
        answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      });
      setResult(res.result);
      setSubmitState("done");
    } catch {
      setSubmitState("error");
    }
  }

  function reset() {
    setAnswers({});
    setResult(null);
    setSubmitState("idle");
  }

  if (status === "loading") return <p className="dash-state">Carregando questionário…</p>;
  if (status === "error")
    return <div className="dash-state dash-state--error">Não foi possível carregar o questionário.</div>;

  if (submitState === "done" && result) {
    return (
      <div className="card card--feature q-result">
        <span className="card__eyebrow">RESPOSTA REGISTRADA · ANÔNIMA</span>
        <strong className="big-num" style={{ color: riskColor(result.level) }}>
          {result.score}
          <small>/100</small>
        </strong>
        <span className="card__hint">
          Proteção psicossocial percebida ·{" "}
          <strong style={{ color: riskColor(result.level) }}>
            {riskLabel(result)}
          </strong>
        </span>
        <div className="q-result__dims">
          {(Object.entries(result.byDimension) as [PsychosocialDimension, number][]).map(([k, v]) => (
            <span key={k} className="dash-dist__item">
              {dimLabel(result, k)}: <strong>{v}</strong>
            </span>
          ))}
        </div>
        <p className="card__hint">
          Sua resposta é anônima — nenhum dado pessoal é guardado. Ela só aparece de forma agregada
          (a partir de 5 respostas por recorte).
        </p>
        <button className="btn btn--gold btn--sm" onClick={reset}>
          Nova resposta
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="prod-field prod-field--full">
          <span>Setor / Área (opcional)</span>
          <input
            type="text"
            placeholder="Ex.: Operações, Comercial, Administrativo…"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            maxLength={120}
          />
        </label>
        <p className="card__sub" style={{ marginTop: 8, fontSize: 12 }}>
          O setor ajuda a localizar onde o risco se concentra — sem identificar pessoas.
        </p>
      </div>

      <ScaleHelpBox
        scale={LIKERT}
        hint="Avalie o quanto você concorda com cada afirmação sobre o seu trabalho."
      />
      <div className="q-list">
        {questions.map((q, i) => (
          <div className="card q-item" key={q.id} id={`pq-${q.id}`}>
            <p className="q-item__text">
              <span className="q-item__num">{i + 1}.</span> {q.text}
            </p>
            <div className="q-likert">
              {LIKERT.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`q-opt ${answers[q.id] === opt.value ? "is-selected" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                  title={opt.label}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="q-submit">
        {submitState === "error" && (
          <span className="dash-state--error">Falha ao enviar. Tente novamente.</span>
        )}
        <button
          className="btn btn--gold btn--block"
          onClick={submit}
          disabled={submitState === "submitting"}
        >
          {submitState === "submitting"
            ? "Registrando…"
            : !allAnswered
              ? `Responda todas (${answeredCount}/${questions.length})`
              : "Enviar resposta anônima →"}
        </button>
      </div>
    </>
  );
}

// ───────────────────────── Resultados (RH/gestão) ─────────────────────────
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

  return (
    <>
      <LinkPanel />
      <ResultadosBody data={data} status={status} />
    </>
  );
}

// Painel de geração/cópia do link público anônimo (Briefing §6).
function LinkPanel() {
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPsychosocialLink()
      .then((r) => setSlug(r.slug))
      .catch(() => setSlug(null))
      .finally(() => setLoading(false));
  }, []);

  const url = slug ? `${publicOrigin()}/q/${slug}` : "";

  async function generate() {
    setGenerating(true);
    try {
      const r = await ensurePsychosocialLink();
      setSlug(r.slug);
    } finally {
      setGenerating(false);
    }
  }
  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card__head">
        <div>
          <h3>Link público anônimo</h3>
          <span className="card__sub">
            Compartilhe com os colaboradores (e‑mail, mural, QR Code). Eles respondem sem login.
          </span>
        </div>
      </div>
      {loading ? (
        <p className="card__sub">Carregando…</p>
      ) : slug ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 13,
              background: "var(--surface,#fff)",
            }}
          />
          <button className="btn btn--gold btn--sm" onClick={copy}>
            {copied ? <>Copiado <IconCheck size={13} /></> : "Copiar"}
          </button>
          <a className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      ) : (
        <button className="btn btn--gold btn--sm" onClick={generate} disabled={generating}>
          {generating ? "Gerando…" : "Gerar link público"}
        </button>
      )}
    </div>
  );
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
      <div className="dash-state">
        Ainda não há respostas. Compartilhe o questionário com os colaboradores na aba “Responder”.
      </div>
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
                      style={{ width: `${v}%`, background: RISK_COLOR[levelOf(v)] }}
                    />
                  </div>
                  <span className="bar-row__value">{v}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

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
    </>
  );
}

function levelOf(v: number): PsychosocialRiskLevel {
  return v >= 75 ? "BAIXO" : v >= 55 ? "MODERADO" : v >= 35 ? "ALTO" : "CRITICO";
}
