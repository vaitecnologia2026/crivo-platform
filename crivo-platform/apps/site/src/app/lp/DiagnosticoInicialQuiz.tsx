"use client";

import { useState } from "react";
import { ScaleHelpBox } from "@crivo/ui";
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
 * Diagnóstico Inicial (pré-diagnóstico público da LP) — jornada do cliente:
 *   1) form (nome/empresa/telefone/e-mail/funcionários/segmento)
 *   2) responde as 10 perguntas
 *   3) resultado preliminar + "enviado para WhatsApp/e-mail"
 * Ao concluir, o lead é criado AUTOMATICAMENTE no CRM do Super Admin
 * (POST /api/diagnostic-lead → /public/diagnostic-lead). Não substitui o
 * CRIVO Diagnóstico™ completo.
 */

type Contact = {
  name: string;
  company: string;
  phone: string;
  email: string;
  employeesCount: string;
  segment: string;
};

const EMPLOYEE_RANGES = ["1–10", "11–50", "51–200", "201–500", "500+"];
const SEGMENTS = [
  "Indústria", "Varejo", "Saúde", "Serviços financeiros", "Tecnologia",
  "Construção / Engenharia", "Logística e transporte", "Educação",
  "Serviços", "Setor público", "Outro",
];

export function DiagnosticoInicialQuiz() {
  const [step, setStep] = useState<"form" | "quiz" | "result">("form");
  const [contact, setContact] = useState<Contact>({
    name: "", company: "", phone: "", email: "", employeesCount: "", segment: "",
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<PreDiagnosticResult | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const answeredCount = Object.keys(answers).length;
  const total = PRE_DIAGNOSTIC_QUESTIONS.length;
  const allAnswered = answeredCount === total;
  const formValid = contact.name.trim() && contact.email.trim();

  const set = (k: keyof Contact) => (v: string) => setContact((c) => ({ ...c, [k]: v }));

  function startQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setStep("quiz");
    document.getElementById("diag-resultado")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitQuiz() {
    if (!allAnswered) return;
    const payloadAnswers = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: answers[q.id] }));
    const r = computePreDiagnostic(payloadAnswers);
    setResult(r);
    setStep("result");
    document.getElementById("diag-resultado")?.scrollIntoView({ behavior: "smooth" });

    // Cria o lead AUTOMATICAMENTE no CRM do Super Admin.
    setSent("sending");
    try {
      const res = await fetch("/api/diagnostic-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          company: contact.company,
          phone: contact.phone,
          email: contact.email,
          employeesCount: contact.employeesCount,
          segment: contact.segment,
          origin: "lp-diagnostico",
          answers: payloadAnswers,
        }),
      });
      setSent(res.ok ? "ok" : "error");
    } catch {
      setSent("error");
    }
  }

  function reset() {
    setAnswers({});
    setResult(null);
    setSent("idle");
    setStep("form");
  }

  // ── PASSO 3: resultado ──
  if (step === "result" && result) {
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

        <div className="diag-sent" data-state={sent}>
          {sent === "sending" && "Enviando seu diagnóstico…"}
          {sent === "ok" && "✓ Seu diagnóstico foi enviado para seu WhatsApp ou e-mail."}
          {sent === "error" &&
            "Recebemos suas respostas. Em instantes entraremos em contato pelo seu e-mail ou WhatsApp."}
          {sent === "idle" && "Seu diagnóstico foi enviado para seu WhatsApp ou e-mail."}
        </div>

        <p className="objection">
          Resultado <strong>preliminar</strong>. Não substitui o CRIVO Diagnóstico™ completo — é uma leitura inicial dos
          riscos invisíveis que afetam liderança, cultura e resultados. Um especialista CRIVO entrará em contato.
        </p>
        <div className="hero__ctas">
          <button type="button" className="btn btn--ghost" onClick={reset}>
            Refazer
          </button>
        </div>
      </div>
    );
  }

  // ── PASSO 2: perguntas ──
  if (step === "quiz") {
    return (
      <div id="diag-resultado" className="diag-quiz">
        <div className="diag-quiz__head">
          <span className="eyebrow eyebrow--terra">Leitura preliminar · 2 min</span>
          <p className="diag-quiz__progress">{answeredCount}/{total} respondidas</p>
        </div>

        <ScaleHelpBox scale={PRE_DIAGNOSTIC_SCALE} />
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

        <button type="button" className="btn btn--terra btn--block" disabled={!allAnswered} onClick={submitQuiz}>
          {allAnswered ? "Ver meu resultado →" : `Responda todas (${answeredCount}/${total})`}
        </button>
      </div>
    );
  }

  // ── PASSO 1: formulário ──
  return (
    <form className="diag-quiz diag-form" onSubmit={startQuiz}>
      <div className="diag-quiz__head">
        <span className="eyebrow eyebrow--terra">Diagnóstico Inicial · grátis</span>
        <p className="diag-quiz__progress">Passo 1 de 2</p>
      </div>
      <p className="diag-form__lead">
        Preencha seus dados para iniciar a leitura preliminar. O resultado é enviado para seu e-mail ou WhatsApp.
      </p>

      <div className="diag-form__grid">
        <label className="diag-field diag-field--full">
          <span>Nome*</span>
          <input value={contact.name} onChange={(e) => set("name")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>Empresa</span>
          <input value={contact.company} onChange={(e) => set("company")(e.target.value)} />
        </label>
        <label className="diag-field">
          <span>Telefone / WhatsApp</span>
          <input value={contact.phone} onChange={(e) => set("phone")(e.target.value)} inputMode="tel" />
        </label>
        <label className="diag-field diag-field--full">
          <span>E-mail*</span>
          <input type="email" value={contact.email} onChange={(e) => set("email")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>Funcionários</span>
          <select value={contact.employeesCount} onChange={(e) => set("employeesCount")(e.target.value)}>
            <option value="">Selecione…</option>
            {EMPLOYEE_RANGES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label className="diag-field">
          <span>Segmento</span>
          <select value={contact.segment} onChange={(e) => set("segment")(e.target.value)}>
            <option value="">Selecione…</option>
            {SEGMENTS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
      </div>

      <button type="submit" className="btn btn--terra btn--block" disabled={!formValid}>
        Fazer diagnóstico inicial →
      </button>
    </form>
  );
}
