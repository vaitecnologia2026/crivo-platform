"use client";

import { useEffect } from "react";
import { currentScreen, reportClientError } from "@/lib/error-report";

/**
 * Tela que quebra deixa de sumir em silêncio.
 *
 * Sem este arquivo, um erro de render derrubava a página e não sobrava rastro
 * em lugar nenhum: nem no navegador do usuário (que via a tela de erro padrão),
 * nem no servidor (nada chega até ele). Agora o erro é relatado à API — é um
 * dos dois casos que o log do servidor não consegue enxergar sozinho — e o
 * usuário recebe um código para dizer ao suporte.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(process.env.NEXT_PUBLIC_API_URL ?? "", {
      // A mesma tela serve portal e super admin; o caminho diz qual é.
      app: currentScreen().startsWith("/superadm") ? "superadm" : "portal",
      screen: currentScreen(),
      message: `${error.name}: ${error.message}`,
      kind: "tela",
      requestId: error.digest,
    });
  }, [error]);

  return (
    <div style={wrap}>
      <h1 style={title}>Algo quebrou nesta tela</h1>
      <p style={text}>
        O erro foi registrado automaticamente. Se precisar falar com o suporte, informe o código abaixo.
      </p>
      <p style={code}>{error.digest ?? "sem código"}</p>
      <button type="button" onClick={reset} style={button}>
        Tentar de novo
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "60vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 24,
  textAlign: "center",
  fontFamily: "var(--font-poppins), system-ui, sans-serif",
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 500, color: "#1b2a4a", margin: 0 };
const text: React.CSSProperties = { color: "#5a6478", maxWidth: 460, margin: 0, lineHeight: 1.6 };
const code: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains), monospace",
  background: "#f3f4f7",
  color: "#1b2a4a",
  padding: "6px 12px",
  borderRadius: 6,
  margin: 0,
};
const button: React.CSSProperties = {
  marginTop: 8,
  padding: "10px 20px",
  border: "1px solid #1b2a4a",
  borderRadius: 6,
  background: "#1b2a4a",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
};
