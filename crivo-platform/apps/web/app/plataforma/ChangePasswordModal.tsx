"use client";

import { useState } from "react";
import { changeMyPassword, clearToken } from "@/lib/api";
import { IconCheck } from "./Icons";

/**
 * Modal de troca de senha (#56). Conecta no PATCH /auth/password já existente.
 *
 * `obrigatorio`: primeiro acesso com senha SORTEADA pela plataforma (criação do
 * cliente, "enviar acesso" do CRM, redefinição pelo super admin). Aí não há
 * "Cancelar" nem fechar pelo fundo — a senha que trafegou por e-mail não pode
 * continuar valendo. Trocar a senha invalida o token no servidor, então ao fim
 * a sessão é encerrada e a pessoa entra com a senha que acabou de definir.
 */
export function ChangePasswordModal({
  onClose,
  obrigatorio = false,
}: {
  onClose: () => void;
  obrigatorio?: boolean;
}) {
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
      if (obrigatorio) {
        // A troca derruba a sessão no servidor (tokenVersion): seguir navegando
        // daria 401 na primeira chamada. Volta ao login já com a senha nova.
        setTimeout(() => {
          clearToken();
          window.location.reload();
        }, 1800);
      } else {
        setTimeout(onClose, 1400);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="terms-gate"
      role="dialog"
      aria-modal="true"
      onClick={obrigatorio ? undefined : onClose}
    >
      <div className="terms-card" onClick={(e) => e.stopPropagation()}>
        <h2>{obrigatorio ? "Defina a sua senha" : "Trocar senha"}</h2>
        {done ? (
          <p className="terms-body">
            <IconCheck size={13} />{" "}
            {obrigatorio
              ? "Senha definida. Entre novamente com a senha que você acabou de criar."
              : "Senha atualizada. Você pode continuar usando o sistema normalmente."}
          </p>
        ) : (
          <>
            <p className="terms-body" style={{ fontSize: 13 }}>
              {obrigatorio
                ? "Este é o seu primeiro acesso. A senha que você recebeu por e-mail é temporária — informe-a abaixo e escolha uma senha sua, com pelo menos 8 caracteres."
                : "Por segurança, informe sua senha atual e escolha uma nova com pelo menos 8 caracteres."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-sec)" }}>
                {obrigatorio ? "Senha temporária (a que você recebeu por e-mail)" : "Senha atual"}
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
              {!obrigatorio && (
                <button className="btn btn--outline-dark btn--sm" onClick={onClose} disabled={busy}>
                  Cancelar
                </button>
              )}
              <button className="btn btn--gold btn--sm" onClick={submit} disabled={busy || !current || !next}>
                {busy ? "Salvando…" : obrigatorio ? "Definir senha" : "Trocar senha"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
