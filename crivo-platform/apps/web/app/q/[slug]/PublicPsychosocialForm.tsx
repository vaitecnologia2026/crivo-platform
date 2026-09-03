"use client";

import { useEffect, useState } from "react";
import {
  getPublicPsychosocial,
  submitPublicPsychosocial,
} from "@/lib/api";
import {
  DEFAULT_SCALE_LABELS,
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

/** Marca de "já respondi", gravada no navegador de quem respondeu.
 *
 *  NÃO é controle de identidade e não tenta ser: o link é ANÔNIMO por definição
 *  (a resposta não guarda quem respondeu), então ninguém consegue saber se duas
 *  respostas vieram da mesma pessoa. O que isto resolve é o caso real e comum —
 *  recarregar a página, voltar pelo histórico ou clicar no link duas vezes —, que
 *  hoje grava uma SEGUNDA resposta e infla o N do agregado (o piso de 5
 *  respondentes que libera o resultado pressupõe 5 PESSOAS).
 *
 *  Por isso é AVISO e não bloqueio: em computador compartilhado (chão de fábrica,
 *  recepção, tablet do RH) a próxima pessoa precisa mesmo responder ali. Quem
 *  quiser burlar, burla — para valer de verdade existe o link por colaborador
 *  (/r/<token>), que é de uso único e conferido no servidor. */
const MARCA_RESPONDIDO = (slug: string) => `crivo:respondido:${slug}`;
function jaRespondeuNesteDispositivo(slug: string): boolean {
  try {
    return !!window.localStorage.getItem(MARCA_RESPONDIDO(slug));
  } catch {
    return false; // modo privado/storage bloqueado: segue exatamente como antes
  }
}
function marcarRespondidoNesteDispositivo(slug: string): void {
  try {
    window.localStorage.setItem(MARCA_RESPONDIDO(slug), new Date().toISOString());
  } catch {
    /* sem storage não há marca — o formulário continua funcionando */
  }
}

/**
 * Formulário público do Diagnóstico Organizacional. Serve DOIS links:
 *  · /q/<slug>   — link aberto da empresa (padrão, sem props extras)
 *  · /p/c/<slug> — campanha, que injeta seu próprio par carregar/enviar
 * Uma implementação só para os dois não divergirem em pergunta, escala ou texto.
 */
export function PublicPsychosocialForm({
  slug,
  carregar = getPublicPsychosocial,
  enviar = submitPublicPsychosocial,
  // Quando a campanha já define o setor, o respondente não escolhe: some o campo
  // e o agregado por setor sai correto sem depender de quem digitou o quê.
  setorFixo = null,
  rotulo = "Questionário Psicossocial",
  contexto = null,
}: {
  slug: string;
  carregar?: (slug: string) => Promise<{
    tenantName: string;
    questions: PsychosocialQuestion[];
    /** Rótulos das 5 âncoras vindos do Motor. Ausente = escala padrão. */
    scaleLabels?: string[];
  }>;
  enviar?: (
    slug: string,
    body: { sector?: string; answers: { questionId: number; value: number }[] },
  ) => Promise<{ result: PsychosocialResult }>;
  setorFixo?: string | null;
  rotulo?: string;
  contexto?: string | null;
}) {
  const [tenantName, setTenantName] = useState("");
  const [questions, setQuestions] = useState<PsychosocialQuestion[]>([]);
  // A escala vinha CRAVADA aqui: editar "Escalas e regras" no Motor não mudava
  // nada para quem responde, e as âncoras diziam só "Discordo/Concordo".
  const [scaleLabels, setScaleLabels] = useState<string[]>([...DEFAULT_SCALE_LABELS]);
  const [status, setStatus] = useState<"loading" | "invalid" | "ok">("loading");
  const [sector, setSector] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<PsychosocialResult | null>(null);
  // Aviso (não bloqueio) de resposta repetida — ver MARCA_RESPONDIDO acima.
  const [avisoRepeticao, setAvisoRepeticao] = useState(false);
  /**
   * UMA pergunta por tela, como no MAPA Executivo: 0 = abertura (escala + setor),
   * 1..N = perguntas, N+1 = revisão e envio. Com 40 afirmações a lista única
   * virava uma rolagem longa, em que era fácil pular item sem perceber.
   */
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    setAvisoRepeticao(jaRespondeuNesteDispositivo(slug));
    carregar(slug)
      .then((d) => {
        setTenantName(d.tenantName);
        setQuestions(d.questions);
        if (d.scaleLabels?.length === 5) setScaleLabels(d.scaleLabels);
        setStatus("ok");
      })
      .catch(() => setStatus("invalid"));
  }, [slug, carregar]);

  /** Marca a resposta e avança — a última leva à revisão, não ao envio direto. */
  function escolher(questionId: number, value: number) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    // Pequena pausa: a pessoa VÊ o que escolheu antes da tela trocar.
    setTimeout(() => setPasso((atual) => Math.min(atual + 1, questions.length + 1)), 260);
  }

  const answered = questions.filter((q) => answers[q.id]).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  async function submit() {
    if (!allAnswered) return;
    setSubmitState("submitting");
    try {
      const res = await enviar(slug, {
        sector: setorFixo ?? (sector.trim() || undefined),
        answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      });
      setResult(res.result);
      setSubmitState("done");
      // Só marca depois de o servidor confirmar: falha de rede não pode fazer a
      // pessoa achar que respondeu.
      marcarRespondidoNesteDispositivo(slug);
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
            <div className={s.dimBars}>
              {(Object.entries(result.byDimension) as [PsychosocialDimension, number][]).map(
                ([k, v]) => {
                  const c = result.dimensionBands?.[k]?.color;
                  return (
                    <div className={s.dimRow} key={k}>
                      <div className={s.dimHead}>
                        <span>{PSYCHOSOCIAL_DIMENSION_LABEL[k]}</span>
                        <strong>{v}</strong>
                      </div>
                      <div className={s.bar}>
                        <i className={s.barFill} style={{ width: `${v}%`, ...(c ? { background: c } : {}) }} />
                      </div>
                    </div>
                  );
                },
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

  // Aviso de resposta repetida. Vem DEPOIS do bloco de resultado de propósito:
  // quem acabou de responder vê o próprio resultado, não o aviso.
  if (avisoRepeticao)
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <Brand />
          <span className={s.pill}>{rotulo}</span>
          <h1 className={s.title}>Você já respondeu por este dispositivo.</h1>
          <p className={s.sub}>
            Se você só recarregou a página ou voltou pelo link, não precisa fazer nada — sua
            resposta já foi registrada. Responder de novo cria uma <strong>segunda resposta</strong>{" "}
            e altera a média da sua empresa.
          </p>
          <p className={s.note}>
            Este computador é compartilhado e <strong>outra pessoa</strong> vai responder agora? Siga
            adiante.
          </p>
          <button className={s.submit} type="button" onClick={() => setAvisoRepeticao(false)}>
            Outra pessoa vai responder →
          </button>
        </div>
      </div>
    );

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <Brand />
        <span className={s.pill}>{rotulo}</span>
        <h1 className={s.title}>{tenantName}</h1>
        {contexto && <p className={s.sub} style={{ marginTop: -4, fontWeight: 600 }}>{contexto}</p>}
        <p className={s.sub}>
          Sua percepção sobre o ambiente de trabalho ajuda a empresa a cuidar de riscos psicossociais
          (NR-1). {questions.length === 1 ? "É 1 afirmação" : `São ${questions.length} afirmações`} —
          responda de 1 ({scaleLabels[0].toLowerCase()}) a 5 ({scaleLabels[4].toLowerCase()}).
        </p>
        <p className={s.note}>
          {/* Ícone de traço, não emoji de sistema: esta tela é vista por todo
              funcionário de todo cliente e carrega a identidade da CRIVO. */}
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            style={{ verticalAlign: "-2px", marginRight: 6 }}
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <strong>Anônimo.</strong> Não pedimos seu nome e não guardamos nada que te identifique.
          Os resultados são vistos pela empresa apenas de forma <strong>agregada</strong>.
        </p>

        {/* ── Abertura: escala, setor e o "Começar" ─────────────────────── */}
        {passo === 0 && (
          <>
            {!setorFixo && (
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
            )}
            <ScaleHelpBox
              scale={scaleLabels.map((label, i) => ({ value: i + 1, label }))}
              hint="Avalie o quanto você concorda com cada afirmação. Suas respostas são anônimas."
            />
            <button className={s.submit} onClick={() => setPasso(1)} disabled={questions.length === 0}>
              {answered > 0 ? "Continuar de onde parei" : "Começar"}
            </button>
          </>
        )}

        {/* ── Uma pergunta por tela ──────────────────────────────────────── */}
        {passo >= 1 && passo <= questions.length && (() => {
          const q = questions[passo - 1];
          const escolhido = answers[q.id];
          return (
            <>
              <div className={s.progress} role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={passo}>
                <i style={{ width: `${(passo / questions.length) * 100}%` }} />
              </div>
              <p className={s.stepMeta}>
                Pergunta {passo} de {questions.length}
                {answered > 0 && answered < questions.length && ` · ${answered} respondida(s)`}
              </p>
              <div className={s.q}>
                <p className={s.qtext}>{q.text}</p>
                <div className={s.likert}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`${s.opt} ${escolhido === v ? s.optSel : ""}`}
                      onClick={() => escolher(q.id, v)}
                      aria-pressed={escolhido === v}
                      title={scaleLabels[v - 1]}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className={s.scale}>
                  <span>{scaleLabels[0]}</span>
                  <span>{scaleLabels[4]}</span>
                </div>
                {/* Com uma pergunta por tela cabe dizer por extenso o que foi
                    escolhido — o número sozinho não confirma nada a quem responde. */}
                <p className={s.chosen}>{escolhido ? scaleLabels[escolhido - 1] : "Escolha uma opção de 1 a 5."}</p>
              </div>
              <div className={s.navRow}>
                <button type="button" className={s.back} onClick={() => setPasso((x) => x - 1)}>
                  ← Voltar
                </button>
                {escolhido && (
                  <button type="button" className={s.back} onClick={() => setPasso((x) => x + 1)}>
                    {passo === questions.length ? "Revisar e enviar →" : "Avançar →"}
                  </button>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Revisão e envio ────────────────────────────────────────────── */}
        {passo > questions.length && questions.length > 0 && (
          <>
            <div className={s.progress}><i style={{ width: "100%" }} /></div>
            <p className={s.stepMeta}>
              {allAnswered
                ? `Tudo respondido — ${questions.length} de ${questions.length}.`
                : `Faltam ${questions.length - answered} de ${questions.length}.`}
            </p>
            {!allAnswered && (
              <button
                type="button"
                className={s.back}
                style={{ marginBottom: 12 }}
                onClick={() => {
                  const falta = questions.findIndex((q) => !answers[q.id]);
                  setPasso(falta >= 0 ? falta + 1 : 1);
                }}
              >
                Ir para a primeira sem resposta
              </button>
            )}
            {submitState === "error" && (
              <p className={s.err}>Falha ao enviar. Verifique a conexão e tente novamente.</p>
            )}
            <div className={s.navRow}>
              <button type="button" className={s.back} onClick={() => setPasso(questions.length)}>
                ← Rever a última
              </button>
            </div>
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
          </>
        )}
      </div>
    </div>
  );
}
