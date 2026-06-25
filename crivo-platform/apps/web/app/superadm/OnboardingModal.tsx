"use client";

import { useEffect, useState } from "react";
import type { PlatformLeadSummary, TenantSummary } from "@crivo/types";
import {
  evaluateFromCnpj,
  listLeads,
  type CnaeDecisionResult,
  type CnaeRiskLevel,
} from "../../lib/admin-api";
import "./cnae.css";

const RISK_LABEL: Record<CnaeRiskLevel, string> = {
  BAIXO: "Baixo",
  BAIXO_MEDIO: "Baixo/Médio",
  MEDIO: "Médio",
  MEDIO_ALTO: "Médio/Alto",
  ALTO: "Alto",
};

const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

function parseHeadcount(range?: string | null): number | undefined {
  if (!range) return undefined;
  const m = range.replace(/\./g, "").match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

/** Tela de Onboarding da empresa-cliente: dados cadastrais (CNPJ) + enquadramento
 * NR-1 + checklist de ativação. Cruza o tenant com o lead de origem. */
export function OnboardingModal({ tenant, onClose }: { tenant: TenantSummary; onClose: () => void }) {
  const [lead, setLead] = useState<PlatformLeadSummary | null | undefined>(undefined);
  const [rec, setRec] = useState<CnaeDecisionResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const leads = await listLeads();
        const l = leads.find((x) => x.convertedTenantId === tenant.id) ?? null;
        if (!alive) return;
        setLead(l);
        if (l?.cnpj) {
          const r = await evaluateFromCnpj({ cnpj: l.cnpj, numeroColaboradores: parseHeadcount(l.employeesCount) });
          if (alive) setRec(r.decision);
        }
      } catch {
        if (alive) setLead(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenant.id]);

  const d = lead?.cnpjData;
  const endereco = d
    ? [d.logradouro, d.numero, d.bairro, d.cidade && `${d.cidade}/${d.uf ?? ""}`, d.cep].filter(Boolean).join(", ")
    : "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 680 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>Onboarding · {tenant.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar" title="Fechar">
            ✕
          </button>
        </div>
        <div className="modal__body">
          {/* Status da conta */}
          <div className="cnae-card__hero" style={{ marginBottom: 14 }}>
            <span className="cnae-method cnae-method--organizacional">Plano {PLAN_LABEL[tenant.plan] ?? tenant.plan}</span>
            <span className={`cnae-badge cnae-badge--${tenant.status === "ACTIVE" ? "baixo" : "alto"}`}>
              {tenant.status === "ACTIVE" ? "Ativa" : tenant.status}
            </span>
            {rec?.preliminaryRiskLevel && (
              <span className={`cnae-badge cnae-badge--${rec.preliminaryRiskLevel.toLowerCase()}`}>
                Risco {RISK_LABEL[rec.preliminaryRiskLevel]}
              </span>
            )}
          </div>

          {lead === undefined && <p className="cnae-muted">Carregando dados da empresa…</p>}

          {/* Enquadramento NR-1 */}
          {rec && (
            <div className="cnae-block">
              <h4>Enquadramento NR-1</h4>
              <p style={{ margin: "0 0 8px" }}>
                Método: <strong>{rec.recommendedMethod === "ORGANIZACIONAL" ? "Diagnóstico Organizacional" : rec.recommendedMethod === "ESSENCIAL" ? "Diagnóstico Essencial" : "Dispensa NR-1"}</strong>
                {rec.divisionCode ? ` · divisão CNAE ${rec.divisionCode}` : ""}
              </p>
              {rec.technicalOutputs.length > 0 && (
                <div className="cnae-chips">
                  {rec.technicalOutputs.map((o) => (
                    <span key={o} className="cnae-chip">
                      {o}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dados cadastrais */}
          <div className="cnae-block">
            <h4>Dados cadastrais</h4>
            <dl className="cnae-dl">
              <dt>Razão social</dt>
              <dd>{d?.razaoSocial ?? tenant.name}</dd>
              {d?.nomeFantasia && (
                <>
                  <dt>Nome fantasia</dt>
                  <dd>{d.nomeFantasia}</dd>
                </>
              )}
              <dt>CNPJ</dt>
              <dd>{lead?.cnpj ?? "—"}</dd>
              <dt>Situação</dt>
              <dd>{d?.situacao ?? "—"}</dd>
              <dt>Porte</dt>
              <dd>{d?.porte ?? "—"}</dd>
              <dt>CNAE principal</dt>
              <dd>
                {d?.cnaeCodigo ? <strong>{d.cnaeCodigo}</strong> : "—"} · {d?.cnaePrincipal ?? "—"}
              </dd>
              {d && d.cnaesSecundarios.length > 0 && (
                <>
                  <dt>CNAEs secundários</dt>
                  <dd>{d.cnaesSecundarios.map((c) => c.codigo).join(", ")}</dd>
                </>
              )}
              <dt>Endereço</dt>
              <dd>{endereco || "—"}</dd>
            </dl>
          </div>

          {/* Contato + acesso */}
          <div className="cnae-block">
            <h4>Contato &amp; acesso</h4>
            <dl className="cnae-dl">
              <dt>Responsável</dt>
              <dd>{lead?.name ?? "—"}</dd>
              <dt>E-mail (login admin)</dt>
              <dd>{lead?.email ?? "—"}</dd>
              <dt>Telefone</dt>
              <dd>{lead?.phone ?? d?.telefone ?? "—"}</dd>
              <dt>Nº de colaboradores</dt>
              <dd>{lead?.employeesCount ?? "—"}</dd>
            </dl>
          </div>

          {/* Checklist de onboarding */}
          <div className="cnae-block">
            <h4>Checklist de ativação</h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
              <li>✓ Empresa provisionada (sistema liberado)</li>
              <li>{lead?.email ? "✓" : "○"} Acesso do admin definido ({lead?.email ?? "definir e-mail"})</li>
              <li>{rec?.recommendedMethod ? "✓" : "○"} Método de diagnóstico definido pelo enquadramento NR-1</li>
              <li>○ Contrato enviado/assinado (ver aba Contrato)</li>
              <li>○ Cobrança/pagamento ativado (ver Integrações)</li>
            </ul>
          </div>

          {lead === null && (
            <p className="cnae-muted" style={{ marginTop: 8 }}>
              Sem lead de origem vinculado — empresa criada manualmente. Os dados cadastrais via CNPJ não estão disponíveis.
            </p>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
