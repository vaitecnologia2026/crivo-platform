"use client";

import { useState } from "react";
import {
  computePreDiagnostic,
  MATURITY_LABEL,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  PRE_DIAGNOSTIC_DIMENSIONS,
  PRE_DIAGNOSTIC_QUESTIONS,
  PRE_DIAGNOSTIC_SCALE,
  type PreDiagnosticResult,
} from "@crivo/types";

/**
 * Quiz do Diagnóstico Inicial (pré-diagnóstico público da LP). Leitura
 * preliminar de MATURIDADE em 5 dimensões — distinto do ICD. Calcula no
 * cliente (computePreDiagnostic) e exibe o resultado; o lead é captado no
 * formulário logo abaixo (#leadForm). Não substitui o CRIVO Diagnóstico™.
 */
export function DiagnosticoInicialQuiz() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<PreDiagnosticResult | null>(null);

  const answeredCount = Object.keys(answers).length;
  const total = PRE_DIAGNOSTIC_QUESTIONS.length;
  const allAnswered = answeredCount === total;

  function submit() {
    if (!allAnswered) return;
    setResult(
      computePreDiagnostic(
        PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      ),
    );
    if (typeof document !== "undefined") {
      document.getElementById("diag-resultado")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function reset() {
    setAnswers({});
    setResult(null);
  }

  if (result) {
    return (
      <div id="diag-resultado" className="diag-quiz diag-quiz--result">
        <span className="eyebrow eyebrow--terra">Relatório preliminar CRIVO</span>
        <div className="diag-quiz__score">
          <strong>{result.score}</strong>
          <small>/100</small>
          <span className="diag-quiz__level">Maturidade: {MATURITY_LABEL[result.level]}</span>
        </div>

        <ul className="diag-quiz__dims">
          {PRE_DIAGNOSTIC_DIMENSIONS.map((d) => {
            const v = result.byDimension[d];
            const attention = d === result.topAttention;
            return (
              <li key={d} className="diag-quiz__dim">
                <span className="diag-quiz__dim-label">
                  {PRE_DIAGNOSTIC_DIMENSION_LABEL[d]}
                  {attention && <em className="diag-quiz__flag"> · ponto de atenção</em>}
                </span>
                <span className="diag-quiz__bar">
                  <span className="diag-quiz__bar-fill" style={{ width: `${v}%` }} />
                </span>
                <span className="diag-quiz__dim-val">{v}</span>
              </li>
            );
          })}
        </ul>

        <p className="objection">
          Resultado <strong>preliminar</strong>. Não substitui o CRIVO Diagnóstico™ completo — é uma leitura inicial dos
          riscos invisíveis que afetam liderança, cultura e resultados.
        </p>
        <div className="hero__ctas">
          <a href="#leadForm" className="btn btn--terra">
            Receber o relatório por e-mail
          </a>
          <button type="button" className="btn btn--ghost" onClick={reset}>
            Refazer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="diag-quiz">
      <div className="diag-quiz__head">
        <span className="eyebrow eyebrow--terra">Leitura preliminar · 2 min</span>
        <p className="diag-quiz__progress">
          {answeredCount}/{total} respondidas
        </p>
      </div>

      <ol className="diag-quiz__questions">
        {PRE_DIAGNOSTIC_QUESTIONS.map((q) => (
          <li key={q.id} className="diag-quiz__q">
            <p className="diag-quiz__q-text">{q.text}</p>
            <div className="diag-quiz__scale" role="radiogroup" aria-label={q.text}>
              {PRE_DIAGNOSTIC_SCALE.map((opt) => {
                const selected = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={opt.label}
                    className={`diag-quiz__opt${selected ? " is-selected" : ""}`}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                  >
                    {opt.value}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn--terra btn--block" disabled={!allAnswered} onClick={submit}>
        {allAnswered ? "Ver meu resultado →" : `Responda todas (${answeredCount}/${total})`}
      </button>
    </div>
  );
}
