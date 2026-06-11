"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MyIcd } from "@crivo/types";
import { DIMENSION_LABEL, PATTERN_LABEL } from "./useIcdDashboard";

type LoadStatus = "loading" | "error" | "ok";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

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
    })();
    return () => {
      alive = false;
    };
  }, []);

  const topPct = data ? Math.max(1, Math.round((data.rank / data.totalLideres) * 100)) : null;

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
                  Top {topPct}% · entre {data.totalLideres} líderes ·{" "}
                  padrão {PATTERN_LABEL[data.dominantPattern] ?? data.dominantPattern}
                </span>
              </div>
              <span className="pill pill--gold">#{data.rank}</span>
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

      <div className="card card--mini" style={{ marginTop: "16px" }}>
        <span className="card__eyebrow">EM BREVE</span>
        <h4>Trilha de desenvolvimento, Copiloto CRIVO e mentorias</h4>
        <p>Recursos de desenvolvimento do líder serão liberados nas próximas entregas.</p>
      </div>
    </>
  );
}
