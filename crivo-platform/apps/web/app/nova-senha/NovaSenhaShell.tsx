"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgotPassword, resetPasswordWithToken, verifyResetToken } from "@/lib/api";

/** Mesmo mínimo do backend (ResetPasswordDto/ChangePasswordDto): recuperar a
 *  senha não pode ser um atalho para uma senha mais fraca do que a troca normal. */
const MIN_LEN = 8;

type Conta = { email: string; name: string; company: string };

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("t");
  return t && t.trim() ? t.trim() : null;
}

/**
 * Recuperação de senha do portal, em duas confirmações:
 *
 *  1. a pessoa confirma o E-MAIL e recebe um link de uso único (60 min);
 *  2. no link, ela vê de qual conta/empresa se trata e digita a senha nova
 *     duas vezes.
 *
 * Uma decisão que parece contraintuitiva e é deliberada: no passo 1 a tela
 * responde a MESMA coisa exista ou não a conta. Dizer "e-mail não cadastrado"
 * transformaria a tela num verificador de quem é cliente da CRIVO.
 */
export function NovaSenhaShell() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Passo 1
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  // Passo 2
  const [conta, setConta] = useState<Conta | null>(null);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [pronto, setPronto] = useState(false);

  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) {
      setReady(true);
      return;
    }
    // Link aberto: confirma antes de mostrar o formulário, para a pessoa não
    // digitar uma senha nova num link já vencido.
    verifyResetToken(t)
      .then(setConta)
      .catch((e) => setErro(e instanceof Error ? e.message : "Link inválido ou expirado."))
      .finally(() => setReady(true));
  }, []);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setBusy(true);
    try {
      await forgotPassword(email);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function gravar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < MIN_LEN) {
      setErro(`A senha precisa de pelo menos ${MIN_LEN} caracteres.`);
      return;
    }
    if (senha !== repetir) {
      setErro("As duas senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordWithToken(token as string, senha);
      setPronto(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível redefinir agora.");
    } finally {
      setBusy(false);
    }
  }

  // Evita piscar o formulário de e-mail antes de saber se há token na URL.
  if (!ready) return null;

  return (
    <div id="login" className="screen screen--login is-active">
      <div className="login__photo" aria-hidden="true" />
      <div className="login__bg" />
      <div className="login__panel">
        <div className="login__brand brand__lockup">
          <svg className="vertice" viewBox="0 0 48 44" fill="none" aria-hidden="true">
            <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
            <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
          </svg>
          <span className="brand__text">
            <span className="brand__name">CRIVO</span>
            <span className="brand__sub">Decision Intelligence</span>
          </span>
        </div>
        <span className="login__pill">PORTAL EXECUTIVO</span>

        {/* ── Fim do fluxo: senha gravada ── */}
        {pronto ? (
          <>
            <h1 className="login__title">Senha alterada.</h1>
            <p className="login__sub">
              Sua nova senha já vale. Por segurança, encerramos as sessões que estavam abertas —
              entre de novo em todos os dispositivos.
            </p>
            <Link href="/" className="btn btn--gold btn--block" style={{ textAlign: "center" }}>
              Ir para o login →
            </Link>
          </>
        ) : token ? (
          /* ── Passo 2: o link foi aberto ── */
          conta ? (
            <>
              <h1 className="login__title">Escolha a nova senha.</h1>
              <p className="login__sub">
                Conta <strong>{conta.email}</strong> — {conta.company}.
              </p>
              <form className="login__form" onSubmit={gravar}>
                <div className="field">
                  <label htmlFor="np1">Nova senha</label>
                  <input
                    type="password"
                    id="np1"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder={`Pelo menos ${MIN_LEN} caracteres`}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="np2">Repita a nova senha</label>
                  <input
                    type="password"
                    id="np2"
                    value={repetir}
                    onChange={(e) => setRepetir(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn--gold btn--block" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar nova senha →"}
                </button>
                {erro && (
                  <p className="login__error is-visible" role="alert">
                    {erro}
                  </p>
                )}
              </form>
            </>
          ) : (
            <>
              <h1 className="login__title">Link inválido.</h1>
              <p className="login__sub">{erro ?? "Este link expirou ou já foi usado."}</p>
              <Link href="/nova-senha" className="btn btn--gold btn--block" style={{ textAlign: "center" }}>
                Pedir um link novo →
              </Link>
            </>
          )
        ) : enviado ? (
          /* ── Passo 1 concluído. Note que NÃO afirmamos que a conta existe. ── */
          <>
            <h1 className="login__title">Confira seu e-mail.</h1>
            <p className="login__sub">
              Se houver uma conta com <strong>{email}</strong>, enviamos um link para você escolher
              a nova senha. Ele vale por 60 minutos e só pode ser usado uma vez.
            </p>
            <p className="login__sub" style={{ fontSize: 13, opacity: 0.85 }}>
              Não chegou? Confira a caixa de spam ou tente de novo em alguns minutos.
            </p>
            <Link href="/" className="btn btn--gold btn--block" style={{ textAlign: "center" }}>
              Voltar ao login →
            </Link>
          </>
        ) : (
          /* ── Passo 1: pedir o link ── */
          <>
            <h1 className="login__title">Esqueceu a senha?</h1>
            <p className="login__sub">
              Informe o e-mail da sua conta. Enviamos um link para você mesmo definir a nova senha.
            </p>
            <form className="login__form" onSubmit={pedirLink}>
              <div className="field">
                <label htmlFor="fpEmail">E-mail corporativo</label>
                <input
                  type="email"
                  id="fpEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  autoComplete="username"
                  required
                />
              </div>
              <button type="submit" className="btn btn--gold btn--block" disabled={busy}>
                {busy ? "Enviando…" : "Enviar link de redefinição →"}
              </button>
              {erro && (
                <p className="login__error is-visible" role="alert">
                  {erro}
                </p>
              )}
            </form>
          </>
        )}

        <Link href="/" className="login__back">
          ← Voltar ao login
        </Link>
      </div>
    </div>
  );
}
