"use client";

import { useEffect, useState } from "react";
import { Button } from "@crivo/ui";
import { adminLogin, clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-api";
import type { PlatformAdmin } from "@crivo/types";
import { TenantsManager } from "./TenantsManager";

/**
 * Painel do Super Admin (control plane). Sessão separada da plataforma de tenant
 * — usa crivo_admin_token. Sem token → tela de login; com token → gestão de
 * empresas. Consome /api/admin/*.
 */
export function SuperAdmin() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [ready, setReady] = useState(false);

  // Restaura a sessão a partir do token persistido (decodifica o payload do JWT).
  // setState após boundary assíncrono: evita cascading renders no corpo do effect
  // e o flash de login antes da checagem (mesmo padrão de useIcdDashboard).
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getAdminToken();
      const payload = token ? decodeJwt(token) : null;
      await Promise.resolve();
      if (!alive) return;
      if (payload?.scope === "platform") {
        setAdmin({ id: payload.sub, email: payload.email, name: payload.name });
      } else if (token) {
        clearAdminToken();
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function onLogout() {
    clearAdminToken();
    setAdmin(null);
  }

  if (!ready) return null; // evita flash de login antes de checar o token

  if (!admin) return <LoginScreen onAuthenticated={setAdmin} />;

  return <TenantsManager admin={admin} onLogout={onLogout} />;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (a: PlatformAdmin) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, admin } = await adminLogin(email.trim(), password, totp.trim());
      setAdminToken(token);
      onAuthenticated(admin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no login";
      // Quando o MFA é exigido, revela o campo de código e instrui o usuário.
      if (/mfa/i.test(msg)) {
        setMfaRequired(true);
        setError(totp ? "Código MFA inválido." : "Informe o código do seu autenticador.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-azul-abismo px-6 font-body text-off-white">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl tracking-[0.04em] text-off-white">CRIVO™</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-terra-dourado">
            Painel da Plataforma
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[6px] border border-[rgba(242,240,236,0.12)] bg-[rgba(255,255,255,0.03)] p-7"
        >
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
            autoFocus
          />
          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {mfaRequired && (
            <Field
              label="Código (MFA)"
              type="text"
              value={totp}
              onChange={setTotp}
              autoComplete="one-time-code"
              autoFocus
            />
          )}

          {error && (
            <p className="mt-1 mb-3 text-[12px] text-terra-claro" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="terra" block disabled={loading || !email || !password}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[11px] text-text-on-dark-sec">
          Acesso restrito a administradores globais da CRIVO™.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-text-on-dark-sec">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full rounded-[3px] border border-[rgba(242,240,236,0.18)] bg-[rgba(9,22,40,0.6)] px-3 py-2.5 text-[14px] text-off-white outline-none transition-colors focus:border-terra-dourado"
      />
    </label>
  );
}

/** Decodifica o payload de um JWT (sem validar a assinatura — só p/ UI). */
function decodeJwt(token: string): { sub: string; scope?: string; email: string; name: string } | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
