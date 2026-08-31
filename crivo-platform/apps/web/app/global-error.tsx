"use client";

import { useEffect } from "react";
import { currentScreen, reportClientError } from "@/lib/error-report";

/**
 * Rede de segurança de último nível: erro no layout raiz, onde nem o `error.tsx`
 * chega a montar. Precisa renderizar <html> e <body> por conta própria.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(process.env.NEXT_PUBLIC_API_URL ?? "", {
      app: currentScreen().startsWith("/superadm") ? "superadm" : "portal",
      screen: `raiz ${currentScreen()}`,
      message: `${error.name}: ${error.message}`,
      kind: "tela",
      requestId: error.digest,
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          margin: 0,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#1b2a4a",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>A plataforma não conseguiu carregar</h1>
        <p style={{ color: "#5a6478", maxWidth: 460, lineHeight: 1.6 }}>
          O erro foi registrado automaticamente. Informe o código abaixo ao suporte.
        </p>
        <p style={{ fontFamily: "monospace", background: "#f3f4f7", padding: "6px 12px", borderRadius: 6 }}>
          {error.digest ?? "sem código"}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "10px 20px",
            border: "1px solid #1b2a4a",
            borderRadius: 6,
            background: "#1b2a4a",
            color: "#fff",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
