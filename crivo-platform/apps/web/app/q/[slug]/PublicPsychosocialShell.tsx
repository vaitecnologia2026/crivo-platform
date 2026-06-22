"use client";

import { useEffect, useState } from "react";
import { PublicPsychosocialForm } from "./PublicPsychosocialForm";

// Lê o slug do pathname no cliente (/q/<slug>). Necessário para compatibilidade
// com `output: 'export'` (Capacitor), onde o slug não é conhecido em build-time.
// No build web normal, o efeito também resolve o slug a partir da URL real.
function readSlugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const qIndex = parts.indexOf("q");
  if (qIndex === -1 || qIndex + 1 >= parts.length) return null;
  const slug = decodeURIComponent(parts[qIndex + 1]);
  // "_" é o placeholder do shell estático — não é um questionário real.
  if (!slug || slug === "_") return null;
  return slug;
}

export function PublicPsychosocialShell() {
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
        <p>Link de questionário inválido ou incompleto.</p>
      </div>
    );
  }

  return <PublicPsychosocialForm slug={slug} />;
}
