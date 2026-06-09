"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Lead {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  segment?: string | null;
  origin?: string | null;
  stage: string;
}

const STAGES: { key: string; label: string }[] = [
  { key: "NOVO", label: "Novo lead" },
  { key: "CONTATO", label: "Em contato" },
  { key: "QUALIFICADO", label: "Qualificado" },
  { key: "PROPOSTA", label: "Proposta" },
  { key: "GANHO", label: "Ganho" },
  { key: "PERDIDO", label: "Perdido" },
];

const ORIGIN: Record<string, { label: string; cls: string }> = {
  "lp-diagnostico": { label: "Diagnóstico", cls: "kb-tag--nr1" },
  "lp-ebook-nr1": { label: "E-book", cls: "kb-tag--ebook" },
  manual: { label: "Manual", cls: "kb-tag--ads" },
};

function waLink(whatsapp?: string | null): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/55${digits}`;
}

export function CrmScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  async function refresh() {
    setStatus("loading");
    try {
      const d = await apiFetch<Lead[]>("/leads");
      setLeads(d);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<Lead[]>("/leads");
        if (alive) {
          setLeads(d);
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

  async function moveStage(id: string, stage: string) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l))); // otimista
    try {
      await apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    } catch {
      setLeads(prev); // reverte em caso de erro
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Pipeline Comercial</h1>
          <p className="page-sub">Da captação ao fechamento — leads, follow-up e conversão.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando pipeline…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar os leads.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && leads.length === 0 && (
        <div className="dash-state">Nenhum lead no pipeline ainda.</div>
      )}

      {status === "ok" && leads.length > 0 && (
        <div className="kanban">
          {STAGES.map((col) => {
            const items = leads.filter((l) => l.stage === col.key);
            return (
              <div className="kb-col" key={col.key}>
                <div className="kb-col__head">
                  <span>{col.label}</span>
                  <em>{items.length}</em>
                </div>
                {items.map((l) => {
                  const tag = l.origin ? ORIGIN[l.origin] : undefined;
                  const wa = waLink(l.whatsapp);
                  return (
                    <div className="kb-card" key={l.id}>
                      {tag && <span className={`kb-tag ${tag.cls}`}>{tag.label}</span>}
                      <strong>{l.company ?? l.name}</strong>
                      <span className="kb-meta">
                        {l.name}
                        {l.segment ? ` · ${l.segment}` : ""}
                      </span>
                      <div className="kb-foot">
                        {wa ? (
                          <a className="kb-wpp" href={wa} target="_blank" rel="noopener">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="kb-score">{l.email ?? "—"}</span>
                        )}
                        <select
                          className="kb-stage"
                          value={l.stage}
                          onChange={(e) => moveStage(l.id, e.target.value)}
                          aria-label={`Mover ${l.name} de estágio`}
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
