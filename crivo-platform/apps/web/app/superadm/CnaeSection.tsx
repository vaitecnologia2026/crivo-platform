"use client";

import { useEffect, useState } from "react";
import {
  consultCnpj,
  evaluateFromCnpj,
  listCnaeDivisions,
  listCnaeHistory,
  updateCnaeDivision,
  type CnaeDecisionHistoryItem,
  type CnaeDecisionResult,
  type CnaeDivisionRule,
  type CnaeEvaluationInputPayload,
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
const RISK_OPTIONS: CnaeRiskLevel[] = ["BAIXO", "BAIXO_MEDIO", "MEDIO", "MEDIO_ALTO", "ALTO"];

function riskClass(r?: string | null) {
  return r ? `cnae-badge cnae-badge--${r.toLowerCase()}` : "cnae-badge";
}

const TRIGGERS: { key: keyof CnaeEvaluationInputPayload; label: string }[] = [
  { key: "possuiEquipeOperacional", label: "Equipe operacional" },
  { key: "possuiAtendimentoPublico", label: "Atendimento ao público" },
  { key: "possuiTurnos", label: "Trabalho em turnos" },
  { key: "possuiTrabalhoExterno", label: "Trabalho externo / campo" },
  { key: "possuiMultiplasUnidades", label: "Múltiplas unidades" },
  { key: "possuiMetasComerciaisIntensas", label: "Metas comerciais intensas" },
  { key: "possuiHistoricoAfastamentos", label: "Histórico de afastamentos" },
  { key: "demandaNr1Completa", label: "Demanda por NR-1 completa" },
];

export function CnaeSection() {
  const [tab, setTab] = useState<"avaliar" | "regras" | "historico">("avaliar");
  return (
    <div className="route">
      <div className="route__head">
        <div>
          <h2>Motor de Enquadramento CRIVO</h2>
          <p className="route__sub">
            Classificação preliminar técnica por divisão CNAE → método de diagnóstico + saídas técnicas.
            Não substitui laudo ou parecer; sujeito à validação por especialista.
          </p>
        </div>
      </div>

      <div className="cnae-tabs">
        <button className={`cnae-tab${tab === "avaliar" ? " is-active" : ""}`} onClick={() => setTab("avaliar")}>
          Avaliar empresa
        </button>
        <button className={`cnae-tab${tab === "regras" ? " is-active" : ""}`} onClick={() => setTab("regras")}>
          Regras CNAE (87)
        </button>
        <button className={`cnae-tab${tab === "historico" ? " is-active" : ""}`} onClick={() => setTab("historico")}>
          Histórico
        </button>
      </div>

      {tab === "avaliar" && <EvaluateTab />}
      {tab === "regras" && <RulesTab />}
      {tab === "historico" && <HistoryTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avaliar empresa: consulta CNPJ → preenche dados → roda o motor → card.
// ─────────────────────────────────────────────────────────────────────────────
function EvaluateTab() {
  const [cnpj, setCnpj] = useState("");
  const [form, setForm] = useState<CnaeEvaluationInputPayload>({});
  const [company, setCompany] = useState<CnpjCompanyData | null>(null);
  const [decision, setDecision] = useState<CnaeDecisionResult | null>(null);
  const [busy, setBusy] = useState<"consult" | "evaluate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCnpj("");
    setForm({});
    setCompany(null);
    setDecision(null);
    setError(null);
  }

  async function doConsult() {
    if (!cnpj.replace(/\D/g, "")) return;
    setError(null);
    setBusy("consult");
    setDecision(null);
    try {
      const r = await consultCnpj(cnpj);
      if (!r.ok || !r.data) {
        setError(r.error || "CNPJ não encontrado no provedor.");
        setCompany(null);
      } else {
        setCompany(r.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setBusy(null);
    }
  }

  async function doEvaluate() {
    setError(null);
    setBusy("evaluate");
    try {
      const r = await evaluateFromCnpj({ ...form, cnpj });
      setCompany(r.company ?? company);
      setDecision(r.decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na avaliação.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cnae-grid">
      <div className="card cnae-form">
        <label className="cnae-field">
          <span>CNPJ da empresa</span>
          <div className="cnae-cnpj-row">
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
            <button className="btn btn--primary" onClick={doConsult} disabled={busy !== null}>
              {busy === "consult" ? "Consultando…" : "Consultar empresa"}
            </button>
          </div>
        </label>

        {company && (
          <div className="cnae-company">
            <div className="cnae-company__head">
              <strong>{company.razaoSocial ?? "—"}</strong>
              {company.situacaoCadastral && (
                <span className={`cnae-pill${/ativ/i.test(company.situacaoCadastral) ? " is-ok" : " is-warn"}`}>
                  {company.situacaoCadastral}
                </span>
              )}
            </div>
            <dl className="cnae-dl">
              {company.nomeFantasia && (<><dt>Nome fantasia</dt><dd>{company.nomeFantasia}</dd></>)}
              <dt>CNAE principal</dt>
              <dd>{company.cnaePrincipalCodigo ?? "—"} · {company.cnaePrincipalDescricao ?? "—"}</dd>
              {company.cnaesSecundarios.length > 0 && (
                <>
                  <dt>CNAEs secundários</dt>
                  <dd>{company.cnaesSecundarios.map((c) => c.codigo).join(", ")}</dd>
                </>
              )}
              <dt>Porte</dt>
              <dd>{company.porte ?? "—"}</dd>
              <dt>Local</dt>
              <dd>
                {[company.endereco.municipio, company.endereco.uf].filter(Boolean).join(" / ") || "—"}
              </dd>
            </dl>
          </div>
        )}

        <div className="cnae-fieldset">
          <label className="cnae-field cnae-field--inline">
            <span>Número de colaboradores</span>
            <input
              type="number"
              min={0}
              value={form.numeroColaboradores ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  numeroColaboradores: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              placeholder="ex.: 35"
            />
          </label>

          <span className="cnae-fieldset__legend">Sinais operacionais</span>
          <div className="cnae-checks">
            {TRIGGERS.map((t) => (
              <label key={t.key} className="cnae-check">
                <input
                  type="checkbox"
                  checked={Boolean(form[t.key])}
                  onChange={(e) => setForm((f) => ({ ...f, [t.key]: e.target.checked }))}
                />
                {t.label}
              </label>
            ))}
          </div>

          <label className="cnae-field">
            <span>Observações do consultor</span>
            <textarea
              rows={2}
              value={form.observacoesDoConsultor ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, observacoesDoConsultor: e.target.value }))}
              placeholder="Contexto operacional relevante…"
            />
          </label>
        </div>

        {error && <p className="cnae-error">{error}</p>}

        <div className="cnae-actions">
          <button className="btn btn--primary" onClick={doEvaluate} disabled={busy !== null || !cnpj.replace(/\D/g, "")}>
            {busy === "evaluate" ? "Avaliando…" : "Gerar recomendação"}
          </button>
          {(company || decision) && (
            <button className="btn" onClick={reset} disabled={busy !== null}>
              Nova avaliação
            </button>
          )}
        </div>
      </div>

      <div className="cnae-result">
        {decision ? <RecommendationCard d={decision} /> : <EmptyCard />}
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="card cnae-empty">
      <p>Consulte um CNPJ e gere a recomendação para ver aqui a <strong>Recomendação Técnica CRIVO</strong>.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de Recomendação Técnica.
// ─────────────────────────────────────────────────────────────────────────────
function RecommendationCard({ d }: { d: CnaeDecisionResult }) {
  const [status, setStatus] = useState<"pendente" | "aceita" | "revisao">("pendente");
  const [note, setNote] = useState<string | null>(null);

  const methodLabel =
    d.recommendedMethod === "ORGANIZACIONAL"
      ? "Diagnóstico Organizacional"
      : d.recommendedMethod === "ESSENCIAL"
        ? "Diagnóstico Essencial"
        : "—";

  function copy() {
    const txt =
      `Recomendação Técnica CRIVO\n` +
      `CNAE: ${d.cnaePrincipalCodigo ?? "—"} (divisão ${d.divisionCode ?? "—"} — ${d.divisionName ?? "—"})\n` +
      `Risco preliminar: ${d.preliminaryRiskLevel ? RISK_LABEL[d.preliminaryRiskLevel] : "—"}\n` +
      `Método: ${methodLabel}\n` +
      `Saídas técnicas: ${d.technicalOutputs.join(", ")}\n` +
      `Justificativa: ${d.decisionReason}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(txt);
      setNote("Recomendação copiada.");
    }
  }

  return (
    <div className="card cnae-card">
      <div className="cnae-card__head">
        <h3>Recomendação Técnica CRIVO</h3>
        <span className="cnae-preliminar">Preliminar</span>
      </div>

      <div className="cnae-card__hero">
        <span className={riskClass(d.preliminaryRiskLevel)}>
          Risco {d.preliminaryRiskLevel ? RISK_LABEL[d.preliminaryRiskLevel] : "—"}
        </span>
        <span className={`cnae-method cnae-method--${(d.recommendedMethod ?? "na").toLowerCase()}`}>{methodLabel}</span>
        <span className="cnae-score" title="Força do sinal pró-Organizacional (transparência)">
          score {d.decisionScore}
        </span>
      </div>

      <dl className="cnae-dl">
        <dt>CNAE identificado</dt>
        <dd>{d.cnaePrincipalCodigo ?? "—"} · {d.cnaePrincipalDescricao ?? "—"}</dd>
        <dt>Divisão CNAE</dt>
        <dd>{d.divisionCode ?? "—"} — {d.divisionName ?? "—"}</dd>
        <dt>Documentos recomendados</dt>
        <dd>{d.requiredDocuments.length ? d.requiredDocuments.join(", ") : "—"}</dd>
        <dt>Evidências necessárias</dt>
        <dd>{d.requiredEvidences.length ? d.requiredEvidences.join("; ") : "—"}</dd>
        <dt>Revisão manual necessária</dt>
        <dd>
          <strong className={d.manualReviewRequired ? "cnae-yes" : "cnae-no"}>
            {d.manualReviewRequired ? "Sim" : "Não"}
          </strong>
        </dd>
        <dt>Status</dt>
        <dd>
          {status === "pendente" && "Aguardando decisão do especialista"}
          {status === "aceita" && <span className="cnae-yes">Recomendação aceita</span>}
          {status === "revisao" && <span className="cnae-yes">Enviada para revisão técnica</span>}
        </dd>
      </dl>

      {d.technicalOutputs.length > 0 && (
        <div className="cnae-chips">
          {d.technicalOutputs.map((o) => (
            <span key={o} className="cnae-chip">{o}</span>
          ))}
        </div>
      )}

      <div className="cnae-block">
        <h4>Justificativa</h4>
        <p>{d.decisionReason}</p>
      </div>

      {d.criteriaConsidered.length > 0 && (
        <div className="cnae-block">
          <h4>Critérios considerados</h4>
          <ul>{d.criteriaConsidered.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      {d.warnings.length > 0 && (
        <div className="cnae-block cnae-block--warn">
          <h4>Alertas</h4>
          <ul>{d.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {d.nextSteps.length > 0 && (
        <div className="cnae-block">
          <h4>Próximos passos</h4>
          <ol>{d.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}

      {note && <p className="cnae-note">{note}</p>}

      <div className="cnae-card__actions">
        <button className="btn btn--primary" onClick={() => { setStatus("aceita"); setNote("Recomendação aceita — o histórico registrou a decisão."); }}>
          Aceitar recomendação
        </button>
        <button className="btn" onClick={() => { setStatus("revisao"); setNote("Enviada para revisão técnica do especialista."); }}>
          Enviar para revisão técnica
        </button>
        <button className="btn" onClick={copy}>Copiar recomendação</button>
        <button className="btn" onClick={() => setNote("O diagnóstico é aplicado na empresa-cliente (provisionamento do tenant pela solução correspondente).")}>
          Gerar diagnóstico
        </button>
        <button className="btn" onClick={() => setNote("O relatório técnico é gerado na ficha da empresa-cliente (seção \"Base Técnica da Recomendação\").")}>
          Gerar relatório
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Regras CNAE — tabela editável das 87 divisões.
// ─────────────────────────────────────────────────────────────────────────────
function RulesTab() {
  const [rows, setRows] = useState<CnaeDivisionRule[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [method, setMethod] = useState("");
  const [editing, setEditing] = useState<CnaeDivisionRule | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const data = await listCnaeDivisions({ q, risk, method });
      setRows(data);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, risk, method]);

  return (
    <div className="card cnae-rules">
      <div className="cnae-filters">
        <input placeholder="Buscar código ou nome…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="">Todos os riscos</option>
          {RISK_OPTIONS.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Todos os métodos</option>
          <option value="ESSENCIAL">Essencial</option>
          <option value="ORGANIZACIONAL">Organizacional</option>
        </select>
        <span className="cnae-count">{rows.length} divisões</span>
      </div>

      {status === "loading" && <p className="cnae-muted">Carregando…</p>}
      {status === "error" && <p className="cnae-error">Falha ao carregar as regras.</p>}
      {status === "ok" && (
        <div className="cnae-table-wrap">
          <table className="cnae-table">
            <thead>
              <tr>
                <th>Div.</th>
                <th>Nome oficial</th>
                <th>Risco</th>
                <th>Método</th>
                <th>Flags</th>
                <th>Ativa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.isActive ? "" : "is-inactive"}>
                  <td className="cnae-mono">{r.divisionCode}</td>
                  <td>{r.officialName}</td>
                  <td><span className={riskClass(r.preliminaryRiskLevel)}>{RISK_LABEL[r.preliminaryRiskLevel]}</span></td>
                  <td>{r.defaultMethod === "ORGANIZACIONAL" ? "Organizacional" : "Essencial"}</td>
                  <td className="cnae-flags">
                    {r.pgrRequired && <span title="PGR">PGR</span>}
                    {r.riskInventoryRequired && <span title="Inventário de Riscos">INV</span>}
                    {r.aepRequired && <span title="AEP">AEP</span>}
                    {r.evidenceRequired && <span title="Evidências">EVD</span>}
                    {r.executiveReportRequired && <span title="Relatório Executivo">REL</span>}
                    {r.actionPlanRequired && <span title="Plano de Ação">PLA</span>}
                  </td>
                  <td>{r.isActive ? "Sim" : "Não"}</td>
                  <td><button className="btn btn--sm" onClick={() => setEditing(r)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditRuleModal
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: CnaeDivisionRule;
  onClose: () => void;
  onSaved: (r: CnaeDivisionRule) => void;
}) {
  const [draft, setDraft] = useState<CnaeDivisionRule>(rule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flag = (k: keyof CnaeDivisionRule, label: string) => (
    <label className="cnae-check">
      <input
        type="checkbox"
        checked={Boolean(draft[k])}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))}
      />
      {label}
    </label>
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCnaeDivision(rule.id, {
        preliminaryRiskLevel: draft.preliminaryRiskLevel,
        defaultMethod: draft.defaultMethod,
        defaultTechnicalOutput: draft.defaultTechnicalOutput,
        pgrRequired: draft.pgrRequired,
        riskInventoryRequired: draft.riskInventoryRequired,
        aepRequired: draft.aepRequired,
        evidenceRequired: draft.evidenceRequired,
        executiveReportRequired: draft.executiveReportRequired,
        actionPlanRequired: draft.actionPlanRequired,
        technicalObservation: draft.technicalObservation,
        isActive: draft.isActive,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cnae-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Divisão {rule.divisionCode} — {rule.officialName}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar" title="Fechar">✕</button>
        </div>
        <div className="modal__body">
          <div className="cnae-edit-row">
            <label className="cnae-field cnae-field--inline">
              <span>Risco preliminar</span>
              <select
                value={draft.preliminaryRiskLevel}
                onChange={(e) => setDraft((d) => ({ ...d, preliminaryRiskLevel: e.target.value as CnaeRiskLevel }))}
              >
                {RISK_OPTIONS.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="cnae-field cnae-field--inline">
              <span>Método padrão</span>
              <select
                value={draft.defaultMethod}
                onChange={(e) => setDraft((d) => ({ ...d, defaultMethod: e.target.value as CnaeDivisionRule["defaultMethod"] }))}
              >
                <option value="ESSENCIAL">Essencial</option>
                <option value="ORGANIZACIONAL">Organizacional</option>
              </select>
            </label>
          </div>

          <span className="cnae-fieldset__legend">Documentos / saídas exigidas</span>
          <div className="cnae-checks">
            {flag("pgrRequired", "PGR")}
            {flag("riskInventoryRequired", "Inventário de Riscos")}
            {flag("aepRequired", "AEP")}
            {flag("evidenceRequired", "Evidências")}
            {flag("executiveReportRequired", "Relatório Executivo")}
            {flag("actionPlanRequired", "Plano de Ação")}
          </div>

          <label className="cnae-field">
            <span>Saída técnica (resumo)</span>
            <input
              value={draft.defaultTechnicalOutput}
              onChange={(e) => setDraft((d) => ({ ...d, defaultTechnicalOutput: e.target.value }))}
            />
          </label>
          <label className="cnae-field">
            <span>Observação técnica</span>
            <textarea
              rows={2}
              value={draft.technicalObservation ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, technicalObservation: e.target.value }))}
            />
          </label>
          <label className="cnae-check">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))} />
            Regra ativa
          </label>

          {error && <p className="cnae-error">{error}</p>}
        </div>
        <div className="modal__foot">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar regra"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Histórico de decisões.
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [rows, setRows] = useState<CnaeDecisionHistoryItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        setRows(await listCnaeHistory(50));
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  if (status === "loading") return <div className="card"><p className="cnae-muted">Carregando histórico…</p></div>;
  if (status === "error") return <div className="card"><p className="cnae-error">Falha ao carregar o histórico.</p></div>;
  if (!rows.length) return <div className="card"><p className="cnae-muted">Nenhuma decisão registrada ainda.</p></div>;

  return (
    <div className="card cnae-rules">
      <div className="cnae-table-wrap">
        <table className="cnae-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>CNPJ</th>
              <th>Div.</th>
              <th>Risco</th>
              <th>Método</th>
              <th>Revisão</th>
              <th>Revisado por</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id}>
                <td className="cnae-mono">{new Date(h.createdAt).toLocaleString("pt-BR")}</td>
                <td className="cnae-mono">{h.cnpj ?? "—"}</td>
                <td className="cnae-mono">{h.divisionCode ?? "—"}</td>
                <td>{h.riskLevel ? <span className={riskClass(h.riskLevel)}>{RISK_LABEL[h.riskLevel as CnaeRiskLevel] ?? h.riskLevel}</span> : "—"}</td>
                <td>{h.recommendedMethod === "ORGANIZACIONAL" ? "Organizacional" : h.recommendedMethod === "ESSENCIAL" ? "Essencial" : "—"}</td>
                <td>{h.manualReviewRequired ? <span className="cnae-yes">Sim</span> : "Não"}</td>
                <td>{h.reviewedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
