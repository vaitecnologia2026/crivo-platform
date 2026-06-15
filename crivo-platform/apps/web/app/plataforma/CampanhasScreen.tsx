"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  closeCampaign,
  createCampaign,
  listCampaigns,
  sendCampaignReminders,
  updateCampaign,
} from "@/lib/api";
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

/** Portal §7 — Campanhas de Diagnóstico editáveis (criar, link público por
 *  setor, encerrar). Lembrete por agora é só um campo de data; o envio
 *  efetivo do e-mail entra na task #52 (Relatório Preliminar via IA) e nas
 *  polimentos de comunicação (#56). */
export function CampanhasScreen() {
  const [data, setData] = useState<CampaignSummary[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  async function load(sector?: string) {
    setStatus("loading");
    try {
      setData(await listCampaigns(sector || undefined));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    listCampaigns()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  /** Distintos setores das campanhas (alimenta o filtro). */
  const sectors = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((c) => { if (c.sector) set.add(c.sector); });
    return [...set].sort();
  }, [data]);

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/p/c/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug((s) => (s === slug ? null : s)), 2200);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Campanhas de Diagnóstico</h1>
          <p className="page-sub">Criar, editar e acompanhar ciclos. Link público por setor disponível.</p>
        </div>
        <div className="route__actions">
          <button
            className="btn btn--gold btn--sm"
            onClick={() => { setShowNew((s) => !s); setEditingId(null); }}
          >
            {showNew ? "Cancelar" : "+ Nova campanha"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={() => load(sectorFilter)} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Form de criação inline */}
      {showNew && (
        <CampaignForm
          onCancel={() => setShowNew(false)}
          onSubmit={async (dto) => {
            await createCampaign(dto);
            setShowNew(false);
            await load(sectorFilter);
          }}
        />
      )}

      {/* Filtros */}
      {sectors.length > 0 && (
        <div className="camp-filters">
          <label>
            Setor:
            <select
              value={sectorFilter}
              onChange={(e) => { setSectorFilter(e.target.value); load(e.target.value); }}
            >
              <option value="">Todos</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      )}

      {status === "loading" && <p className="dash-state">Carregando campanhas…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar as campanhas.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={() => load(sectorFilter)}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Histórico de campanhas</h3>
              <span className="card__sub">Baseline e evolução por ciclo · clique numa linha para editar</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Setor</th>
                <th>Período</th>
                <th>Adesão</th>
                <th>ICD médio</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <Fragment key={c.id}>
                  <tr className={editingId === c.id ? "is-editing" : ""}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.description && <div className="card__sub">{c.description}</div>}
                    </td>
                    <td>{c.sector ?? <span className="card__sub">—</span>}</td>
                    <td>{periodOf(c.createdAt)}</td>
                    <td>{c.adesao}% <span className="card__sub">({c.respondentes}/{c.totalParticipantes})</span></td>
                    <td>
                      {c.icdMedio !== null
                        ? <span className={`score-pill ${scorePillClass(c.icdMedio)}`}>{c.icdMedio}</span>
                        : <span className="card__sub">—</span>}
                    </td>
                    <td><span className="pattern-tag">{STATUS_LABEL[c.status] ?? c.status}</span></td>
                    <td>
                      <div className="camp-row-actions">
                        {c.publicSlug && (
                          <button className="lib-act" onClick={() => copyLink(c.publicSlug!)} title="Copiar link público">
                            {copiedSlug === c.publicSlug ? "✓ copiado" : "🔗 link"}
                          </button>
                        )}
                        {c.status === "OPEN" && (
                          <>
                            <button
                              className="lib-act"
                              onClick={() => setEditingId((id) => (id === c.id ? null : c.id))}
                            >
                              {editingId === c.id ? "fechar" : "editar"}
                            </button>
                            <button
                              className="lib-act"
                              onClick={async () => {
                                try {
                                  const r = await sendCampaignReminders(c.id);
                                  alert(r.provider === "stub"
                                    ? `Lembrete simulado (RESEND_API_KEY ausente). ${r.pending} pessoas pendentes.`
                                    : `${r.sent} lembrete(s) enviado(s) (de ${r.pending} pendentes).`);
                                  await load(sectorFilter);
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : "Falha ao enviar.");
                                }
                              }}
                              title="Enviar lembrete por e-mail aos pendentes"
                            >
                              lembrete
                            </button>
                            <button
                              className="lib-act lib-act--danger"
                              onClick={async () => {
                                if (!confirm(`Encerrar a campanha "${c.name}"?`)) return;
                                await closeCampaign(c.id);
                                await load(sectorFilter);
                              }}
                            >
                              encerrar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === c.id && (
                    <tr className="camp-edit-row">
                      <td colSpan={7}>
                        <CampaignForm
                          initial={c}
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (dto) => {
                            await updateCampaign(c.id, dto);
                            setEditingId(null);
                            await load(sectorFilter);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-sec)" }}>
                    Nenhuma campanha ainda. Crie a primeira em <strong>+ Nova campanha</strong>.
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

// ─────────────────────────────────────────────────────────────────────────
// Form compartilhado para criar/editar campanha (controla seus próprios states).
// ─────────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  sector: string;
  startsAt: string;
  endsAt: string;
  reminderAt: string;
  generatePublicLink: boolean;
}

function fromCampaign(c: CampaignSummary | undefined): FormState {
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    sector: c?.sector ?? "",
    startsAt: c?.startsAt?.slice(0, 10) ?? "",
    endsAt: c?.endsAt?.slice(0, 10) ?? "",
    reminderAt: c?.reminderAt?.slice(0, 10) ?? "",
    generatePublicLink: c ? !!c.publicSlug : true,
  };
}

function CampaignForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: CampaignSummary;
  onCancel: () => void;
  onSubmit: (dto: {
    name: string;
    description?: string;
    sector?: string;
    startsAt?: string;
    endsAt?: string;
    reminderAt?: string;
    generatePublicLink?: boolean;
    regeneratePublicLink?: boolean;
    clearPublicLink?: boolean;
  }) => Promise<void>;
}) {
  const isEdit = !!initial;
  const [s, setS] = useState<FormState>(fromCampaign(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (s.name.trim().length < 3) { setError("Nome muito curto."); return; }
    if (s.startsAt && s.endsAt && s.endsAt < s.startsAt) {
      setError("Data final deve ser maior que inicial.");
      return;
    }
    setBusy(true);
    try {
      const base = {
        name: s.name.trim(),
        description: s.description.trim() || undefined,
        sector: s.sector.trim() || undefined,
        startsAt: s.startsAt ? new Date(s.startsAt).toISOString() : undefined,
        endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : undefined,
        reminderAt: s.reminderAt ? new Date(s.reminderAt).toISOString() : undefined,
      };
      if (isEdit) {
        // Em edição: define explicitamente se quer regenerar ou limpar slug.
        const hadSlug = !!initial?.publicSlug;
        const wantSlug = s.generatePublicLink;
        await onSubmit({
          ...base,
          regeneratePublicLink: wantSlug && !hadSlug,
          clearPublicLink: !wantSlug && hadSlug,
        });
      } else {
        await onSubmit({ ...base, generatePublicLink: s.generatePublicLink });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="camp-form">
      <div className="camp-form__grid">
        <label>
          <span>Nome da campanha *</span>
          <input
            value={s.name}
            onChange={(e) => setS({ ...s, name: e.target.value })}
            placeholder="Ex: Ciclo 2026.3 — Liderança"
            maxLength={120}
          />
        </label>

        <label>
          <span>Setor / área (opcional)</span>
          <input
            value={s.sector}
            onChange={(e) => setS({ ...s, sector: e.target.value })}
            placeholder="Ex: Comercial, Operações…"
            maxLength={60}
          />
        </label>

        <label className="camp-form__full">
          <span>Descrição / instrução (opcional)</span>
          <textarea
            value={s.description}
            onChange={(e) => setS({ ...s, description: e.target.value })}
            placeholder="Contexto, propósito e instruções aos respondentes."
            rows={2}
            maxLength={2000}
          />
        </label>

        <label>
          <span>Início</span>
          <input type="date" value={s.startsAt} onChange={(e) => setS({ ...s, startsAt: e.target.value })} />
        </label>
        <label>
          <span>Fim</span>
          <input type="date" value={s.endsAt} onChange={(e) => setS({ ...s, endsAt: e.target.value })} />
        </label>
        <label>
          <span>Lembrete</span>
          <input type="date" value={s.reminderAt} onChange={(e) => setS({ ...s, reminderAt: e.target.value })} />
        </label>

        <label className="camp-form__full camp-form__check">
          <input
            type="checkbox"
            checked={s.generatePublicLink}
            onChange={(e) => setS({ ...s, generatePublicLink: e.target.checked })}
          />
          <span>Gerar link público (respondentes acessam sem login)</span>
        </label>
      </div>

      {error && <p className="dash-state dash-state--error" style={{ margin: "8px 0" }}>{error}</p>}

      <div className="camp-form__actions">
        <button className="btn btn--outline-dark btn--sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="btn btn--gold btn--sm" onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar campanha"}
        </button>
      </div>
    </div>
  );
}
