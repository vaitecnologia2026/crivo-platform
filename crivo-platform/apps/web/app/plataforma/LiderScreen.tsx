"use client";

import { useEffect, useState } from "react";
import { apiFetch, askCopiloto, listLibrary } from "@/lib/api";
import type { LibraryItemData, MyIcd } from "@crivo/types";
import { LEADER_TRACKS, LIBRARY_KIND_LABEL } from "@crivo/types";
import { DIMENSION_LABEL, PATTERN_LABEL } from "./useIcdDashboard";

type LoadStatus = "loading" | "error" | "ok";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

/** Conteúdos de desenvolvimento do líder (mentorias, cursos, trilhas, vídeos). */
const DEV_KINDS = ["mentoria", "curso", "trilha", "video", "youtube", "linkedin", "podcast"];

type Turn = { role: "user" | "copiloto"; text: string };

function barClass(v: number): string {
  if (v >= 80) return "bar__fill--low"; // low risk = good (verde) — segue o app.css
  if (v >= 60) return "bar__fill--mid";
  return "bar__fill--high";
}

/** Área do Líder: o ICD pessoal do usuário logado (dado real). Trilha/copiloto
 *  são features ainda não disponíveis — exibidas como "em breve", sem mock. */
export function LiderScreen() {
  const [data, setData] = useState<MyIcd | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [content, setContent] = useState<LibraryItemData[]>([]);
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
        context: data
          ? { score: data.score, dominantPattern: data.dominantPattern, dimensions: data.dimensions }
          : undefined,
      });
      setTurns((t) => [...t, { role: "copiloto", text: res.ok ? res.answer ?? "" : res.reason ?? "Indisponível." }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "copiloto", text: e instanceof Error ? e.message : "Falha ao consultar o copiloto." }]);
    } finally {
      setAsking(false);
    }
  }

  async function load() {
    setStatus("loading");
    try {
      setData(await apiFetch<MyIcd | null>("/icd/me"));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<MyIcd | null>("/icd/me");
        if (alive) {
          setData(d);
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("error");
      }
      // Conteúdos de desenvolvimento (biblioteca) — opcional; silencioso se indisponível.
      try {
        const items = await listLibrary();
        if (alive) setContent(items.filter((i) => DEV_KINDS.includes(i.kind)));
      } catch {
        /* módulo de biblioteca pode não estar habilitado para o tenant */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const track = data ? LEADER_TRACKS[data.dominantPattern] : null;
  const suggestions = track
    ? [`Como começar a trabalhar minha tensão de ${PATTERN_LABEL[data!.dominantPattern] ?? data!.dominantPattern}?`,
       "Me dê um exercício prático para a próxima decisão difícil."]
    : ["Como o método CRIVO me ajuda a decidir melhor sob pressão?"];

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Área do Líder</h1>
          <p className="page-sub">Seu Índice de Coerência Decisória e sua evolução.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={load} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando seu ICD…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar seu ICD.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && !data && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Você ainda não tem uma avaliação ICD</h3>
              <span className="card__sub">Quando uma avaliação for aplicada, seu índice aparece aqui.</span>
            </div>
          </div>
        </div>
      )}

      {status === "ok" && data && (
        <div className="grid grid--2">
          <div className="card">
            <div className="card__head">
              <div>
                <h3>Seu ICD atual</h3>
                <span className="card__sub">
                  Tensão dominante: {PATTERN_LABEL[data.dominantPattern] ?? data.dominantPattern}
                </span>
              </div>
            </div>
            <h2 style={{ fontSize: "48px", margin: "8px 0", color: "var(--crivo-azul-profundo)" }}>
              {data.score}
              <small style={{ fontSize: "20px", color: "var(--crivo-text-sec)" }}> /100</small>
            </h2>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <h3>Suas dimensões</h3>
                <span className="card__sub">Coerência por dimensão (0–100)</span>
              </div>
            </div>
            <ul className="camp-sectors">
              {DIMENSIONS.map((key) => {
                const v = data.dimensions[key] ?? 0;
                return (
                  <li key={key}>
                    <span>{DIMENSION_LABEL[key] ?? key}</span>
                    <div className="bar">
                      <div className={`bar__fill ${barClass(v)}`} style={{ width: `${v}%` }} />
                    </div>
                    <em>{v}</em>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Trilha de desenvolvimento — derivada da tensão dominante do líder */}
      {track && (
        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card__head">
            <div>
              <h3>Trilha de desenvolvimento</h3>
              <span className="card__sub">
                Personalizada para sua tensão dominante · {PATTERN_LABEL[data!.dominantPattern] ?? data!.dominantPattern}
              </span>
            </div>
            <span className="pill pill--gold">Foco do ciclo</span>
          </div>
          <h4 style={{ margin: "4px 0 6px" }}>{track.title}</h4>
          <p className="card__sub" style={{ marginBottom: "12px" }}>{track.focus}</p>
          <ul className="camp-sectors">
            {track.practices.map((p, i) => (
              <li key={i} style={{ display: "flex", gap: "10px" }}>
                <span className="pill" style={{ flexShrink: 0 }}>{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copiloto CRIVO — apoio reflexivo por IA */}
      <div className="card" style={{ marginTop: "16px" }}>
        <div className="card__head">
          <div>
            <h3>Copiloto CRIVO</h3>
            <span className="card__sub">Apoio reflexivo de coerência decisória — não é diagnóstico clínico.</span>
          </div>
        </div>

        {turns.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
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
                }}
              >
                {t.text}
              </div>
            ))}
            {asking && <div className="card__sub">Copiloto pensando…</div>}
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
            placeholder="Pergunte ao Copiloto sobre uma decisão difícil…"
            style={{ flex: 1 }}
            disabled={asking}
          />
          <button type="submit" className="btn btn--gold btn--sm" disabled={asking || !question.trim()}>
            {asking ? "…" : "Enviar"}
          </button>
        </form>
      </div>

      {/* Mentorias & conteúdos — biblioteca de desenvolvimento (Academia CRIVO) */}
      {content.length > 0 && (
        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card__head">
            <div>
              <h3>Mentorias & conteúdos</h3>
              <span className="card__sub">Material de desenvolvimento da Academia CRIVO.</span>
            </div>
          </div>
          <ul className="lib-list">
            {content.map((c) => (
              <li key={c.id} className="lib-row">
                <span className="lib-ic">▦</span>
                <div>
                  <strong>{c.title}</strong>
                  <span>{LIBRARY_KIND_LABEL[c.kind] ?? c.kind}{c.description ? ` · ${c.description}` : ""}</span>
                </div>
                {c.url && (
                  <a className="btn btn--outline-dark btn--sm" href={c.url} target="_blank" rel="noopener noreferrer">
                    Abrir
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
