"use client";

import { useEffect, useState } from "react";
import {
  getPublicPsychosocial,
  submitPublicPsychosocial,
} from "@/lib/api";
import {
  PSYCHOSOCIAL_DIMENSION_LABEL,
  PSYCHOSOCIAL_RISK_LABEL,
  type PsychosocialQuestion,
  type PsychosocialResult,
  type PsychosocialDimension,
  type PsychosocialRiskLevel,
} from "@crivo/types";
import s from "./public.module.css";
import { ScaleHelpBox } from "@crivo/ui";

const RISK_COLOR: Record<PsychosocialRiskLevel, string> = {
  BAIXO: "#2f9e64",
  MODERADO: "#c4894a",
  ALTO: "#d98324",
  CRITICO: "#c0392b",
};

function Brand() {
  return (
    <div className={s.brand}>
      <svg viewBox="0 0 48 44" fill="none" aria-hidden="true">
        <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
        <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <b>CRIVO</b>
        <span>Decision Intelligence</span>
      </span>
    </div>
  );
}

export function PublicPsychosocialForm({ slug }: { slug: string }) {
  const [tenantName, setTenantName] = useState("");
  const [questions, setQuestions] = useState<PsychosocialQuestion[]>([]);
  const [status, setStatus] = useState<"loading" | "invalid" | "ok">("loading");
  const [sector, setSector] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<PsychosocialResult | null>(null);

  useEffect(() => {
    getPublicPsychosocial(slug)
      .then((d) => {
        setTenantName(d.tenantName);
        setQuestions(d.questions);
        setStatus("ok");
      })
      .catch(() => setStatus("invalid"));
  }, [slug]);

  const answered = questions.filter((q) => answers[q.id]).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  async function submit() {
    if (!allAnswered) return;
    setSubmitState("submitting");
    try {
      const res = await submitPublicPsychosocial(slug, {
        sector: sector.trim() || undefined,
        answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      });
      setResult(res.result);
      setSubmitState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitState("error");
    }
  }

  if (status === "loading")
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <p className={s.state}>Carregando questionário…</p>
        </div>
      </div>
    );

  if (status === "invalid")
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <Brand />
          <p className={s.state}>Link inválido ou expirado. Confirme o endereço com a sua empresa.</p>
        </div>
      </div>
    );

  if (submitState === "done" && result)
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <Brand />
          <div className={s.result}>
            <span className={s.pill}>Resposta registrada · anônima</span>
            <div className={s.bignum} style={{ color: RISK_COLOR[result.level] }}>
              {result.score}
              <small>/100</small>
            </div>
            <p className={s.sub} style={{ marginTop: 6 }}>
              Proteção psicossocial percebida ·{" "}
              <strong style={{ color: RISK_COLOR[result.level] }}>
                {PSYCHOSOCIAL_RISK_LABEL[result.level]}
              </strong>
            </p>
            <div className={s.dims}>
              {(Object.entries(result.byDimension) as [PsychosocialDimension, number][]).map(
                ([k, v]) => (
                  <span className={s.dim} key={k}>
                    {PSYCHOSOCIAL_DIMENSION_LABEL[k]}: <strong>{v}</strong>
                  </span>
                ),
              )}
            </div>
            <p className={s.sub} style={{ marginTop: 16, fontSize: 12.5 }}>
              Obrigado por participar. Sua resposta é <strong>anônima</strong> — nenhum dado pessoal é
              guardado e os resultados só aparecem de forma agregada (a partir de 5 respostas).
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <Brand />
        <span className={s.pill}>Questionário Psicossocial</span>
        <h1 className={s.title}>{tenantName}</h1>
        <p className={s.sub}>
          Sua percepção sobre o ambiente de trabalho ajuda a empresa a cuidar de riscos psicossociais
          (NR-1). São 12 afirmações — responda de 1 (discordo totalmente) a 5 (concordo totalmente).
        </p>
        <p className={s.note}>
          🔒 <strong>Anônimo.</strong> Não pedimos seu nome e não guardamos nada que te identifique.
          Os resultados são vistos pela empresa apenas de forma <strong>agregada</strong>.
        </p>

        <div className={s.field}>
          <label htmlFor="setor">Setor / Área (opcional)</label>
          <input
            id="setor"
            type="text"
            placeholder="Ex.: Operações, Comercial, Administrativo…"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            maxLength={120}
          />
        </div>

        <ScaleHelpBox
          scale={[
            { value: 1, label: "Discordo totalmente" },
            { value: 2, label: "Discordo" },
            { value: 3, label: "Neutro" },
            { value: 4, label: "Concordo" },
            { value: 5, label: "Concordo totalmente" },
          ]}
          hint="Avalie o quanto você concorda com cada afirmação. Suas respostas são anônimas."
        />
        {questions.map((q, i) => (
          <div className={s.q} key={q.id}>
            <p className={s.qtext}>
              <span className={s.qnum}>{i + 1}.</span>
              {q.text}
            </p>
            <div className={s.likert}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${s.opt} ${answers[q.id] === v ? s.optSel : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  aria-pressed={answers[q.id] === v}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className={s.scale}>
              <span>Discordo</span>
              <span>Concordo</span>
            </div>
          </div>
        ))}

        {submitState === "error" && (
          <p className={s.err}>Falha ao enviar. Verifique a conexão e tente novamente.</p>
        )}
        <button
          className={s.submit}
          onClick={submit}
          disabled={submitState === "submitting" || !allAnswered}
        >
          {submitState === "submitting"
            ? "Enviando…"
            : !allAnswered
              ? `Responda todas (${answered}/${questions.length})`
              : "Enviar resposta anônima"}
        </button>
      </div>
    </div>
  );
}
