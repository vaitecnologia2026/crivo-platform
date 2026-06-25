"use client";

import { useEffect, useState } from "react";
import { getOperationalAlerts } from "@/lib/api";
import type { OperationalAlertsResult, AlertSeverity } from "@crivo/types";

/**
 * Notificações & Travas operacionais (Fase 3 — §12). Card no topo do Dashboard que
 * o sistema usa para CONDUZIR a operação: sinaliza pendências do plano de ação que
 * travam o avanço (e o fechamento do dossiê). Some por completo quando não há nada
 * pendente — e se o papel não tem acesso (403), falha em silêncio.
 */

const SEV_COLOR: Record<AlertSeverity, string> = {
  high: "var(--danger, #c0392b)",
  warn: "var(--warn, #b7791f)",
  info: "var(--accent, #2c5282)",
};
const SEV_LABEL: Record<AlertSeverity, string> = { high: "Crítico", warn: "Atenção", info: "Aviso" };
const SEV_ORDER: Record<AlertSeverity, number> = { high: 0, warn: 1, info: 2 };

function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function OperationalAlerts() {
  const [data, setData] = useState<OperationalAlertsResult | null>(null);

  useEffect(() => {
    let alive = true;
    getOperationalAlerts()
      .then((d) => { if (alive) setData(d); })
      .catch(() => {/* sem acesso / sem dados — card não aparece */});
    return () => { alive = false; };
  }, []);

  if (!data) return null;
  const { alerts, locks } = data;
  if (alerts.length === 0 && locks.length === 0) return null;

  const sorted = [...alerts].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--warn, #b7791f)" }}>
      <div className="card__head">
        <div>
          <h3>Notificações & travas operacionais</h3>
          <span className="card__sub">
            O sistema conduz a operação — sinaliza pendências que travam o avanço do plano de ação e o fechamento do dossiê (§12).
          </span>
        </div>
      </div>

      {sorted.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sorted.map((a, i) => (
            <li
              key={`a${i}`}
              style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border, #ececec)" }}
            >
              <span aria-hidden style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: "50%", background: SEV_COLOR[a.severity], transform: "translateY(2px)" }} />
              <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: SEV_COLOR[a.severity], minWidth: 58 }}>
                {SEV_LABEL[a.severity]}
              </span>
              <span style={{ flex: 1 }}>{a.message}</span>
            </li>
          ))}
        </ul>
      )}

      {locks.length > 0 && (
        <div style={{ marginTop: sorted.length ? 14 : 0 }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--danger, #c0392b)", margin: "0 0 4px" }}>
            <IconLock /> Travas críticas ({locks.length})
          </h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {locks.map((l, i) => (
              <li key={`l${i}`} style={{ padding: "5px 0 5px 20px", position: "relative" }}>
                <span aria-hidden style={{ position: "absolute", left: 0, top: 6, color: "var(--danger, #c0392b)" }}>
                  <IconLock />
                </span>
                {l.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
