"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLATFORM_LEAD_STAGE_LABEL,
  type PlatformLeadStage,
  type PlatformLeadSummary,
} from "@crivo/types";
import { listLeads, setLeadStage } from "@/lib/admin-api";

// Colunas do funil (Print 2 do Portal PDF). PERDIDO sai do board (continua no
// banco) — movido via o seletor de estágio do card.
const BOARD: PlatformLeadStage[] = ["NOVO", "PRE_DIAGNOSTICO", "REUNIAO", "PROPOSTA", "FECHADO"];
const ALL_STAGES: PlatformLeadStage[] = [...BOARD, "PERDIDO"];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** CRM do Super Admin — funil comercial da CRIVO (leads da LP + manuais). */
export function CrmSection() {
  const [leads, setLeads] = useState<PlatformLeadSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await listLeads();
        if (alive) { setLeads(d); setStatus("ok"); }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, []);

  async function move(id: string, stage: PlatformLeadStage) {
    setBusyId(id);
    // Atualização otimista.
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, stage } : l)) ?? prev);
    try {
      await setLeadStage(id, stage);
    } catch {
      // Reverte recarregando.
      try { setLeads(await listLeads()); } catch { /* mantém estado atual */ }
    } finally {
      setBusyId(null);
    }
  }

  const byStage = useMemo(() => {
    const map = new Map<PlatformLeadStage, PlatformLeadSummary[]>();
    for (const s of ALL_STAGES) map.set(s, []);
    for (const l of leads ?? []) map.get(l.stage)?.push(l);
    return map;
  }, [leads]);

  const total = leads?.length ?? 0;
  const fechados = byStage.get("FECHADO")?.length ?? 0;
  const reunioes = byStage.get("REUNIAO")?.length ?? 0;
  const conv = total ? Math.round((fechados / total) * 100) : 0;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">CRM — Funil comercial</h1>
          <p className="page-sub">
            Gestão da jornada comercial CRIVO — da captação do lead ao contrato e onboarding.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando funil…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os leads.</div>
      )}

      {status === "ok" && leads && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Leads no funil</span>
              <strong className="kpi__value">{total}</strong>
              <span className="kpi__delta">todas as origens</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Reuniões agendadas</span>
              <strong className="kpi__value">{reunioes}</strong>
              <span className="kpi__delta">em negociação</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Taxa de conversão</span>
              <strong className="kpi__value">{conv}%</strong>
              <span className="kpi__delta">fechados / total</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Pré-diagnósticos</span>
              <strong className="kpi__value">{leads.filter((l) => l.diagnosticScore != null).length}</strong>
              <span className="kpi__delta">leads qualificados</span>
            </div>
          </div>

          <div className="kanban">
            {BOARD.map((stage) => {
              const items = byStage.get(stage) ?? [];
              return (
                <div className="kb-col" key={stage}>
                  <div className="kb-col__head">
                    {PLATFORM_LEAD_STAGE_LABEL[stage]}
                    <em>{items.length}</em>
                  </div>
                  {items.map((l) => (
                    <article
                      key={l.id}
                      className={`kb-card${stage === "FECHADO" ? " kb-card--won" : l.diagnosticScore != null ? " kb-card--hot" : ""}`}
                      style={{ opacity: busyId === l.id ? 0.5 : 1 }}
                    >
                      <strong>{l.company || l.name}</strong>
                      <span className="kb-meta">
                        {l.company ? `${l.name} · ` : ""}
                        {l.segment ?? "—"}
                        {l.employeesCount ? ` · ${l.employeesCount} colab.` : ""}
                      </span>
                      <div className="kb-foot">
                        <span className="kb-score">
                          {l.diagnosticScore != null ? `Pré ${l.diagnosticScore}` : "Sem pré-diag."}
                        </span>
                        {l.phone && <span className="kb-wpp">{l.phone}</span>}
                      </div>
                      <select
                        value={l.stage}
                        disabled={busyId === l.id}
                        onChange={(e) => move(l.id, e.target.value as PlatformLeadStage)}
                        className="kb-stage-select"
                        aria-label="Mover lead no funil"
                      >
                        {ALL_STAGES.map((s) => (
                          <option key={s} value={s}>{PLATFORM_LEAD_STAGE_LABEL[s]}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                  {items.length === 0 && <p className="kb-empty">—</p>}
                </div>
              );
            })}
          </div>

          {(byStage.get("PERDIDO")?.length ?? 0) > 0 && (
            <p className="dash-state" style={{ marginTop: 16 }}>
              {byStage.get("PERDIDO")!.length} lead(s) marcados como perdidos (fora do funil).
            </p>
          )}
        </>
      )}
    </>
  );
}
