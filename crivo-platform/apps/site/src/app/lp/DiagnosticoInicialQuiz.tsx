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
// Temas da tela 17 (CRIVO_TELAS_FINAIS · formulário Gerar MAPA) — texto exato.
const CHALLENGES = [
  "Crescimento com rotina",
  "Sobrecarga e excesso de urgências",
  "Delegação e responsabilidades",
  "Priorização e foco",
  "Comunicação entre áreas",
  "Colaboração e conflitos",
  "Turnover e afastamentos",
  "Conversas difíceis",
  "Plano de ação, prazos e evidências",
  "Acompanhamento e execução",
  "NR-1 e fatores psicossociais",
  "Retrabalho e produtividade",
  "Preparação para IA",
  "Outro desafio relevante",
];
const MAX_CHALLENGES = 3;

// Tela 17: cada tema tem um pequeno ícone de traço (nunca emoji).
const CH_STROKE = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const CHALLENGE_ICONS: Record<string, React.ReactNode> = {
  "Crescimento com rotina": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V9M9 19V4M14 19v-7M19 19v-4M3 21h18" {...CH_STROKE} /></svg>
  ),
  "Sobrecarga e excesso de urgências": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" {...CH_STROKE} /><path d="M12 10v3l2 2M9 3h6M19 6l1.5-1.5" {...CH_STROKE} /></svg>
  ),
  "Delegação e responsabilidades": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="6" r="2.4" {...CH_STROKE} /><circle cx="5.5" cy="17" r="2.4" {...CH_STROKE} /><circle cx="18.5" cy="17" r="2.4" {...CH_STROKE} /><path d="M12 8.5v3m0 0-4.5 3.2M12 11.5l4.5 3.2" {...CH_STROKE} /></svg>
  ),
  "Priorização e foco": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" {...CH_STROKE} /><circle cx="12" cy="12" r="4" {...CH_STROKE} /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
  ),
  "Comunicação entre áreas": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" {...CH_STROKE} /></svg>
  ),
  "Colaboração e conflitos": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="9" r="2.6" {...CH_STROKE} /><circle cx="16" cy="9" r="2.6" {...CH_STROKE} /><path d="M3.5 19c.6-2.8 2.4-4.3 4.5-4.3S11.9 16.2 12.5 19M11.5 19c.6-2.8 2.4-4.3 4.5-4.3s3.9 1.5 4.5 4.3" {...CH_STROKE} /></svg>
  ),
  "Turnover e afastamentos": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="8" r="3" {...CH_STROKE} /><path d="M4 20c.8-3.4 3.1-5.2 6-5.2 1 0 2 .2 2.8.7M16 15l4 4m0-4-4 4" {...CH_STROKE} /></svg>
  ),
  "Conversas difíceis": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" {...CH_STROKE} /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
  ),
  "Plano de ação, prazos e evidências": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" {...CH_STROKE} /><path d="M9 9h6M9 13h6M9 17h3" {...CH_STROKE} /></svg>
  ),
  "Acompanhamento e execução": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2" {...CH_STROKE} /><path d="m8.5 11.5 2.2 2.2 4.8-4.9M12 18v3" {...CH_STROKE} /></svg>
  ),
  "NR-1 e fatores psicossociais": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" {...CH_STROKE} /><path d="m9 11.5 2.2 2.2L15.5 9.5" {...CH_STROKE} /></svg>
  ),
  "Retrabalho e produtividade": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" {...CH_STROKE} /><path d="M19 12a7 7 0 0 0-.5-2.6l1.7-1.3-2-3.4-2 .8A7 7 0 0 0 14 4.3L13.7 2h-3.4L10 4.3a7 7 0 0 0-2.2 1.2l-2-.8-2 3.4 1.7 1.3A7 7 0 0 0 5 12c0 .9.2 1.8.5 2.6l-1.7 1.3 2 3.4 2-.8c.7.5 1.4.9 2.2 1.2l.3 2.3h3.4l.3-2.3a7 7 0 0 0 2.2-1.2l2 .8 2-3.4-1.7-1.3c.3-.8.5-1.7.5-2.6z" {...CH_STROKE} /></svg>
  ),
  "Preparação para IA": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="7" width="12" height="11" rx="2.5" {...CH_STROKE} /><path d="M12 4v3M9.5 12h.01M14.5 12h.01M9 15.2c.9.7 2 1 3 1s2.1-.3 3-1" {...CH_STROKE} /><path d="M3.5 12v3M20.5 12v3" {...CH_STROKE} /></svg>
  ),
  "Outro desafio relevante": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /></svg>
  ),
};

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
    // Validação leve: telefone com DDD (10–13 dígitos) e CNPJ, se informado, com 14.
    const phoneDigits = contact.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      alert("Confira o telefone com DDD (ex.: (47) 99999-9999).");
      return;
    }
    const cnpjDigits = contact.cnpj.replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 14) {
      alert("Confira o CNPJ (14 dígitos) ou deixe o campo em branco.");
      return;
    }
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
        <span className="eyebrow eyebrow--terra">MAPA Executivo CRIVO™ · Leitura inicial sem custo</span>
        <h3 className="diag-orient__title">Vamos começar.</h3>
        <p className="diag-orient__intro">
          Você vai responder agora, de forma muito prática, <strong>10 perguntas</strong> que vão gerar o seu MAPA
          Executivo.
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

  // ── FORMULÁRIO (dados) — tela 17: 2 colunas (narrativa+livro | dados) ──
  return (
    <form className="diag-quiz diag-form diag-2col" onSubmit={startOrientacao}>
      <div className="diag-2col__left">
        <div className="diag-quiz__head">
          <span className="eyebrow eyebrow--terra">MAPA Executivo CRIVO™ · Leitura inicial sem custo</span>
        </div>
        <h3 className="diag-form__title">
          Uma leitura executiva para <span className="terra-text">decisões mais claras</span> e liderança com
          impacto.
        </h3>
        <p className="diag-form__lead">
          Preencha os dados da empresa e, na próxima etapa, responda ao MAPA Executivo CRIVO™. Ao final, você
          receberá uma leitura preliminar sobre liderança, cultura, rotina, fatores psicossociais, governança e
          preparação para IA, por e-mail ou WhatsApp.
        </p>

        <div className="diag-ebook-note">
          <span className="diag-ebook-note__cover" aria-hidden="true">
            <span className="diag-ebook-note__kicker">E-book</span>
            <strong>CRIVO™</strong>
          </span>
          <span className="diag-ebook-note__txt">
            <strong>Relatório Preliminar + E-book CRIVO™</strong> — ao concluir o MAPA, você recebe uma leitura
            inicial da maturidade da empresa e um e-book complementar sobre decisão, liderança, cultura, rotina,
            fatores psicossociais e evidências.
          </span>
        </div>

        <img className="diag-skyline" src="/imagens/mapa-skyline.jpg" alt="" aria-hidden="true" loading="lazy" />
      </div>

      <div className="diag-2col__right">
        <div className="diag-dados-head">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div>
            <strong>Dados da empresa</strong>
            <span>Essas informações serão utilizadas para geração do relatório preliminar e devolutiva.</span>
          </div>
        </div>

        <div className="diag-form__grid">
          <label className="diag-field diag-field--full">
            <span>Nome*</span>
            <input value={contact.name} onChange={(e) => set("name")(e.target.value)} required />
          </label>
          <label className="diag-field diag-field--third">
            <span>Cargo / Função*</span>
            <input value={contact.role} onChange={(e) => set("role")(e.target.value)} required />
          </label>
          <label className="diag-field diag-field--third">
            <span>Empresa*</span>
            <input value={contact.company} onChange={(e) => set("company")(e.target.value)} required />
          </label>
          <label className="diag-field diag-field--third">
            <span>CNPJ</span>
            <input
              value={contact.cnpj}
              onChange={(e) => set("cnpj")(e.target.value)}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
            />
          </label>
          <label className="diag-field diag-field--half">
            <span>Telefone / WhatsApp*</span>
            <input value={contact.phone} onChange={(e) => set("phone")(e.target.value)} inputMode="tel" required />
          </label>
          <label className="diag-field diag-field--half">
            <span>E-mail*</span>
            <input type="email" value={contact.email} onChange={(e) => set("email")(e.target.value)} required />
          </label>
          <label className="diag-field diag-field--half">
            <span>Funcionários*</span>
            <select value={contact.employeesCount} onChange={(e) => set("employeesCount")(e.target.value)} required>
              <option value="">Selecione…</option>
              {EMPLOYEE_RANGES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </label>
          <label className="diag-field diag-field--half">
            <span>Segmento*</span>
            <select value={contact.segment} onChange={(e) => set("segment")(e.target.value)} required>
              <option value="">Selecione o segmento</option>
              {SEGMENTS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
        </div>

        <div className="diag-challenges">
          <span className="diag-challenges__label">
            Quais temas pedem mais atenção na empresa atualmente?
            <em> · até {MAX_CHALLENGES} opções</em>
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
                  {CHALLENGE_ICONS[c]}
                  {c}
                </button>
              );
            })}
          </div>
          {contact.challenges.some((c) => c.startsWith("Outro")) && (
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
          Gerar MAPA Executivo →
        </button>
        <p className="diag-form__privacy">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m9 11.5 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Seus dados estão seguros. Utilizamos suas informações apenas para fins de diagnóstico e devolutiva.
        </p>
      </div>
    </form>
  );
}
