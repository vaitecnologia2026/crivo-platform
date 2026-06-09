"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

interface Question {
  id: number;
  dimension: string;
  text: string;
  inverse: boolean;
}
interface Leader {
  id: string;
  name: string;
  role: string;
}
interface IcdResult {
  score: number;
  dimensions: Record<string, number>;
  dominantPattern: string;
}

const LIKERT = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
];

export function QuestionarioScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  const [leaderId, setLeaderId] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<IcdResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [qs, ls] = await Promise.all([
          apiFetch<Question[]>("/icd/questions"),
          apiFetch<Leader[]>("/icd/leaders"),
        ]);
        if (alive) {
          setQuestions(qs);
          setLeaders(ls);
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const canSubmit = Boolean(leaderId) && allAnswered && submitState !== "submitting";

  async function submit() {
    if (!canSubmit) return;
    setSubmitState("submitting");
    try {
      const r = await apiFetch<IcdResult>("/icd/assessments", {
        method: "POST",
        body: JSON.stringify({
          leaderId,
          answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
        }),
      });
      setResult(r);
      setSubmitState("done");
    } catch {
      setSubmitState("error");
    }
  }

  function reset() {
    setAnswers({});
    setLeaderId("");
    setResult(null);
    setSubmitState("idle");
  }

  if (status === "loading") return <p className="dash-state">Carregando questionário…</p>;
  if (status === "error")
    return <div className="dash-state dash-state--error">Não foi possível carregar o questionário.</div>;

  // Resultado após submissão.
  if (submitState === "done" && result) {
    return (
      <div className="card card--feature q-result">
        <span className="card__eyebrow">AVALIAÇÃO REGISTRADA</span>
        <strong className="big-num">
          {result.score}
          <small>/100</small>
        </strong>
        <span className="card__hint">
          Padrão dominante: <strong>{PATTERN_LABEL[result.dominantPattern] ?? result.dominantPattern}</strong>
        </span>
        <div className="q-result__dims">
          {Object.entries(result.dimensions).map(([k, v]) => (
            <span key={k} className="dash-dist__item">
              {DIMENSION_LABEL[k] ?? k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
        <p className="card__hint">O score já aparece no Dashboard e no ranking de ICD.</p>
        <button className="btn btn--gold btn--sm" onClick={reset}>
          Nova aplicação
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Aplicação do ICD</h1>
          <p className="page-sub">Avalie o estado decisório de um líder · {answeredCount}/{questions.length} respondidas.</p>
        </div>
        <div className="route__actions">
          <select
            className="kb-stage"
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            aria-label="Selecione o líder avaliado"
          >
            <option value="">Selecione o líder…</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="q-list">
        {questions.map((q, i) => (
          <div className="card q-item" key={q.id}>
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
        <button className="btn btn--gold btn--block" onClick={submit} disabled={!canSubmit}>
          {submitState === "submitting"
            ? "Calculando ICD…"
            : !leaderId
              ? "Selecione um líder"
              : !allAnswered
                ? `Responda todas (${answeredCount}/${questions.length})`
                : "Calcular e registrar ICD →"}
        </button>
      </div>
    </>
  );
}
