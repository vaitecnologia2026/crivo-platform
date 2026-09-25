"use client";

import { useEffect, useState } from "react";
import { apiFetch, askCopiloto, listLibrary } from "@/lib/api";
import type { LibraryItemData, MeuIcdData } from "@crivo/types";
import {
  ICD_AXES,
  ICD_AXIS_DESCRIPTION,
  ICD_AXIS_TRACKS,
  LIBRARY_KIND_LABEL,
  eixoMaisFraco,
} from "@crivo/types";
import { IconGrid } from "./Icons";

type LoadStatus = "loading" | "error" | "ok";

/** Rótulo curto dos 4 eixos do ICD oficial (o mesmo da tela Liderança). */
const EIXO_CURTO: Record<(typeof ICD_AXES)[number], string> = {
  CLAREZA: "Clareza",
  CRITERIO: "Critério",
  ALINHAMENTO: "Alinhamento",
  SUSTENTACAO: "Sustentação",
};

/** Conteúdos de desenvolvimento do líder (mentorias, cursos, trilhas, vídeos). */
const DEV_KINDS = ["mentoria", "curso", "trilha", "video", "youtube", "linkedin", "podcast"];

type Turn = { role: "user" | "copiloto"; text: string };

function barClass(v: number): string {
  if (v >= 80) return "bar__fill--low"; // low risk = good (verde) — segue o app.css
  if (v >= 60) return "bar__fill--mid";
  return "bar__fill--high";
}

/** Área do Líder: o ICD pessoal do usuário logado no modelo OFICIAL — os 4
 *  eixos (Clareza, Critério, Alinhamento, Sustentação), calculados pelas
 *  decisões registradas no ciclo. A trilha foca o eixo com a menor média. */
export function LiderScreen() {
  const [data, setData] = useState<MeuIcdData | null>(null);
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
          ? { score: data.icd.score, band: data.icd.band.label, axes: data.icd.axesAverage }
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
      setData(await apiFetch<MeuIcdData | null>("/icd-cycles/me"));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<MeuIcdData | null>("/icd-cycles/me");
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

  // Foco de desenvolvimento = eixo com a MENOR média do líder no ciclo.
  const foco = data ? eixoMaisFraco(data.icd.axesAverage) : null;
  const track = foco ? ICD_AXIS_TRACKS[foco] : null;
  const suggestions = foco
    ? [`Como fortalecer o eixo ${EIXO_CURTO[foco]} nas minhas decisões?`,
       "Me dê um exercício prático para a próxima decisão difícil."]
    : ["Como o método CRIVO me ajuda a decidir melhor sob pressão?"];

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Área do Líder</h1>
          <p className="page-sub">Seu Índice de Coerência Decisória nos 4 eixos: Clareza, Critério, Alinhamento e Sustentação.</p>
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
              <h3>Você ainda não tem ICD no ciclo</h3>
              <span className="card__sub">
                O ICD é calculado pelas decisões que você registra e avalia em "Registro de Decisões" (impacto médio ou alto).
                Assim que houver uma decisão avaliada, seu índice aparece aqui.
              </span>
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
                  {data.icd.band.label} · {data.origem === "CICLO_ABERTO" ? "parcial do ciclo" : "ciclo fechado"}
                  {data.cicloNome ? ` ${data.cicloNome}` : ""} · {data.icd.decisionCount}{" "}
                  {data.icd.decisionCount === 1 ? "decisão avaliada" : "decisões avaliadas"}
                </span>
              </div>
            </div>
            <h2 style={{ fontSize: "48px", margin: "8px 0", color: "var(--crivo-azul-profundo)" }}>
              {data.icd.score}
              <small style={{ fontSize: "20px", color: "var(--crivo-text-sec)" }}> /100</small>
            </h2>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <h3>Seus eixos</h3>
                <span className="card__sub">Média por eixo do ICD (0–100)</span>
              </div>
            </div>
            <ul className="camp-sectors">
              {ICD_AXES.map((eixo) => {
                const v = Math.round(data.icd.axesAverage[eixo] ?? 0);
                return (
                  <li key={eixo} title={ICD_AXIS_DESCRIPTION[eixo]}>
                    <span>{EIXO_CURTO[eixo]}</span>
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

      {/* Trilha de desenvolvimento — foco no eixo com a menor média do líder */}
      {track && foco && (
        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card__head">
            <div>
              <h3>Trilha de desenvolvimento</h3>
              <span className="card__sub">
                Foco no eixo com a menor média · {EIXO_CURTO[foco]}
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
                <span className="lib-ic"><IconGrid size={14} /></span>
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

      {/* Frase obrigatória de governança (Anexo ICD do Líder v1, §11). */}
      <p className="dash-privacy" role="note">
        <strong>Governança ICD · §11 — </strong>
        O ICD do Líder é ferramenta de desenvolvimento e sustentação da liderança.
        Não deve ser utilizado para ranking individual, punição, promoção,
        avaliação de performance ou comparação nominal entre líderes.
      </p>
    </>
  );
}
