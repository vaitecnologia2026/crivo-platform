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
 * Diagnóstico Inicial (pré-diagnóstico público da LP) — experiência guiada:
 *   1) form (nome/empresa/telefone/e-mail/funcionários/segmento)
 *   2) tela de orientação (regras + escala 1–5 via ScaleHelpBox compartilhado)
 *   3) UMA pergunta por vez — clicou no número, avança de forma fluida
 *   4) resultado preliminar + "enviado para WhatsApp/e-mail"
 * Ao concluir, o lead é criado AUTOMATICAMENTE no CRM (POST /api/diagnostic-lead).
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
  const [step, setStep] = useState<"form" | "orientacao" | "quiz" | "result">("form");
  const [contact, setContact] = useState<Contact>({
    name: "", company: "", phone: "", email: "", employeesCount: "", segment: "",
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<PreDiagnosticResult | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const total = PRE_DIAGNOSTIC_QUESTIONS.length;
  const formValid = contact.name.trim() && contact.email.trim();
  const set = (k: keyof Contact) => (v: string) => setContact((c) => ({ ...c, [k]: v }));

  function startOrientacao(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setStep("orientacao");
  }

  function startQuiz() {
    setIdx(0);
    setStep("quiz");
  }

  function responder(value: number) {
    if (locked) return;
    const q = PRE_DIAGNOSTIC_QUESTIONS[idx];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    setLocked(true);
    // pequena pausa para o "flash" da seleção antes de deslizar para a próxima
    window.setTimeout(() => {
      if (idx < total - 1) {
        setIdx(idx + 1);
        setLocked(false);
      } else {
        finalizar(next);
      }
    }, 260);
  }

  function voltar() {
    if (idx > 0) {
      setIdx(idx - 1);
      setLocked(false);
    }
  }

  async function finalizar(todas: Record<number, number>) {
    const payloadAnswers = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: todas[q.id] }));
    const r = computePreDiagnostic(payloadAnswers);
    setResult(r);
    setStep("result");
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
    setIdx(0);
    setLocked(false);
    setResult(null);
    setSent("idle");
    setStep("form");
  }

  // ── RESULTADO ──
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

  // ── ORIENTAÇÃO ──
  if (step === "orientacao") {
    return (
      <div className="diag-quiz diag-orient">
        <span className="eyebrow eyebrow--terra">Diagnóstico Inicial · grátis</span>
        <h3 className="diag-orient__title">Vamos começar.</h3>
        <p className="diag-orient__intro">
          Você vai responder agora, de forma muito prática, <strong>10 perguntas</strong> que vão gerar o seu primeiro
          diagnóstico.
        </p>
        <ScaleHelpBox scale={PRE_DIAGNOSTIC_SCALE} />
        <button type="button" className="btn btn--terra btn--block" onClick={startQuiz}>
          Avançar →
        </button>
      </div>
    );
  }

  // ── PERGUNTAS (uma de cada vez) ──
  if (step === "quiz") {
    const q = PRE_DIAGNOSTIC_QUESTIONS[idx];
    const selected = answers[q.id];
    return (
      <div className="diag-quiz diag-quiz--single">
        <div className="diag-quiz__head">
          <span className="eyebrow eyebrow--terra">Pergunta {idx + 1} de {total}</span>
          {idx > 0 && (
            <button type="button" className="diag-quiz__back" onClick={voltar}>
              ← Voltar
            </button>
          )}
        </div>
        <div className="diag-progress" aria-hidden="true">
          <i style={{ width: `${(idx / total) * 100}%` }} />
        </div>

        <div className="diag-single" key={idx}>
          <p className="diag-single__q">{q.text}</p>
          <div className="diag-single__scale" role="radiogroup" aria-label={q.text}>
            {PRE_DIAGNOSTIC_SCALE.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected === opt.value}
                title={opt.label}
                className={`diag-single__opt${selected === opt.value ? " is-selected" : ""}`}
                onClick={() => responder(opt.value)}
              >
                {opt.value}
              </button>
            ))}
          </div>
          {/* observação sobre a avaliação dos números — sempre embaixo */}
          <ul className="diag-single__legend" aria-hidden="true">
            {PRE_DIAGNOSTIC_SCALE.map((s) => (
              <li key={s.value}>
                <b>{s.value}</b> {s.label}
              </li>
            ))}
          </ul>
          <p className="diag-single__hint">Clique no número para avançar.</p>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO (dados) ──
  return (
    <form className="diag-quiz diag-form" onSubmit={startOrientacao}>
      <div className="diag-quiz__head">
        <span className="eyebrow eyebrow--terra">Diagnóstico Inicial · grátis</span>
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
        Avançar →
      </button>
    </form>
  );
}
