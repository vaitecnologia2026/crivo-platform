"use client";

import { useEffect, useState } from "react";
import { apiFetch, listLibrary } from "@/lib/api";
import { canSeeRoute, portalNavigate, usePortal } from "@/lib/portal-shell";
import { EIXO_CURTO } from "@/lib/jornada-hoje";
import type { LibraryItemData, MeuIcdData } from "@crivo/types";
import {
  ICD_AXES,
  ICD_AXIS_DESCRIPTION,
  ICD_AXIS_TRACKS,
  LIBRARY_KIND_LABEL,
  eixoMaisFraco,
  formatIcdScore,
} from "@crivo/types";
import { IconGrid } from "./Icons";

type LoadStatus = "loading" | "error" | "ok";

/** Conteúdos de desenvolvimento do líder (mentorias, cursos, trilhas, vídeos). */
const DEV_KINDS = ["mentoria", "curso", "trilha", "video", "youtube", "linkedin", "podcast"];

function barClass(v: number): string {
  if (v >= 80) return "bar__fill--low"; // low risk = good (verde) — segue o app.css
  if (v >= 60) return "bar__fill--mid";
  return "bar__fill--high";
}

/** Minha Jornada › Evoluir › Meu ICD (rota `lider`): o ICD pessoal do usuário
 *  logado no modelo OFICIAL — os 4 eixos (Clareza, Critério, Alinhamento,
 *  Sustentação), calculados pelas decisões registradas no ciclo. A trilha foca
 *  o eixo com a menor média. A conversa com a IA (Copiloto) saiu daqui para a
 *  tela própria do Mentor CRIVO (rota `mentor`); aqui fica só o atalho. */
export function LiderScreen() {
  const [data, setData] = useState<MeuIcdData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [content, setContent] = useState<LibraryItemData[]>([]);
  // Re-renderiza quando o menu do contexto muda (canSeeRoute lê o store).
  const portal = usePortal();

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

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Meu ICD</h1>
          <p className="page-sub">
            Seu Índice de Coerência Decisória nos 4 eixos — Clareza, Critério, Alinhamento e Sustentação — e a trilha
            para evoluir no eixo em foco.
          </p>
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
                O ICD é calculado pelas decisões que você registra e avalia em "Registro de Decisão" (impacto médio ou alto).
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
              {formatIcdScore(data.icd.score)}
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
                const v = data.icd.axesAverage[eixo] ?? 0;
                return (
                  <li key={eixo} title={ICD_AXIS_DESCRIPTION[eixo]}>
                    <span>{EIXO_CURTO[eixo]}</span>
                    <div className="bar">
                      <div className={`bar__fill ${barClass(v)}`} style={{ width: `${v}%` }} />
                    </div>
                    <em>{formatIcdScore(v)}</em>
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

      {/* Atalho para o Mentor CRIVO — a conversa com a IA mora na tela própria. */}
      {canSeeRoute("mentor", portal) && (
        <div className="card" style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>Mentor CRIVO</h3>
            <span className="card__sub">
              {foco
                ? `Leve o eixo ${EIXO_CURTO[foco]} para uma conversa de apoio reflexivo sobre as suas decisões.`
                : "Uma conversa de apoio reflexivo sobre as suas decisões difíceis."}{" "}
              A conversa não é gravada e não aparece para a empresa.
            </span>
          </div>
          <button className="btn btn--gold btn--sm" onClick={() => portalNavigate("mentor")}>
            Explorar com o Mentor CRIVO
          </button>
        </div>
      )}

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
