"use client";

import { useState } from "react";
import {
  evaluateFromCnpj,
  type CnaeDecisionResult,
  type CnaeRiskLevel,
  type CnpjCompanyData,
} from "../../lib/admin-api";
import "./cnae.css";

const RISK_LABEL: Record<CnaeRiskLevel, string> = {
  BAIXO: "Baixo",
  BAIXO_MEDIO: "Baixo/Médio",
  MEDIO: "Médio",
  MEDIO_ALTO: "Médio/Alto",
  ALTO: "Alto",
};

function methodLabel(m?: string | null) {
  return m === "ORGANIZACIONAL" ? "Diagnóstico Organizacional" : m === "ESSENCIAL" ? "Diagnóstico Essencial" : "—";
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border, #ddd6ca)",
  borderRadius: 8,
  padding: "9px 11px",
  font: "inherit",
  fontSize: 13,
};

/** Ferramenta do Dashboard: digita o CNPJ → dados da empresa + enquadramento NR-1. */
export function CnpjLookupCard() {
  const [cnpj, setCnpj] = useState("");
  const [hc, setHc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [company, setCompany] = useState<CnpjCompanyData | null>(null);
  const [rec, setRec] = useState<CnaeDecisionResult | null>(null);

  async function consultar() {
    if (!cnpj.replace(/\D/g, "")) return;
    setBusy(true);
    setErr(null);
    setCompany(null);
    setRec(null);
    try {
      const r = await evaluateFromCnpj({ cnpj, numeroColaboradores: hc ? Number(hc) : undefined });
      if (!r.company) setErr("CNPJ não encontrado ou indisponível no provedor.");
      else {
        setCompany(r.company);
        setRec(r.decision);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setBusy(false);
    }
  }

  const d = company;
  const endereco = d?.endereco
    ? [
        d.endereco.logradouro,
        d.endereco.numero,
        d.endereco.bairro,
        d.endereco.municipio && `${d.endereco.municipio}/${d.endereco.uf ?? ""}`,
        d.endereco.cep,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 4px" }}>Consultar CNPJ</h3>
      <p className="cnae-muted" style={{ margin: "0 0 14px" }}>
        Digite o CNPJ para puxar os dados da empresa (API vinculada) e o enquadramento NR-1. Informe o nº de
        funcionários para o método exato (corte em 9).
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && consultar()}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          style={{ ...inputStyle, flex: 2, minWidth: 200 }}
        />
        <input
          value={hc}
          onChange={(e) => setHc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && consultar()}
          type="number"
          min={0}
          placeholder="nº funcionários"
          style={{ ...inputStyle, flex: 1, minWidth: 130 }}
        />
        <button className="btn btn--primary" onClick={consultar} disabled={busy}>
          {busy ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {err && (
        <p className="cnae-error" style={{ marginTop: 12 }}>
          {err}
        </p>
      )}

      {d && (
        <div style={{ marginTop: 16 }}>
          {rec && (
            <>
              <div className="cnae-card__hero" style={{ marginBottom: 12 }}>
                <span className={`cnae-badge cnae-badge--${(rec.preliminaryRiskLevel ?? "baixo").toLowerCase()}`}>
                  Risco {rec.preliminaryRiskLevel ? RISK_LABEL[rec.preliminaryRiskLevel] : "—"}
                </span>
                <span className={`cnae-method cnae-method--${(rec.recommendedMethod ?? "na").toLowerCase()}`}>
                  {rec.recommendedMethod ? methodLabel(rec.recommendedMethod) : "Dispensa NR-1"}
                </span>
                {rec.divisionCode && <span className="cnae-score">divisão {rec.divisionCode}</span>}
              </div>
              {rec.technicalOutputs.length > 0 && (
                <div className="cnae-chips" style={{ marginBottom: 12 }}>
                  {rec.technicalOutputs.map((o) => (
                    <span key={o} className="cnae-chip">
                      {o}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <dl className="cnae-dl">
            <dt>Razão social</dt>
            <dd>{d.razaoSocial ?? "—"}</dd>
            {d.nomeFantasia && (
              <>
                <dt>Nome fantasia</dt>
                <dd>{d.nomeFantasia}</dd>
              </>
            )}
            <dt>CNPJ</dt>
            <dd>{d.cnpj}</dd>
            <dt>Situação</dt>
            <dd>{d.situacaoCadastral ?? "—"}</dd>
            <dt>Porte</dt>
            <dd>{d.porte ?? "—"}</dd>
            <dt>CNAE principal</dt>
            <dd>
              <strong>{d.cnaePrincipalCodigo ?? "—"}</strong> · {d.cnaePrincipalDescricao ?? "—"}
            </dd>
            {d.cnaesSecundarios.length > 0 && (
              <>
                <dt>CNAEs secundários</dt>
                <dd>{d.cnaesSecundarios.map((c) => c.codigo).join(", ")}</dd>
              </>
            )}
            <dt>Endereço</dt>
            <dd>{endereco || "—"}</dd>
            <dt>Contato</dt>
            <dd>{[d.telefone, d.email].filter(Boolean).join(" · ") || "—"}</dd>
          </dl>

          {rec?.decisionReason && (
            <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-muted, #8a8174)" }}>
              {rec.decisionReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
