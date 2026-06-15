"use client";

import { useEffect, useState } from "react";
import { adminLogin, clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-api";
import type { PlatformAdmin } from "@crivo/types";
import { AdminShell } from "./AdminShell";
import s from "./login.module.css";

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

  return <AdminShell admin={admin} onLogout={onLogout} />;
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
    <main className={s.shell}>
      {/* Painel de marca (esquerda) — escondido no mobile */}
      <aside className={s.brandSide}>
        <div className={s.brandGlow} aria-hidden />
        <div className={s.brandTop}>
          <Mark className={s.brandMark} />
          <span className={s.brandWord}>
            <span className={s.brandWordName}>CRIVO</span>
            <span className={s.brandWordSub}>Painel da Plataforma</span>
          </span>
        </div>

        <div className={s.brandMid}>
          <h2 className={s.brandHeadline}>
            Inteligência de decisão, <em>sob seu controle</em>.
          </h2>
          <p className={s.brandText}>
            Control Plane da CRIVO™ — provisione empresas, configure produtos e contratos,
            gerencie a IA e acompanhe a auditoria da plataforma.
          </p>
          <div className={s.brandRule} />
        </div>

        <div className={s.brandBottom}>
          <div className={s.brandStat}>
            <span className={s.brandStatLabel}>Ambiente</span>
            <span className={s.brandStatValue}>Control Plane</span>
          </div>
          <div className={s.brandStat}>
            <span className={s.brandStatLabel}>Acesso</span>
            <span className={s.brandStatValue}>Administradores globais</span>
          </div>
        </div>
      </aside>

      {/* Formulário (direita) */}
      <section className={s.formSide}>
        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.mobileBrand}>
            <Mark className={s.brandMark} style={{ margin: "0 auto 10px" }} />
            <p className={s.brandWordName}>CRIVO</p>
            <p className={s.brandWordSub}>Painel da Plataforma</p>
          </div>

          <h1 className={s.title}>Entrar</h1>
          <p className={s.subtitle}>Use suas credenciais de administrador global.</p>

          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
            autoFocus
            placeholder="voce@crivo.com"
          />

          <PasswordField value={password} onChange={setPassword} />

          {mfaRequired && (
            <Field
              label="Código (MFA)"
              type="text"
              value={totp}
              onChange={setTotp}
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="000000"
              autoFocus
            />
          )}

          {error && (
            <div className={s.error} role="alert">
              <span aria-hidden>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password} className={s.submit}>
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <p className={s.footer}>
            <svg className={s.footerIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
            </svg>
            Acesso restrito e auditado. Sessão exclusiva de administradores globais da CRIVO™.
          </p>
        </form>
      </section>
    </main>
  );
}

/** Símbolo Vértice (marca CRIVO). */
function Mark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 48 44" fill="none" aria-hidden="true" className={className} style={style}>
      <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
      <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
    </svg>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
  placeholder,
  inputMode,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        inputMode={inputMode}
        className={s.input}
      />
    </label>
  );
}

/** Campo de senha com mostrar/ocultar. */
function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <label className={s.field}>
      <span className={s.label}>Senha</span>
      <div className={s.inputWrap}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          className={`${s.input} ${s.hasToggle}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className={s.toggle}
        >
          {show ? "Ocultar" : "Mostrar"}
        </button>
      </div>
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
