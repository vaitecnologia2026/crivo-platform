"use client";

import { useState } from "react";
import { askCopiloto } from "@/lib/api";
import { eixoMaisFraco, type MeuIcdData } from "@crivo/types";
import { motivoParaLider, sugestoesMentor } from "@/lib/jornada-hoje";

type Turn = { role: "user" | "copiloto"; text: string };

/**
 * Conversa com o Copiloto CRIVO (apoio reflexivo por IA — POST /copiloto/ask),
 * extraída da antiga Área do Líder para ser o coração do "Mentor CRIVO".
 * Com `icd`, as sugestões partem do eixo em foco e a pergunta leva nota, faixa
 * e eixos do PRÓPRIO líder como contexto; sem `icd`, conversa sem contexto.
 * A conversa vive só no estado desta tela: nada é gravado.
 */
export function CopilotoChat({
  icd,
  titulo = "Mentor CRIVO",
  subtitulo = "Apoio reflexivo de coerência decisória — não é diagnóstico clínico.",
}: {
  icd?: MeuIcdData | null;
  titulo?: string;
  subtitulo?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || asking) return;
    setAsking(true);
    setQuestion("");
    setTurns((t) => [...t, { role: "user", text }]);
    try {
      const res = await askCopiloto({
        question: text,
        context: icd
          ? { score: icd.icd.score, band: icd.icd.band.label, axes: icd.icd.axesAverage }
          : undefined,
      });
      setTurns((t) => [...t, { role: "copiloto", text: res.ok ? res.answer ?? "" : motivoParaLider(res.reason) }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "copiloto", text: e instanceof Error ? e.message : "Falha ao consultar o Mentor." }]);
    } finally {
      setAsking(false);
    }
  }

  const suggestions = sugestoesMentor(icd ? eixoMaisFraco(icd.icd.axesAverage) : null);

  return (
    <div className="card" style={{ marginTop: "16px" }}>
      <div className="card__head">
        <div>
          <h3>{titulo}</h3>
          <span className="card__sub">{subtitulo}</span>
        </div>
      </div>

      {turns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }} aria-live="polite">
          {turns.map((t, i) => (
            <div
              key={i}
              className={t.role === "user" ? "copiloto-turn copiloto-turn--user" : "copiloto-turn"}
              style={{
                alignSelf: t.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: t.role === "user" ? "var(--ink-900)" : "var(--line-soft)",
                color: t.role === "user" ? "#fff" : "var(--text)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {t.text}
            </div>
          ))}
          {asking && <div className="card__sub">Mentor pensando…</div>}
        </div>
      )}

      {turns.length === 0 && (
        <div className="hero__ctas" style={{ marginBottom: "12px", flexWrap: "wrap" }}>
          {suggestions.map((s) => (
            <button key={s} className="btn btn--ghost-dark btn--sm" onClick={() => ask(s)} disabled={asking}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        style={{ display: "flex", gap: "8px" }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Conte a decisão difícil ou pergunte ao Mentor…"
          aria-label="Sua pergunta ao Mentor CRIVO"
          style={{ flex: 1, minWidth: 0 }}
          disabled={asking}
        />
        <button type="submit" className="btn btn--gold btn--sm" disabled={asking || !question.trim()}>
          {asking ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
