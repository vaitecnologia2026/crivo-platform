"use client";

import { useEffect, useState } from "react";
import type { BusinessGroupSummary, GroupAccessEntry, GroupOverview } from "@crivo/types";
import { PLAN_LABELS } from "@crivo/types";
import {
  addGroupAccess,
  getGroupOverview,
  listGroupAccess,
  removeGroupAccess,
  setGroupConsolidated,
} from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";

function scorePill(score: number): string {
  if (score >= 70) return "score-pill score-pill--high";
  if (score >= 50) return "score-pill score-pill--mid";
  return "score-pill score-pill--low";
}

function pct(done: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((done / total) * 100)}%`;
}

/** F2 — Visão consolidada do Grupo Empresarial (Caderno Tela 06).
 *  Só agregados por CNPJ (§11): nenhum dado individual de líder trafega aqui. */
export function GroupOverviewModal({
  group,
  onClose,
}: {
  group: BusinessGroupSummary;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<GroupOverview | null>(null);
  // F3 — acesso do cliente ao consolidado no portal.
  const [enabled, setEnabled] = useState(group.consolidatedEnabled);
  const [access, setAccess] = useState<GroupAccessEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoad("loading");
    Promise.all([getGroupOverview(group.id), listGroupAccess(group.id)])
      .then(([d, a]) => {
        if (!alive) return;
        setData(d);
        setAccess(a);
        setLoad("ok");
      })
      .catch(() => {
        if (alive) setLoad("error");
      });
    return () => {
      alive = false;
    };
  }, [group.id]);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    try {
      await setGroupConsolidated(group.id, next);
    } catch (e) {
      setEnabled(!next);
      alert(e instanceof Error ? e.message : "Falha ao alterar o acesso.");
    }
  }

  async function onAddEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setSavingAccess(true);
    try {
      const row = await addGroupAccess(group.id, email);
      setAccess((prev) =>
        [...prev.filter((r) => r.email !== row.email), row].sort((a, b) =>
          a.email.localeCompare(b.email),
        ),
      );
      setNewEmail("");
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Falha ao autorizar o e-mail.");
    } finally {
      setSavingAccess(false);
    }
  }

  async function onRemoveEmail(id: string) {
    try {
      await removeGroupAccess(id);
      setAccess((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  const c = data?.consolidated;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>Consolidado · {group.name}</h2>
            <p className="mt-0.5 text-[12px] text-text-sec">
              Visão agregada do grupo — cada CNPJ mantém seus dados separados. Acesso registrado em auditoria.
            </p>
          </div>
          <button onClick={onClose} className="btn btn--outline-dark btn--sm">
            Fechar
          </button>
        </div>

        <div className="modal__body">
          {load === "loading" && <p className="adm-empty">Carregando consolidado…</p>}
          {load === "error" && (
            <div className="dash-state dash-state--error">Não foi possível carregar o consolidado.</div>
          )}

          {load === "ok" && data && c && (
            <>
              <div className="kpi-grid kpi-grid--inset" style={{ marginBottom: 20 }}>
                <div className="kpi">
                  <span className="kpi__label">Empresas (CNPJs)</span>
                  <strong className="kpi__value">{c.tenants}</strong>
                  <span className="kpi__delta">{c.activeUsers} usuários ativos</span>
                </div>
                <div className="kpi">
                  <span className="kpi__label">ICD do grupo</span>
                  <strong className="kpi__value">{c.icdAverage ?? "—"}</strong>
                  <span className="kpi__delta">
                    {c.icdCovered > 0
                      ? `média de ${c.icdCovered} CNPJ${c.icdCovered === 1 ? "" : "s"} com ciclo fechado`
                      : "sem ciclo ICD fechado"}
                  </span>
                </div>
                <div className="kpi">
                  <span className="kpi__label">Plano de ação</span>
                  <strong className="kpi__value">{pct(c.actionsDone, c.actionsTotal)}</strong>
                  <span className="kpi__delta">
                    {c.actionsDone}/{c.actionsTotal} ações encerradas
                  </span>
                </div>
                <div className="kpi">
                  <span className="kpi__label">Evidências</span>
                  <strong className="kpi__value">{c.evidences}</strong>
                  <span className="kpi__delta">
                    {c.campaignsOpen} campanha{c.campaignsOpen === 1 ? "" : "s"} aberta
                    {c.campaignsOpen === 1 ? "" : "s"} · Pocket {c.pocketDone}/{c.pocketTotal}
                  </span>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>CNPJ / Empresa</th>
                    <th>Plano</th>
                    <th>ICD</th>
                    <th>Usuários</th>
                    <th>Avaliações</th>
                    <th>Ações</th>
                    <th>Evidências</th>
                    <th>Pocket</th>
                    <th>Campanhas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((t) => (
                    <tr key={t.tenantId}>
                      <td>
                        <strong>{t.name}</strong>
                        {t.status !== "ACTIVE" && (
                          <span className="pattern-tag pattern-tag--alert" style={{ marginLeft: 8 }}>
                            {t.status === "SUSPENDED" ? "Bloqueada" : "Excluída"}
                          </span>
                        )}
                      </td>
                      <td className="cell-mute">{PLAN_LABELS[t.plan]}</td>
                      <td>
                        {t.icdScore != null ? (
                          <span className={scorePill(t.icdScore)}>{t.icdScore}</span>
                        ) : t.icdSuppressed ? (
                          <span className="cell-mute" title="Suprimido pela regra de privacidade (menos de 5 líderes elegíveis)">
                            suprimido
                          </span>
                        ) : (
                          <span className="cell-mute">—</span>
                        )}
                      </td>
                      <td>{t.activeUsers}</td>
                      <td>{t.assessments}</td>
                      <td>
                        {t.actionsDone}/{t.actionsTotal}
                        <span className="cell-mute"> ({pct(t.actionsDone, t.actionsTotal)})</span>
                      </td>
                      <td>{t.evidences}</td>
                      <td>
                        {t.pocketDone}/{t.pocketTotal}
                      </td>
                      <td>
                        {t.campaignsOpen} aberta{t.campaignsOpen === 1 ? "" : "s"}
                        <span className="cell-mute"> de {t.campaignsTotal}</span>
                      </td>
                    </tr>
                  ))}
                  {data.tenants.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-sec)" }}>
                        Nenhuma empresa vinculada a este grupo ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {load === "ok" && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card__head">
                <div>
                  <h3>Acesso do cliente ao consolidado (portal)</h3>
                  <span className="card__sub">
                    Libere a visão do grupo no portal do cliente e autorize quem pode vê-la
                    (Admin de Grupo). Sem autorização, ninguém do cliente vê o consolidado.
                  </span>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
                Consolidado liberado no portal do cliente
              </label>
              {enabled && (
                <>
                  <form
                    onSubmit={onAddEmail}
                    style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
                  >
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="email@empresa.com"
                      style={{
                        font: "inherit",
                        fontSize: 13,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--line, #E3DDD3)",
                        minWidth: 240,
                      }}
                    />
                    <button className="btn btn--terra btn--sm" disabled={savingAccess}>
                      {savingAccess ? "Autorizando…" : "Autorizar"}
                    </button>
                  </form>
                  {access.length === 0 ? (
                    <p className="cell-mute" style={{ fontSize: 12.5 }}>
                      Nenhum e-mail autorizado ainda.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {access.map((a) => (
                        <span
                          key={a.id}
                          className="pattern-tag"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          {a.email}
                          <button
                            type="button"
                            onClick={() => onRemoveEmail(a.id)}
                            title="Revogar acesso"
                            style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
