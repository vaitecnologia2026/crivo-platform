"use client";

import { useEffect, useState } from "react";
import type { PlatformLeadSummary } from "@crivo/types";
import { evaluateCnae, getLeadHistory, type CnaeDecisionResult, type CnaeRiskLevel, type LeadHistoryEvent } from "../../lib/admin-api";
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

/** Rótulos pt-BR dos eventos da trilha (o resto sai com o código cru). */
const EVENT_LABEL: Record<string, string> = {
  "lead.created": "Lead cadastrado",
  "lead.intake": "Respondeu o MAPA Executivo",
  "lead.first_contact": "1º contato registrado",
  "lead.stage": "Etapa alterada",
  "lead.archive": "Jornada concluída / arquivado",
  "lead.convert": "Convertido em cliente",
  "lead.send-access": "Acesso enviado por e-mail",
  "lead.user-password": "Senha do acesso alterada",
  "tenant.provision": "Empresa provisionada",
  "tenant.suspend": "Empresa suspensa",
  "tenant.activate": "Empresa reativada",
  "tenant.module.enable": "Módulo liberado",
  "tenant.module.disable": "Módulo desligado",
  "contract.create": "Contrato criado (ATIVO)",
  "contract.update": "Contrato alterado",
};
const STAGE_PT: Record<string, string> = {
  NOVO: "Novo", OPORTUNIDADE: "Em contato", PRE_DIAGNOSTICO: "Reunião", REUNIAO: "Reunião",
  PROPOSTA: "Proposta", NEGOCIACAO: "Negociação", FECHADO: "Fechado", CONTRATO: "Contrato",
  ONBOARDING: "Cliente ativo", IMPLANTACAO: "Implantação", ENTREGA: "Entrega", SUSTENTACAO: "Sustentação",
  RENOVACAO: "Renovação", UPSELL: "Upsell", PERDIDO: "Perdido",
};
function eventDetail(e: LeadHistoryEvent): string {
  const m = e.meta ?? {};
  switch (e.action) {
    case "lead.intake":
    case "lead.created":
      return [m.score != null ? `MAPA ${m.score}/100` : null, m.origin ? `origem: ${m.origin}` : null].filter(Boolean).join(" · ");
    case "lead.stage":
      return `→ ${STAGE_PT[String(m.stage)] ?? String(m.stage ?? "")}${m.lostReason ? ` (${m.lostReason})` : ""}`;
    case "lead.convert":
      return [m.product ? `solução: ${m.product}` : null, m.tenant ? `empresa: ${m.tenant}` : null].filter(Boolean).join(" · ");
    case "lead.send-access":
      return m.sent === false ? `não enviado${m.reason ? ` (${m.reason})` : ""}` : m.to ? `para ${m.to}` : "";
    case "tenant.module.enable":
    case "tenant.module.disable":
      return m.module ? String(m.module) : "";
    case "contract.create":
    case "contract.update":
      return [m.model, m.output, m.status].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

/** Mostra TODOS os dados capturados pelo CNPJ + a recomendação CNAE/NR-1 do lead + o histórico consolidado. */
export function LeadDataModal({ lead, onClose }: { lead: PlatformLeadSummary; onClose: () => void }) {
  const d = lead.cnpjData;
  const [rec, setRec] = useState<CnaeDecisionResult | null>(null);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [history, setHistory] = useState<LeadHistoryEvent[] | null | "erro">(null);

  useEffect(() => {
    let alive = true;
    getLeadHistory(lead.id)
      .then((h) => { if (alive) setHistory(h); })
      .catch(() => { if (alive) setHistory("erro"); });
    return () => { alive = false; };
  }, [lead.id]);

  useEffect(() => {
    if (!lead.cnpj && !d?.cnaeCodigo) {
      setRecErr("Lead sem CNPJ/CNAE — recomendação indisponível.");
      return;
    }
    const hc = Number((lead.employeesCount?.replace(/\./g, "").match(/\d+/) ?? [])[0]) || undefined;
    evaluateCnae({
      cnpj: lead.cnpj ?? undefined,
      razaoSocial: d?.razaoSocial ?? undefined,
      cnaePrincipalCodigo: d?.cnaeCodigo != null ? String(d.cnaeCodigo).padStart(7, "0") : undefined,
      cnaePrincipalDescricao: d?.cnaePrincipal ?? undefined,
      cnaesSecundarios: d?.cnaesSecundarios?.map((c) => c.codigo) ?? undefined,
      situacaoCadastral: d?.situacao ?? undefined,
      porte: d?.porte ?? undefined,
      numeroColaboradores: hc,
    })
      .then(setRec)
      .catch(() => setRecErr("Não foi possível calcular a recomendação."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const endereco = d
    ? [d.logradouro, d.numero, d.bairro, d.cidade && `${d.cidade}/${d.uf ?? ""}`, d.cep].filter(Boolean).join(", ")
    : "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 660 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{lead.company || lead.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar" title="Fechar">
            ✕
          </button>
        </div>
        <div className="modal__body">
          {/* ── Recomendação pelo CNAE (no topo: é o que importa) ── */}
          <span className="cnae-fieldset__legend">Recomendação CNAE/NR-1</span>
          {rec ? (
            <>
              <div className="cnae-card__hero" style={{ marginTop: 8 }}>
                <span className={`cnae-badge cnae-badge--${(rec.preliminaryRiskLevel ?? "baixo").toLowerCase()}`}>
                  Risco {rec.preliminaryRiskLevel ? RISK_LABEL[rec.preliminaryRiskLevel] : "—"}
                </span>
                <span className={`cnae-method cnae-method--${(rec.recommendedMethod ?? "na").toLowerCase()}`}>
                  {methodLabel(rec.recommendedMethod)}
                </span>
                {rec.divisionCode && (
                  <span className="cnae-score">divisão {rec.divisionCode}</span>
                )}
              </div>
              {rec.technicalOutputs.length > 0 && (
                <div className="cnae-chips" style={{ marginTop: 10 }}>
                  {rec.technicalOutputs.map((o) => (
                    <span key={o} className="cnae-chip">
                      {o}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--text,#3a352c)" }}>
                {rec.decisionReason}
              </p>
            </>
          ) : recErr ? (
            <p className="cnae-error">{recErr}</p>
          ) : (
            <p className="cnae-muted">Calculando recomendação pelo CNAE…</p>
          )}

          {/* ── Dados cadastrais capturados pelo CNPJ ── */}
          <span className="cnae-fieldset__legend" style={{ marginTop: 16, display: "block" }}>
            Dados cadastrais (capturados pelo CNPJ)
          </span>
          {d ? (
            <dl className="cnae-dl">
              <dt>CNPJ</dt>
              <dd>{lead.cnpj ?? d.cnpj ?? "—"}</dd>
              <dt>Razão social</dt>
              <dd>{d.razaoSocial ?? "—"}</dd>
              {d.nomeFantasia && (
                <>
                  <dt>Nome fantasia</dt>
                  <dd>{d.nomeFantasia}</dd>
                </>
              )}
              <dt>Situação</dt>
              <dd>{d.situacao ?? "—"}</dd>
              <dt>Porte</dt>
              <dd>{d.porte ?? "—"}</dd>
              <dt>Natureza jurídica</dt>
              <dd>{d.naturezaJuridica ?? "—"}</dd>
              <dt>Capital social</dt>
              <dd>{d.capitalSocial != null ? `R$ ${d.capitalSocial.toLocaleString("pt-BR")}` : "—"}</dd>
              <dt>CNAE principal</dt>
              <dd>
                <strong>{d.cnaeCodigo ?? "—"}</strong> · {d.cnaePrincipal ?? "—"}
              </dd>
              {d.cnaesSecundarios?.length > 0 && (
                <>
                  <dt>CNAEs secundários</dt>
                  <dd>{d.cnaesSecundarios.map((c) => `${c.codigo}${c.descricao ? ` (${c.descricao})` : ""}`).join("; ")}</dd>
                </>
              )}
              <dt>Endereço</dt>
              <dd>{endereco || "—"}</dd>
              <dt>Telefone</dt>
              <dd>{d.telefone ?? "—"}</dd>
              <dt>E-mail</dt>
              <dd>{d.email ?? "—"}</dd>
              {d.socios?.length > 0 && (
                <>
                  <dt>Sócios</dt>
                  <dd>{d.socios.map((s) => s.nome).filter(Boolean).join("; ") || "—"}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="cnae-muted">
              Nenhum dado de CNPJ capturado para este lead{lead.cnpj ? ` (CNPJ informado: ${lead.cnpj})` : ""}. O lead pode
              ter sido cadastrado sem CNPJ ou antes do enriquecimento.
            </p>
          )}

          {/* ── Dados do formulário ── */}
          <span className="cnae-fieldset__legend" style={{ marginTop: 16, display: "block" }}>
            Dados do formulário (MAPA Executivo CRIVO™)
          </span>
          <dl className="cnae-dl">
            <dt>Contato</dt>
            <dd>{lead.name}</dd>
            <dt>Segmento</dt>
            <dd>{lead.segment ?? "—"}</dd>
            <dt>Colaboradores</dt>
            <dd>{lead.employeesCount ?? "—"}</dd>
            <dt>E-mail / Telefone</dt>
            <dd>{[lead.email, lead.phone].filter(Boolean).join(" · ") || "—"}</dd>
            {/* O MAPA é a leitura de entrada, não um diagnóstico: o diagnóstico
                é a solução contratada, aplicada depois da conversão. */}
            <dt>MAPA Executivo</dt>
            <dd>{lead.diagnosticScore != null ? `${lead.diagnosticScore}/100 (leitura preliminar — não é diagnóstico)` : "não respondido"}</dd>
            {lead.notes && (
              <>
                <dt>Observações</dt>
                <dd style={{ whiteSpace: "pre-line" }}>{lead.notes}</dd>
              </>
            )}
          </dl>

          {/* ── Histórico consolidado ── */}
          <span className="cnae-fieldset__legend" style={{ marginTop: 16, display: "block" }}>
            Histórico do lead
          </span>
          {history === null ? (
            <p className="card__sub">Carregando histórico…</p>
          ) : history === "erro" ? (
            <p className="card__sub">Não foi possível carregar o histórico.</p>
          ) : history.length === 0 ? (
            <p className="card__sub">Nenhum evento registrado.</p>
          ) : (
            <dl className="cnae-dl">
              {history.map((e) => (
                <div key={e.id} style={{ display: "contents" }}>
                  <dt>{new Date(e.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dt>
                  <dd>
                    <strong>{EVENT_LABEL[e.action] ?? e.action}</strong>
                    {eventDetail(e) ? ` — ${eventDetail(e)}` : ""}
                    {e.actorEmail ? <span className="card__sub"> · {e.actorEmail}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
