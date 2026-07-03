"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getPublicCampaign } from "@/lib/api";

type Campaign = {
  name: string;
  description: string | null;
  sector: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  tenantName: string;
};

// Lê o slug do pathname no cliente (/p/c/<slug>). Compatível com export estático
// (Capacitor), onde o slug não é conhecido em build-time.
function readSlug(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const p = parts.indexOf("p");
  if (p === -1 || parts[p + 1] !== "c" || p + 2 >= parts.length) return null;
  const slug = decodeURIComponent(parts[p + 2]);
  if (!slug || slug === "_") return null;
  return slug;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  DRAFT: "Rascunho",
};

const WRAP: CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  padding: "2rem",
  background: "#F2F0EC",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#22303F",
};
const CARD: CSSProperties = {
  maxWidth: 480,
  width: "100%",
  background: "#fff",
  borderRadius: 16,
  padding: "2rem",
  boxShadow: "0 12px 40px rgba(20,38,60,.12)",
  borderTop: "4px solid #A8693D",
};

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#14263C" }}>
      <svg viewBox="0 0 48 44" fill="none" aria-hidden="true" style={{ width: 34, height: 32 }}>
        <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="6" r="3.6" fill="#A8693D" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <b style={{ letterSpacing: ".12em" }}>CRIVO</b>
        <span style={{ fontSize: 11, color: "#5B6B7B" }}>Decision Intelligence</span>
      </span>
    </div>
  );
}

export function PublicCampaignShell() {
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "invalid" | "ok">("loading");
  const [data, setData] = useState<Campaign | null>(null);

  useEffect(() => {
    setSlug(readSlug());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!slug) {
      setStatus("invalid");
      return;
    }
    let alive = true;
    getPublicCampaign(slug)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStatus("ok");
      })
      .catch(() => {
        if (alive) setStatus("invalid");
      });
    return () => {
      alive = false;
    };
  }, [ready, slug]);

  if (!ready || status === "loading") {
    return (
      <div style={WRAP}>
        <p>Carregando campanha…</p>
      </div>
    );
  }

  if (status === "invalid" || !data) {
    return (
      <div style={WRAP}>
        <div style={CARD}>
          <Brand />
          <p style={{ marginTop: 16 }}>Link de campanha inválido, expirado ou incompleto.</p>
        </div>
      </div>
    );
  }

  const open = data.status === "OPEN";
  return (
    <div style={WRAP}>
      <div style={CARD}>
        <Brand />
        <p
          style={{
            color: "#A8693D",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            margin: "18px 0 4px",
          }}
        >
          Campanha de Diagnóstico
        </p>
        <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#14263C" }}>{data.name}</h1>
        <p style={{ color: "#5B6B7B", margin: "0 0 16px" }}>
          {data.tenantName}
          {data.sector ? ` · ${data.sector}` : ""}
        </p>
        {data.description && (
          <p style={{ lineHeight: 1.6, marginBottom: 16 }}>{data.description}</p>
        )}
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 99,
            background: open ? "#EAF4EE" : "#F3EFE9",
            color: open ? "#2E7D4F" : "#8A6D1F",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {STATUS_LABEL[data.status] ?? data.status}
        </span>
        <p style={{ marginTop: 20, fontSize: 14, color: "#5B6B7B", lineHeight: 1.6 }}>
          {open
            ? "Sua empresa está conduzindo esta campanha pela CRIVO. Acesse o portal com o seu login para participar, ou fale com o responsável pela campanha na sua organização."
            : "Esta campanha não está aberta para respostas no momento."}
        </p>
      </div>
    </div>
  );
}
