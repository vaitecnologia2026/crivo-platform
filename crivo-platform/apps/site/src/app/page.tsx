"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createLogger } from "@crivo/ui/logger";
import styles from "./gate.module.css";

// ⚙️ Token de acesso do portal VAI. Barreira leve client-side (não é segurança forte).
//    Proteção real → Vercel Password Protection / proxy (follow-up).
const ACCESS_TOKEN = "VAI2026";
const DESTINO = "/lp";

const log = createLogger("crivo:portal");

export default function GatePage() {
  const router = useRouter();
  const cardRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("token") as HTMLInputElement;
    if (input.value.trim() === ACCESS_TOKEN) {
      try {
        sessionStorage.setItem("vai_access", "granted");
      } catch {
        /* sessionStorage indisponível */
      }
      setError("");
      log.info("acesso concedido");
      router.push(DESTINO);
    } else {
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
          <div className={styles.error}>{error}</div>
          <button className={styles.button} type="submit">
            Entrar
          </button>
        </form>

        <p className={styles.foot}>
          <strong>VAI</strong> · vai-sistema.com
        </p>
      </main>
    </div>
  );
}
