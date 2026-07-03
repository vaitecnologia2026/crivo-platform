"use client";

import { useEffect, useState } from "react";
import {
  computePreDiagnostic,
  scoreWithMethodology,
  MATURITY_LABEL,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  PRE_DIAGNOSTIC_DIMENSIONS,
  PRE_DIAGNOSTIC_QUESTIONS,
  PRE_DIAGNOSTIC_SCALE,
  type MethodologyConfig,
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
  cnpj: string;
  role: string;
  company: string;
  phone: string;
  email: string;
  employeesCount: string;
  segment: string;
  challenges: string[];
  challengeOther: string;
};

const EMPLOYEE_RANGES = [
  "1 a 2", "3 a 9", "10 a 29", "30 a 50", "51 a 100",
  "101 a 300", "301 a 500", "501 a 1.000", "Mais de 1.000",
];
const SEGMENTS = [
  "Indústria", "Varejo", "Saúde", "Serviços financeiros", "Tecnologia",
  "Construção / Engenharia", "Logística e transporte", "Educação",
  "Serviços", "Setor público", "Outro",
];
const CHALLENGES = [
  "Crescimento sem organização da rotina",
  "Sobrecarga, urgências e excesso de demandas",
  "Dificuldade para delegar e acompanhar responsabilidades",
  "Falta de clareza de prioridades",
  "Comunicação falha ou ruídos entre pessoas/áreas",
  "Conflitos, clima pesado ou baixa colaboração",
  "Turnover, faltas ou afastamentos",
  "Liderança despreparada para conversas difíceis",
  "Falta de plano de ação, registros ou evidências",
  "Adequação à NR-1 e fatores psicossociais",
  "Baixa produtividade, retrabalho ou perda de eficiência",
  "Preparação da empresa para uso de IA",
  "Outro",
];
const MAX_CHALLENGES = 3;

// Resultado normalizado para render (vem da metodologia ATIVA ou do fallback padrão).
type RenderResult = {
  score: number;
  levelLabel: string;
  byDimension: { slug: string; label: string; value: number }[];
  topAttentions: string[];
};

export function DiagnosticoInicialQuiz() {
  const [step, setStep] = useState<"form" | "orientacao" | "quiz" | "result">("form");
  const [contact, setContact] = useState<Contact>({
    name: "", cnpj: "", role: "", company: "", phone: "", email: "",
    employeesCount: "", segment: "", challenges: [], challengeOther: "",
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [methodology, setMethodology] = useState<MethodologyConfig | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "ok" | "captured" | "error">("idle");
  // #3/2C — perguntas vêm do produto "Pré-Diagnóstico LP" (texto editável no super admin),
  // com fallback para as perguntas padrão. Só o TEXTO muda; ids/dimensões/score seguem fixos.
  const [questions, setQuestions] = useState<typeof PRE_DIAGNOSTIC_QUESTIONS>(PRE_DIAGNOSTIC_QUESTIONS);
  useEffect(() => {
    fetch("/api/pre-diagnostic")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.questions) && d.questions.length) setQuestions(d.questions);
        if (d?.methodology) setMethodology(d.methodology as MethodologyConfig);
      })
      .catch(() => {});
  }, []);

  const total = questions.length;
  const formValid =
    contact.name.trim() && contact.role.trim() && contact.company.trim() &&
    contact.phone.trim() && contact.email.trim() &&
    contact.employeesCount.trim() && contact.segment.trim();
  const set = (k: "name" | "cnpj" | "role" | "company" | "phone" | "email" | "employeesCount" | "segment" | "challengeOther") =>
    (v: string) => setContact((c) => ({ ...c, [k]: v }));
  function toggleChallenge(c: string) {
    setContact((prev) => {
      if (prev.challenges.includes(c)) {
        return { ...prev, challenges: prev.challenges.filter((x) => x !== c) };
      }
      if (prev.challenges.length >= MAX_CHALLENGES) return prev; // máximo de 3
      return { ...prev, challenges: [...prev.challenges, c] };
    });
  }

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
    const q = questions[idx];
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
    const payloadAnswers = questions.map((q) => ({ questionId: q.id, value: todas[q.id] }));
    // Pontua pela metodologia ATIVA (Fase 1C) quando servida; senão, padrão hardcoded.
    let r: RenderResult;
    if (methodology) {
      const s = scoreWithMethodology(payloadAnswers, methodology);
      r = { score: s.score, levelLabel: s.levelLabel, byDimension: s.byDimension, topAttentions: s.topAttentions };
    } else {
      const s = computePreDiagnostic(payloadAnswers);
      r = {
        score: s.score,
        levelLabel: MATURITY_LABEL[s.level],
        byDimension: PRE_DIAGNOSTIC_DIMENSIONS.map((d) => ({
          slug: d,
          label: PRE_DIAGNOSTIC_DIMENSION_LABEL[d],
          value: s.byDimension[d],
        })),
        topAttentions: (s.topAttentions ?? [s.topAttention]) as string[],
      };
    }
    setResult(r);
    setStep("result");
    setSent("sending");
    try {
      const res = await fetch("/api/diagnostic-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          cnpj: contact.cnpj,
          role: contact.role,
          company: contact.company,
          phone: contact.phone,
          email: contact.email,
          employeesCount: contact.employeesCount,
          segment: contact.segment,
          challenges: contact.challenges,
          challengeOther: contact.challengeOther.trim() || undefined,
          origin: "lp-diagnostico",
          answers: payloadAnswers,
        }),
      });
      // Decide o sucesso pelo CORPO (body.ok), não pelo status HTTP: o BFF pode
      // responder 200 com { ok:false }. `delivered` distingue "retido no CRM"
      // de "entregue ao lead" para escolher a mensagem certa.
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
      };
      if (!res.ok || !body.ok) setSent("error");
      else setSent(body.delivered ? "ok" : "captured");
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
      `(resultado: ${result.score}/100 · ${result.levelLabel}) e gostaria de falar com a equipe.`;
    const waUrl = `https://wa.me/5511918531796?text=${encodeURIComponent(waMsg)}`;
    return (
      <div id="diag-resultado" className="diag-quiz diag-quiz--result">
        <span className="eyebrow eyebrow--terra">Relatório preliminar CRIVO</span>
        <div className="diag-quiz__score">
          <strong>{result.score}</strong>
          <small>/100</small>
          <span className="diag-quiz__level">Maturidade: {result.levelLabel}</span>
        </div>

        <ul className="diag-quiz__dims">
          {result.byDimension.map((dim) => {
            const attention = result.topAttentions.includes(dim.slug);
            return (
              <li key={dim.slug} className="diag-quiz__dim">
                <span className="diag-quiz__dim-label">
                  {dim.label}
                  {attention && <em className="diag-quiz__flag"> · ponto de atenção</em>}
                </span>
                <span className="diag-quiz__bar">
                  <span className="diag-quiz__bar-fill" style={{ width: `${dim.value}%` }} />
                </span>
                <span className="diag-quiz__dim-val">{dim.value}</span>
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
          {sent === "captured" &&
            "Recebemos suas respostas — nossa equipe entrará em contato pelo seu e-mail ou WhatsApp."}
          {sent === "error" &&
            "Não conseguimos concluir o envio agora. Tente de novo em instantes ou fale com a gente pelo botão abaixo."}
          {sent === "idle" && "Seu diagnóstico foi enviado para seu WhatsApp ou e-mail."}
        </div>

        <p className="diag-form__lead diag-encerramento">
          Obrigado por responder ao Diagnóstico Inicial CRIVO™. Seu <strong>Relatório Preliminar</strong> foi gerado e
          será enviado junto com o <strong>e-book complementar</strong>. Em breve, nossa equipe poderá entrar em contato
          para aprofundar a análise da sua empresa.
        </p>
        <p className="objection">
          Esta é uma <strong>leitura preliminar</strong> e não substitui o diagnóstico CRIVO completo — uma leitura
          inicial dos riscos invisíveis que afetam liderança, cultura e resultados.
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
    const q = questions[idx];
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
        Preencha os dados abaixo para iniciar uma leitura preliminar sobre liderança, cultura, rotina,
        fatores psicossociais e governança. Ao final, você receberá uma devolutiva inicial por e-mail ou WhatsApp.
      </p>

      <div className="diag-ebook-note">
        <span className="diag-ebook-note__cover" aria-hidden="true">
          <span className="diag-ebook-note__kicker">E-book</span>
          <strong>CRIVO™</strong>
        </span>
        <span className="diag-ebook-note__txt">
          Ao concluir, você recebe o <strong>Relatório Preliminar CRIVO™</strong> + o <strong>e-book complementar</strong>{" "}
          sobre decisão, liderança e fatores psicossociais.
        </span>
      </div>

      <div className="diag-form__grid">
        <label className="diag-field diag-field--full">
          <span>Nome*</span>
          <input value={contact.name} onChange={(e) => set("name")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>Cargo / Função*</span>
          <input value={contact.role} onChange={(e) => set("role")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>Empresa*</span>
          <input value={contact.company} onChange={(e) => set("company")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>CNPJ</span>
          <input
            value={contact.cnpj}
            onChange={(e) => set("cnpj")(e.target.value)}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
          />
        </label>
        <label className="diag-field">
          <span>Telefone / WhatsApp*</span>
          <input value={contact.phone} onChange={(e) => set("phone")(e.target.value)} inputMode="tel" required />
        </label>
        <label className="diag-field">
          <span>E-mail*</span>
          <input type="email" value={contact.email} onChange={(e) => set("email")(e.target.value)} required />
        </label>
        <label className="diag-field">
          <span>Funcionários*</span>
          <select value={contact.employeesCount} onChange={(e) => set("employeesCount")(e.target.value)} required>
            <option value="">Selecione…</option>
            {EMPLOYEE_RANGES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label className="diag-field diag-field--full">
          <span>Segmento*</span>
          <select value={contact.segment} onChange={(e) => set("segment")(e.target.value)} required>
            <option value="">Selecione…</option>
            {SEGMENTS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
      </div>

      <div className="diag-challenges">
        <span className="diag-challenges__label">
          Quais são os principais desafios da empresa atualmente?
          <em> · até {MAX_CHALLENGES}</em>
        </span>
        <div className="diag-challenges__grid">
          {CHALLENGES.map((c) => {
            const on = contact.challenges.includes(c);
            const full = !on && contact.challenges.length >= MAX_CHALLENGES;
            return (
              <button
                key={c}
                type="button"
                className={`diag-chip${on ? " is-on" : ""}`}
                aria-pressed={on}
                disabled={full}
                onClick={() => toggleChallenge(c)}
              >
                {c}
              </button>
            );
          })}
        </div>
        {contact.challenges.includes("Outro") && (
          <input
            className="diag-challenges__other"
            placeholder="Descreva brevemente"
            maxLength={160}
            value={contact.challengeOther}
            onChange={(e) => set("challengeOther")(e.target.value)}
          />
        )}
      </div>

      <button type="submit" className="btn btn--terra btn--block" disabled={!formValid}>
        Avançar →
      </button>
    </form>
  );
}
