"use client";

import { useEffect, useState } from "react";
import { getMyAuditLog, type AuditLogEntry } from "@/lib/api";

/** Mapas para legendar as actions técnicas do AuditLog em PT-BR amigável. */
const ACTION_LABEL: Record<string, string> = {
  "admin.login": "Login do super admin",
  "tenant.provision": "Empresa provisionada",
  "tenant.suspend": "Empresa suspensa",
  "tenant.activate": "Empresa ativada",
  "tenant.delete": "Empresa removida",
  "tenant.domain.add": "Domínio adicionado",
  "tenant.domain.remove": "Domínio removido",
  "tenant.domain.primary": "Domínio canônico definido",
  "tenant.domain.verify.ok": "Domínio verificado (DNS OK)",
  "tenant.domain.verify.fail": "Domínio: falha na verificação DNS",
  "tenant.module.set": "Módulo da empresa alterado",
  "tenant.branding.update": "Identidade visual atualizada",
};

function labelOf(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/** Histórico & Auditoria do tenant (#56 — substitui o SoonScreen). */
export function HistoricoScreen() {
  const [rows, setRows] = useState<AuditLogEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  async function refresh() {
    setStatus("loading");
    try {
      setRows(await getMyAuditLog());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    getMyAuditLog()
      .then((r) => { if (alive) { setRows(r); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Histórico & Auditoria</h1>
          <p className="page-sub">Últimas 100 ações registradas no tenant.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando histórico…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar o histórico.</div>}

      {status === "ok" && rows && rows.length === 0 && (
        <p className="dash-state">Nenhum evento de auditoria registrado ainda.</p>
      )}

      {status === "ok" && rows && rows.length > 0 && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Por</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(r.at).toLocaleString("pt-BR")}</td>
                  <td>{labelOf(r.action)}</td>
                  <td className="card__sub">{r.target ?? "—"}</td>
                  <td className="card__sub">{r.actorEmail ?? "sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
