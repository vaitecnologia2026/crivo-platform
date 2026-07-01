"use client";

import { useEffect, useState } from "react";
import type { NotificationChannel, NotificationSettingData } from "@crivo/types";
import { getNotificationSettings, updateNotificationSetting } from "@/lib/admin-api";

/**
 * Configuração de Notificações — lista os gatilhos REAIS do sistema e liga/
 * desliga cada canal (e-mail / push). O estado é respeitado no momento do
 * disparo pelo backend. Padrão: todos ativos.
 */
export function NotificationsSection() {
  const [rows, setRows] = useState<NotificationSettingData[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await getNotificationSettings());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function toggle(row: NotificationSettingData, channel: NotificationChannel, value: boolean) {
    setSavingKey(row.key);
    setSavedKey(null);
    // Otimista: atualiza a UI antes da resposta; reverte em caso de erro.
    setRows((rs) =>
      rs?.map((r) =>
        r.key === row.key
          ? { ...r, ...(channel === "email" ? { emailEnabled: value } : { pushEnabled: value }) }
          : r,
      ) ?? rs,
    );
    try {
      const updated = await updateNotificationSetting(
        row.key,
        channel === "email" ? { emailEnabled: value } : { pushEnabled: value },
      );
      setRows((rs) => rs?.map((r) => (r.key === updated.key ? updated : r)) ?? rs);
      setSavedKey(row.key);
      setTimeout(() => setSavedKey((k) => (k === row.key ? null : k)), 2000);
    } catch (e) {
      // Reverte a mudança otimista.
      setRows((rs) =>
        rs?.map((r) =>
          r.key === row.key
            ? { ...r, ...(channel === "email" ? { emailEnabled: !value } : { pushEnabled: !value }) }
            : r,
        ) ?? rs,
      );
      alert(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Configuração de Notificações</h1>
          <p className="page-sub">
            Ligue ou desligue cada gatilho de notificação do sistema, por canal. As mudanças são
            respeitadas no momento do disparo. Por padrão, todos os gatilhos estão ativos.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os gatilhos.</div>
      )}

      {status === "ok" && rows && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Gatilho</th>
                <th style={{ textAlign: "center", width: 110 }}>E-mail</th>
                <th style={{ textAlign: "center", width: 110 }}>Push (app)</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <strong>{r.label}</strong>
                    <div className="card__sub" style={{ marginTop: 2 }}>{r.description}</div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {r.channels.includes("email") ? (
                      <input
                        type="checkbox"
                        checked={r.emailEnabled}
                        disabled={savingKey === r.key}
                        onChange={(e) => toggle(r, "email", e.target.checked)}
                        aria-label={`E-mail de ${r.label}`}
                      />
                    ) : (
                      <span className="card__sub">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {r.channels.includes("push") ? (
                      <input
                        type="checkbox"
                        checked={r.pushEnabled}
                        disabled={savingKey === r.key}
                        onChange={(e) => toggle(r, "push", e.target.checked)}
                        aria-label={`Push de ${r.label}`}
                      />
                    ) : (
                      <span className="card__sub">—</span>
                    )}
                  </td>
                  <td>
                    {savedKey === r.key && <span className="kb-converted">✓ Salvo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
