"use client";

import { useState } from "react";
import { changeAdminPassword } from "../../lib/admin-api";

/** Mínimo do servidor (ChangeAdminPasswordDto). Validar aqui evita um 400 seco. */
const MIN_LEN = 12;

/**
 * Troca de senha do super admin logado. A rota `PATCH /admin/auth/password`
 * existia desde o início, mas nenhum botão do painel chamava ela — quem operava
 * o control plane não tinha como trocar a própria senha sem passar pelo banco.
 */
export function AdminPasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (next.length < MIN_LEN) {
      setError(`A nova senha precisa ter pelo menos ${MIN_LEN} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setError("As senhas novas não conferem.");
      return;
    }
    if (next === current) {
      setError("A nova senha precisa ser diferente da atual.");
      return;
    }
    setBusy(true);
    try {
      await changeAdminPassword(current, next);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
    {/* Clique fora NAO fecha: modal com formulario — fechar por engano apagava o que ja tinha sido digitado. Sai pelo X ou pelo Cancelar. */}
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal__head">
          <h2>Trocar minha senha</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <div className="modal__body">
          {done ? (
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              Senha atualizada. Esta sessão continua válida; as suas <strong>outras</strong> sessões
              foram encerradas e vão pedir a senha nova.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-sec)", marginBottom: 16, lineHeight: 1.6 }}>
                Informe a senha atual e escolha uma nova com pelo menos {MIN_LEN} caracteres.
                Trocar a senha encerra as suas outras sessões abertas.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label className="prod-field">
                  <span>Senha atual</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="prod-field">
                  <span>Nova senha (mín. {MIN_LEN})</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                  />
                </label>
                <label className="prod-field">
                  <span>Confirmar nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) void submit();
                    }}
                  />
                </label>
              </div>
              {error && (
                <p className="dash-state dash-state--error" style={{ margin: "14px 0 0" }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose} disabled={busy}>
            {done ? "Fechar" : "Cancelar"}
          </button>
          {!done && (
            <button
              type="button"
              className="btn btn--terra btn--sm"
              onClick={submit}
              disabled={busy || !current || !next || !confirm}
            >
              {busy ? "Trocando…" : "Trocar senha"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
