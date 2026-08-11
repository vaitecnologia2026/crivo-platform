import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

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
  // §14 — sem nav nem rodapé, estas páginas eram becos sem saída: quem chegava
  // por busca não tinha nenhum caminho de volta para o site.
  voltar: {
    display: "inline-block",
    marginBottom: "1.5rem",
    color: C.sec,
    fontSize: ".9rem",
    textDecoration: "none",
  },
  rodape: {
    marginTop: "3rem",
    paddingTop: "1.25rem",
    borderTop: "1px solid #e4e0d8",
    color: C.sec,
    fontSize: ".85rem",
    display: "flex",
    gap: "1.1rem",
    flexWrap: "wrap",
  },
};

export function LegalPage({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <main style={styles.main}>
      <Link href="/" style={styles.voltar}>
        ← Voltar para o site da CRIVO
      </Link>
      <h1 style={styles.h1}>{title}</h1>
      <p style={styles.meta}>{meta}</p>
      {children}
      <nav style={styles.rodape} aria-label="Outras páginas legais">
        <Link href="/politica-de-privacidade" style={{ color: C.sec }}>Política de Privacidade</Link>
        <Link href="/politica-de-cookies" style={{ color: C.sec }}>Política de Cookies</Link>
        <Link href="/termos" style={{ color: C.sec }}>Termos de Uso</Link>
        <Link href="/excluir-conta" style={{ color: C.sec }}>Excluir conta</Link>
        <Link href="/excluir-dados" style={{ color: C.sec }}>Excluir dados</Link>
      </nav>
    </main>
  );
}

export const legalStyles = {
  h2: { color: C.azul, fontSize: "1.2rem", marginTop: "2rem" } as CSSProperties,
  a: { color: C.terra } as CSSProperties,
};
