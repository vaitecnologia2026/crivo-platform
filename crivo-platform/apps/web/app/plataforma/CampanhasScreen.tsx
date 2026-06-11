"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CampaignSummary } from "@crivo/types";

type LoadStatus = "loading" | "error" | "ok";

const STATUS_LABEL: Record<string, string> = { OPEN: "Ativa", CLOSED: "Encerrada" };

function scorePillClass(v: number): string {
  if (v >= 80) return "score-pill--high";
  if (v >= 65) return "score-pill--mid";
  return "score-pill--low";
}

function periodOf(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** Campanhas de diagnóstico (ciclos de avaliação) com dados reais do tenant. */
export function CampanhasScreen() {
  const [data, setData] = useState<CampaignSummary[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  async function load() {
    setStatus("loading");
    try {
      setData(await apiFetch<CampaignSummary[]>("/icd/campaigns"));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<CampaignSummary[]>("/icd/campaigns");
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

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Campanhas de Diagnóstico NR-1</h1>
          <p className="page-sub">Ciclos de avaliação do tenant — respondentes, adesão e ICD médio.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={load} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando campanhas…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar as campanhas.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Histórico de campanhas</h3>
              <span className="card__sub">Baseline e evolução por ciclo</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Período</th>
                <th>Respondentes</th>
                <th>Adesão</th>
                <th>ICD médio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{periodOf(c.createdAt)}</td>
                  <td>
                    {c.respondentes} / {c.totalParticipantes}
                  </td>
                  <td>{c.adesao}%</td>
                  <td>
                    {c.icdMedio !== null ? (
                      <span className={`score-pill ${scorePillClass(c.icdMedio)}`}>{c.icdMedio}</span>
                    ) : (
                      <span className="card__sub">—</span>
                    )}
                  </td>
                  <td>
                    <span className="pattern-tag">{STATUS_LABEL[c.status] ?? c.status}</span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--crivo-text-sec)" }}>
                    Nenhuma campanha ainda. Os ciclos de avaliação aparecem aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
