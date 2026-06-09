"use client";

import { useRef, useState } from "react";
import { createLogger } from "@crivo/ui/logger";
import styles from "./gate.module.css";

// 🔒 O token é validado no SERVIDOR (POST /api/gate), que devolve um cookie
//    httpOnly assinado. O middleware (src/middleware.ts) protege /lp e
//    /design-system. Nada de token no bundle nem validação client-side.
const DESTINO = "/lp";

const log = createLogger("crivo:portal");

export default function GatePage() {
  const cardRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("token") as HTMLInputElement;
    const token = input.value.trim();
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        log.info("acesso concedido");
        window.location.assign(DESTINO); // navegação completa garante o envio do cookie
        return;
      }
      throw new Error("invalid");
    } catch {
      setLoading(false);
      setError("Token inválido. Verifique e tente novamente.");
      log.warn("token inválido");
      const card = cardRef.current;
      if (card) {
        card.classList.remove(styles.shake);
        void card.offsetWidth; // reinicia a animação
        card.classList.add(styles.shake);
      }
      input.select();
    }
  }

  return (
    <div className={styles.body}>
      <main className={styles.card} ref={cardRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/assets/vai-logo.png" alt="VAI" />
        <span className={styles.eyebrow}>Portal Executivo</span>
        <h1 className={styles.title}>Acesso restrito</h1>
        <p className={styles.sub}>Informe seu token de acesso para entrar.</p>

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="token">
              Token de acesso
            </label>
            <input
              className={styles.input}
              type="password"
              id="token"
              name="token"
              placeholder="••••••••"
              required
              autoFocus
            />
          </div>
          <div className={styles.error} role="alert" aria-live="assertive">
            {error}
          </div>
          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className={styles.foot}>
          <strong>VAI</strong> · vai-sistema.com
        </p>
      </main>
    </div>
  );
}
