"use client";

import { useState } from "react";
import { changeMyPassword } from "@/lib/api";
import { IconCheck } from "./Icons";

/** Modal de troca de senha (#56). Conecta no PATCH /auth/password já existente. */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (next.length < 8) { setError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (next !== confirm) { setError("As senhas novas não conferem."); return; }
    setBusy(true);
    try {
      await changeMyPassword(current, next);
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terms-gate" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="terms-card" onClick={(e) => e.stopPropagation()}>
        <h2>Trocar senha</h2>
        {done ? (
          <p className="terms-body">
            <IconCheck size={13} /> Senha atualizada. Você pode continuar usando o sistema normalmente.
          </p>
        ) : (
          <>
            <p className="terms-body" style={{ fontSize: 13 }}>
              Por segurança, informe sua senha atual e escolha uma nova com pelo menos 8 caracteres.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-sec)" }}>
                Senha atual
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", marginTop: 4, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
                  autoFocus
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-sec)" }}>
                Nova senha (mín. 8)
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", marginTop: 4, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-sec)" }}>
                Confirmar nova senha
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", marginTop: 4, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
                />
              </label>
            </div>
            {error && (
              <p className="dash-state dash-state--error" style={{ margin: "0 0 12px" }}>{error}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn--outline-dark btn--sm" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn--gold btn--sm" onClick={submit} disabled={busy || !current || !next}>
                {busy ? "Trocando…" : "Trocar senha"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
