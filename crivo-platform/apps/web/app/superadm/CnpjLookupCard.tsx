"use client";

import { useState } from "react";
import type { ProductSummary } from "@crivo/types";
import {
  createLeadFromCnpj,
  evaluateFromCnpj,
  listProducts,
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

type ProvResult = Awaited<ReturnType<typeof createLeadFromCnpj>>;

/** Ferramenta do Dashboard: digita o CNPJ → dados da empresa + enquadramento NR-1,
 * e ações "Salvar como lead" / "Converter em cliente" usando a API vinculada. */
export function CnpjLookupCard() {
  const [cnpj, setCnpj] = useState("");
  const [hc, setHc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [company, setCompany] = useState<CnpjCompanyData | null>(null);
  const [rec, setRec] = useState<CnaeDecisionResult | null>(null);

  // Ações sobre o resultado.
  const [prov, setProv] = useState<ProvResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [productId, setProductId] = useState("");
  const [email, setEmail] = useState("");
  const [actBusy, setActBusy] = useState<"save" | "convert" | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);

  function resetActions() {
    setProv(null);
    setConverting(false);
    setProductId("");
    setEmail("");
    setActErr(null);
  }

  async function consultar() {
    if (!cnpj.replace(/\D/g, "")) return;
    setBusy(true);
    setErr(null);
    setCompany(null);
    setRec(null);
    resetActions();
    try {
      const r = await evaluateFromCnpj({ cnpj, numeroColaboradores: hc ? Number(hc) : undefined });
      if (!r.company) setErr("CNPJ não encontrado ou indisponível no provedor.");
      else {
        setCompany(r.company);
        setRec(r.decision);
        setEmail(r.company.email ?? "");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setBusy(false);
    }
  }

  async function salvarLead() {
    setActBusy("save");
    setActErr(null);
    try {
      setProv(await createLeadFromCnpj({ cnpj, numeroColaboradores: hc ? Number(hc) : undefined }));
    } catch (e) {
      setActErr(e instanceof Error ? e.message : "Falha ao salvar o lead.");
    } finally {
      setActBusy(null);
    }
  }

  async function abrirConverter() {
    setConverting(true);
    if (!products) {
      try {
        setProducts((await listProducts()).filter((p) => !p.isLeadCapture && p.status === "ACTIVE"));
      } catch {
        setProducts([]);
      }
    }
  }

  async function converter() {
    if (!productId) return;
    setActBusy("convert");
    setActErr(null);
    try {
      setProv(
        await createLeadFromCnpj({
          cnpj,
          numeroColaboradores: hc ? Number(hc) : undefined,
          email: email.trim() || undefined,
          productId,
        }),
      );
    } catch (e) {
      setActErr(e instanceof Error ? e.message : "Falha ao converter em cliente.");
    } finally {
      setActBusy(null);
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

          {/* Ações: salvar como lead / converter em cliente */}
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border, #eee7db)", paddingTop: 14 }}>
            {prov?.adminEmail ? (
              <div className="cnae-block">
                <h4>Empresa-cliente criada ✓</h4>
                <p>
                  <strong>{prov.lead.company ?? prov.lead.name}</strong> provisionada.
                </p>
                <p style={{ fontSize: 12.5 }}>
                  Login: <strong>{prov.adminEmail}</strong> · Senha temporária:{" "}
                  <code style={{ background: "var(--panel-soft,#f0ebe1)", padding: "1px 6px", borderRadius: 4 }}>
                    {prov.tempPassword}
                  </code>
                </p>
              </div>
            ) : prov?.lead ? (
              <p className="cnae-note">Lead salvo no CRM (Funil) ✓ — {prov.lead.company ?? prov.lead.name}.</p>
            ) : (
              <>
                <div className="cnae-actions">
                  <button className="btn" onClick={salvarLead} disabled={actBusy !== null}>
                    {actBusy === "save" ? "Salvando…" : "Salvar como lead"}
                  </button>
                  <button className="btn btn--primary" onClick={abrirConverter} disabled={actBusy !== null}>
                    Converter em cliente
                  </button>
                </div>
                {converting && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    >
                      <option value="">Selecione o produto…</option>
                      {(products ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="e-mail do cliente (acesso admin)"
                      style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    />
                    <button
                      className="btn btn--primary"
                      onClick={converter}
                      disabled={actBusy !== null || !productId || !email.trim()}
                    >
                      {actBusy === "convert" ? "Convertendo…" : "Confirmar conversão"}
                    </button>
                  </div>
                )}
              </>
            )}
            {actErr && (
              <p className="cnae-error" style={{ marginTop: 8 }}>
                {actErr}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
