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
    const waMsg =
      `Olá! Sou ${contact.name || "—"}. Acabei de fazer o Diagnóstico Inicial CRIVO ` +
      `(resultado: ${result.score}/100 · ${MATURITY_LABEL[result.level]}) e gostaria de falar com a equipe.`;
    const waUrl = `https://wa.me/5511918531796?text=${encodeURIComponent(waMsg)}`;
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
          {sent === "ok" && (
            <>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "-0.15em", marginRight: 4 }}>
                <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Seu diagnóstico foi enviado para seu WhatsApp ou e-mail.
            </>
          )}
          {sent === "error" &&
            "Recebemos suas respostas. Em instantes entraremos em contato pelo seu e-mail ou WhatsApp."}
          {sent === "idle" && "Seu diagnóstico foi enviado para seu WhatsApp ou e-mail."}
        </div>

        <p className="objection">
          Resultado <strong>preliminar</strong>. Não substitui o CRIVO Diagnóstico™ completo — é uma leitura inicial dos
          riscos invisíveis que afetam liderança, cultura e resultados. Um especialista CRIVO entrará em contato.
        </p>
        <div className="diag-result-cta">
          <a href={waUrl} target="_blank" rel="noopener" className="btn btn--whats btn--block">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.25 3.75.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
            </svg>
            Falar com a Equipe CRIVO
          </a>
          <button type="button" className="diag-refazer" onClick={reset}>
            Refazer diagnóstico
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
        <div className="diag-rules">
          <span className="diag-rules__h">Como responder</span>
          <p className="diag-rules__p">Use a escala abaixo para avaliar a realidade atual da sua empresa.</p>
          <ul className="diag-rules__scale">
            {PRE_DIAGNOSTIC_SCALE.map((s) => (
              <li key={s.value} className="diag-rules__item">
                <span className="diag-rules__n">{s.value}</span>
                <span className="diag-rules__l">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
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
          <i style={{ width: `${((idx + 1) / total) * 100}%` }} />
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
