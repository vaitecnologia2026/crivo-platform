import type { CSSProperties, ReactNode } from "react";

// Casca visual compartilhada das páginas legais (termos, privacidade, exclusão).
// Server component, conteúdo estático. Estilos inline com as cores da marca para
// não depender do CSS global de marketing.

const C = { azul: "#0d1f3c", terra: "#c4894a", text: "#1a1a1a", sec: "#5c6470" };

const styles: Record<string, CSSProperties> = {
  main: {
    fontFamily: "var(--font-poppins), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    maxWidth: 760,
    margin: "0 auto",
    padding: "2rem 1.25rem 4rem",
    color: C.text,
    lineHeight: 1.65,
  },
  h1: { color: C.azul, fontSize: "1.8rem", marginBottom: ".5rem" },
  meta: { color: C.sec, fontSize: ".9rem", marginTop: 0 },
};

export function LegalPage({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>{title}</h1>
      <p style={styles.meta}>{meta}</p>
      {children}
    </main>
  );
}

export const legalStyles = {
  h2: { color: C.azul, fontSize: "1.2rem", marginTop: "2rem" } as CSSProperties,
  a: { color: C.terra } as CSSProperties,
};
