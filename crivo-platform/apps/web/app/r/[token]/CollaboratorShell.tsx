"use client";

import { useEffect, useState } from "react";
import { PublicPsychosocialForm } from "../../q/[slug]/PublicPsychosocialForm";
import { verifyCollab, submitCollab } from "@/lib/api";
import { formatCpf, isValidCpf, normalizeCpf, type PsychosocialQuestion } from "@crivo/types";
import s from "../../q/[slug]/public.module.css";

function readTokenFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("r");
  if (i === -1 || i + 1 >= parts.length) return null;
  const token = decodeURIComponent(parts[i + 1]);
  if (!token || token === "_") return null;
  return token;
}

type Verified = { name: string; sector: string | null; tenantName: string; questions: PsychosocialQuestion[] };

export function CollaboratorShell() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"gate" | "answered" | "form">("gate");
  const [verified, setVerified] = useState<Verified | null>(null);

  useEffect(() => {
    setToken(readTokenFromPath());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui" }}>
        <p>Link inválido ou incompleto.</p>
      </div>
    );
  }

  async function acessar() {
    if (!token) return;
    if (!isValidCpf(cpf)) { setErr("Informe um CPF válido."); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await verifyCollab(token, normalizeCpf(cpf));
      if (r.answered) {
        setPhase("answered");
      } else {
        setVerified({
          name: r.name ?? "",
          sector: r.sector ?? null,
          tenantName: r.tenantName ?? "sua empresa",
          questions: r.questions ?? [],
        });
        setPhase("form");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível validar o CPF.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "answered") {
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <div className={s.result}>
            <span className={s.pill}>Participação registrada</span>
            <p className={s.sub} style={{ marginTop: 12 }}>
              Você já respondeu este diagnóstico. <strong>Obrigado pela participação!</strong> As respostas são
              anônimas e tratadas de forma agregada.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "form" && verified) {
    return (
      <PublicPsychosocialForm
        slug={token}
        rotulo="Diagnóstico da sua empresa"
        setorFixo={verified.sector}
        carregar={async () => ({ tenantName: verified.tenantName, questions: verified.questions })}
        enviar={async (_t, body) => submitCollab(token, { cpf: normalizeCpf(cpf), answers: body.answers })}
      />
    );
  }

  // phase === "gate": pede o CPF
  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.result}>
          <span className={s.pill}>Acesso ao diagnóstico</span>
          <p className={s.sub} style={{ marginTop: 12 }}>
            Para acessar o diagnóstico da sua empresa, informe o seu <strong>CPF</strong>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "16px auto 0" }}>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              placeholder="000.000.000-00"
              onChange={(e) => setCpf(formatCpf(normalizeCpf(e.target.value)))}
              onKeyDown={(e) => { if (e.key === "Enter") void acessar(); }}
              style={{ padding: "12px 14px", border: "1px solid var(--line,#DCD7CE)", borderRadius: 8, font: "inherit", textAlign: "center" }}
            />
            <button className="btn btn--terra btn--block" disabled={busy} onClick={acessar} style={{ padding: "12px 14px" }}>
              {busy ? "Validando…" : "Acessar diagnóstico"}
            </button>
            {err && <p style={{ color: "#c0392b", fontSize: 13, margin: 0, textAlign: "center" }}>{err}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
