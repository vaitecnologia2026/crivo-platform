"use client";

import { useEffect, useState } from "react";
import { PublicDiagnosticForm } from "./PublicDiagnosticForm";

// Lê o slug do pathname no cliente (/d/<slug>) — compatível com output: 'export'.
function readSlugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const dIndex = parts.indexOf("d");
  if (dIndex === -1 || dIndex + 1 >= parts.length) return null;
  const slug = decodeURIComponent(parts[dIndex + 1]);
  if (!slug || slug === "_") return null;
  return slug;
}

export function PublicDiagnosticShell() {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSlug(readSlugFromPath());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!slug) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui" }}>
        <p>Link de diagnóstico inválido ou incompleto.</p>
      </div>
    );
  }

  return <PublicDiagnosticForm slug={slug} />;
}
