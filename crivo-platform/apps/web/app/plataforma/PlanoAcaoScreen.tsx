"use client";

import { useEffect, useState } from "react";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  INVENTORY_RISK_LEVELS,
  INVENTORY_RISK_LABEL,
  RISK_LEVELS_3,
  classifyTechnicalRisk,
  type RiskLevel3,
  type ActionPlanData,
  type ActionStatus,
} from "@crivo/types";
import {
  addActionItem,
  addActionItemFromTemplate,
  getMyActionTemplates,
  getSuggestedActions,
  type SuggestedActions,
  addEvidence,
  uploadEvidence,
  downloadEvidenceFile,
  createActionPlan,
  listActionPlans,
  updateActionItem,
  validateActionPlan,
  type ActionTemplateLite,
} from "@/lib/api";
import { DocumentsPanel } from "./DocumentsPanel";
import { IconCheck, IconPaperclip, IconGrid } from "./Icons";

const EVIDENCE_KINDS = ["ata", "reunião", "print", "foto", "documento", "comunicado", "lista", "treinamento", "link"];

/** Plano de Ação + Evidências do tenant (Briefing §8/§9). */
export function PlanoAcaoScreen() {
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try { setPlans(await listActionPlans()); setStatus("ok"); } catch { setStatus("error"); }
  }
  useEffect(() => { void refresh(); }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Plano de Ação &amp; Evidências</h1>
          <p className="page-sub">
            Ponto → ação → responsável → prazo → status → evidência. O plano só vira documento após validação.
          </p>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setCreating(true)}>Novo plano</button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando planos…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar.</div>}

      {status === "ok" && <DocumentsPanel />}

      {creating && <NewPlanForm onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await refresh(); }} />}

      {status === "ok" && plans && plans.length === 0 && !creating && (
        <div className="dash-state">Nenhum plano ainda. Crie o primeiro em “Novo plano”.</div>
      )}

      {status === "ok" && plans?.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onChanged={refresh} />
      ))}
    </>
  );
}


/**
 * Risco técnico do fator — DERIVADO da matriz 3x3 Severidade x Probabilidade
 * (doc 09 §6). Não é editável: mostra o resultado e explica o que falta.
 * Regra do Anexo D: esta classificação é SEPARADA do índice do questionário.
 */
function DerivedRisk({ severity, probability }: { severity: string; probability: string }) {
  const ok = RISK_LEVELS_3.includes(severity as RiskLevel3) && RISK_LEVELS_3.includes(probability as RiskLevel3);
  if (!ok) {
    return (
      <span className="risk-derived risk-derived--empty">
        Informe severidade e probabilidade para o risco ser classificado.
      </span>
    );
  }
  const risk = classifyTechnicalRisk(probability as RiskLevel3, severity as RiskLevel3);
  const mod = risk === "Alto" ? "alto" : risk === "Moderado" ? "moderado" : "baixo";
  return (
    <span className={`risk-derived risk-derived--${mod}`}>
      {risk}
      <em>Severidade {severity} × Probabilidade {probability}</em>
    </span>
  );
}

function NewPlanForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await createActionPlan({ title: title.trim(), source: source || undefined }); onCreated(); }
    catch (err) { alert(err instanceof Error ? err.message : "Falha ao criar"); } finally { setSaving(false); }
  }
  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 18, padding: 18 }}>
      <div className="prod-form__grid">
        <label className="prod-field prod-field--full">
          <span>Título do plano</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex.: Plano de ação — Ciclo 2026.1" />
        </label>
        <label className="prod-field">
          <span>Origem</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            <option>autoavaliação</option>
            <option>escuta</option>
            <option>questionário</option>
            <option>observação</option>
            <option>parecer</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !title.trim()}>
          {saving ? "Criando…" : "Criar plano"}
        </button>
      </div>
    </form>
  );
}

function PlanCard({ plan, onChanged }: { plan: ActionPlanData; onChanged: () => void }) {
  const [addingItem, setAddingItem] = useState(false);
  const [busy, setBusy] = useState(false);
  const validated = !!plan.validatedAt;

  async function validate() {
    if (!confirm("Validar o plano? Após validar, ele passa a valer como documento final.")) return;
    setBusy(true);
    try { await validateActionPlan(plan.id); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          <h3>{plan.title}</h3>
          <span className="card__sub">
            {plan.source ? `Origem: ${plan.source} · ` : ""}
            {validated ? `Validado por ${plan.validatedBy ?? "—"}` : "Minuta — aguardando validação"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className={`pattern-tag${validated ? "" : ""}`} style={{ color: validated ? "var(--success)" : "var(--gold-deep)" }}>
            {validated ? <><IconCheck size={13} /> Documento final</> : "Minuta"}
          </span>
          {!validated && (
            <button className="btn btn--outline-dark btn--sm" disabled={busy || plan.items.length === 0} onClick={validate}>
              Validar plano
            </button>
          )}
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Ponto</th><th>Ação</th><th>Risco</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Evidências</th></tr>
        </thead>
        <tbody>
          {plan.items.map((it) => (
            <ItemRow key={it.id} item={it} onChanged={onChanged} />
          ))}
          {plan.items.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>Nenhuma ação. Adicione abaixo.</td></tr>
          )}
        </tbody>
      </table>

      {addingItem ? (
        <NewItemForm planId={plan.id} onClose={() => setAddingItem(false)} onAdded={async () => { setAddingItem(false); onChanged(); }} />
      ) : (
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={() => setAddingItem(true)}>+ Nova ação</button>
      )}
    </div>
  );
}


/** Risco do fator na lista: derivado da matriz quando há os dois eixos;
 *  senão mostra a classificação manual antiga, marcada como legado. */
function RiskCell({ item }: { item: ActionPlanData["items"][number] }) {
  const sev = item.severity as RiskLevel3 | null;
  const prob = item.probability as RiskLevel3 | null;
  if (sev && prob && RISK_LEVELS_3.includes(sev) && RISK_LEVELS_3.includes(prob)) {
    const risk = classifyTechnicalRisk(prob, sev);
    const mod = risk === "Alto" ? "alto" : risk === "Moderado" ? "moderado" : "baixo";
    return <span className={`risk-pill risk-pill--${mod}`} title={`Severidade ${sev} × Probabilidade ${prob}`}>{risk}</span>;
  }
  if (item.riskLevel) {
    return (
      <span className="risk-pill risk-pill--legacy" title="Classificação manual anterior à matriz — informe severidade e probabilidade">
        {(INVENTORY_RISK_LABEL as Record<string, string | undefined>)[item.riskLevel] ?? item.riskLevel} <em>manual</em>
      </span>
    );
  }
  return <span className="cell-na">—</span>;
}

function ItemRow({ item, onChanged }: { item: ActionPlanData["items"][number]; onChanged: () => void }) {
  const [evOpen, setEvOpen] = useState(false);
  async function setStatus(s: ActionStatus) {
    try { await updateActionItem(item.id, { status: s }); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
  }
  return (
    <>
      <tr>
        <td><strong>{item.point}</strong>{item.origin && <span className="card__sub"> · {item.origin}</span>}</td>
        <td>{item.action}</td>
        <td><RiskCell item={item} /></td>
        <td>{item.responsible ?? "—"}</td>
        <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
        <td>
          <select value={item.status} onChange={(e) => setStatus(e.target.value as ActionStatus)} className="kb-stage-select" style={{ width: 130 }}>
            {ACTION_STATUSES.map((s) => (<option key={s} value={s}>{ACTION_STATUS_LABEL[s]}</option>))}
          </select>
        </td>
        <td>
          <button className="btn btn--ghost btn--sm" onClick={() => setEvOpen((v) => !v)}>
            {item.evidences.length} · anexar
          </button>
        </td>
      </tr>
      {evOpen && (
        <tr>
          <td colSpan={6} style={{ background: "var(--line-soft)" }}>
            <EvidenceBlock item={item} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function EvidenceBlock({ item, onChanged }: { item: ActionPlanData["items"][number]; onChanged: () => void }) {
  const [kind, setKind] = useState("documento");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (file) {
        // §9 — upload de arquivo (prioridade sobre o link quando há arquivo).
        await uploadEvidence(item.id, file, { kind, title: title.trim() || file.name });
      } else {
        await addEvidence(item.id, { kind, title: title.trim(), url: url || undefined });
      }
      setTitle(""); setUrl(""); setFile(null); onChanged();
    }
    catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setSaving(false); }
  }
  async function baixar(ev: ActionPlanData["items"][number]["evidences"][number]) {
    try { await downloadEvidenceFile(ev.id, ev.fileName ?? ev.title); }
    catch (err) { alert(err instanceof Error ? err.message : "Falha ao baixar"); }
  }
  return (
    <div style={{ padding: "12px 6px" }}>
      {item.expectedEvidence && <p className="card__sub" style={{ marginBottom: 8 }}>Evidência esperada: {item.expectedEvidence}</p>}
      <ul className="lib-list" style={{ marginBottom: 10 }}>
        {item.evidences.map((ev) => (
          <li key={ev.id} className="lib-row">
            <span className="lib-ic">{ev.fileName ? <IconPaperclip size={14} /> : <IconGrid size={14} />}</span>
            <div>
              <strong>{ev.title}</strong>
              <span>
                {ev.kind}
                {ev.fileName && <> · <button type="button" className="lib-act" onClick={() => baixar(ev)}>baixar {ev.fileName} ({fmtSize(ev.fileSize)})</button></>}
                {ev.url && <> · <a href={ev.url} target="_blank" rel="noopener">abrir</a></>}
              </span>
            </div>
          </li>
        ))}
        {item.evidences.length === 0 && <li className="card__sub">Nenhuma evidência anexada.</li>}
      </ul>
      <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="prod-field"><span>Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>{EVIDENCE_KINDS.map((k) => (<option key={k}>{k}</option>))}</select>
        </label>
        <label className="prod-field" style={{ flex: 1, minWidth: 160 }}><span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ata da reunião 12/06" />
        </label>
        <label className="prod-field" style={{ flex: 1, minWidth: 160 }}><span>Arquivo (até 8 MB)</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="prod-field" style={{ flex: 1, minWidth: 160 }}><span>ou Link</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" disabled={!!file} />
        </label>
        <button type="submit" className="btn btn--terra btn--sm" disabled={saving || (!file && !title.trim() && !url)}>
          {saving ? "Enviando…" : file ? "Enviar arquivo" : "Anexar"}
        </button>
      </form>
    </div>
  );
}

function NewItemForm({ planId, onClose, onAdded }: { planId: string; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ point: "", action: "", responsible: "", dueDate: "", expectedEvidence: "", origin: "", exposedGroup: "", severity: "", probability: "", riskLevel: "" });
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<ActionTemplateLite[] | null>(null);
  const [showSuggested, setShowSuggested] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedActions | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function loadTemplates() {
    if (templates) return;
    try { setTemplates(await getMyActionTemplates()); } catch { setTemplates([]); }
  }
  async function loadSuggested() {
    if (suggested) return;
    try { setSuggested(await getSuggestedActions()); } catch { setSuggested({ tension: null, reason: "", templates: [] }); }
  }

  async function importTemplate(tplId: string) {
    setImportingId(tplId);
    try {
      await addActionItemFromTemplate(planId, tplId);
      onAdded();
    } catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setImportingId(null); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addActionItem(planId, {
        point: f.point.trim(), action: f.action.trim(),
        origin: f.origin || undefined, responsible: f.responsible || undefined,
        dueDate: f.dueDate || null, expectedEvidence: f.expectedEvidence || undefined,
        exposedGroup: f.exposedGroup || undefined,
        severity: f.severity || undefined, probability: f.probability || undefined,
        riskLevel: f.riskLevel || undefined,
      });
      onAdded();
    } catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 12, padding: 14, background: "var(--line-soft)", borderRadius: 8 }}>
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-sec)" }}>
          Criar ação personalizada ou importar do catálogo CRIVO.
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--terra btn--sm"
            onClick={() => { setShowSuggested((s) => !s); loadSuggested(); }}
          >
            {showSuggested ? "Fechar sugestões" : "✦ Sugeridas pelo diagnóstico"}
          </button>
          <button
            type="button"
            className="btn btn--ghost-dark btn--sm"
            onClick={() => { setShowTemplates((s) => !s); loadTemplates(); }}
          >
            {showTemplates ? "Fechar catálogo" : "◈ Importar do catálogo"}
          </button>
        </div>
      </div>

      {showSuggested && (
        <div style={{ marginBottom: 14, padding: 12, background: "var(--bg-elev)", borderRadius: 6, border: "1px solid var(--gold-soft, var(--line))" }}>
          {suggested === null && <p className="card__sub">Lendo o diagnóstico…</p>}
          {suggested && (
            <>
              <p className="card__sub" style={{ marginBottom: 10, fontSize: 12 }}>
                {suggested.reason || "Sem ações modelo cadastradas no Super Admin ainda."}
              </p>
              {suggested.templates.length === 0 ? (
                <p className="card__sub" style={{ fontSize: 11 }}>Cadastre ações modelo no Super Admin (Biblioteca de Ações) para receber sugestões.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflow: "auto" }}>
                  {suggested.templates.map((t) => (
                    <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{t.title}</strong>
                        <div className="card__sub" style={{ fontSize: 11 }}>
                          {t.category} · revisão em {t.defaultReviewDays}d
                          {t.suggestedResponsible && ` · ${t.suggestedResponsible}`}
                        </div>
                      </div>
                      <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => importTemplate(t.id)} disabled={importingId === t.id}>
                        {importingId === t.id ? "Importando…" : "+ usar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {showTemplates && (
        <div style={{ marginBottom: 14, padding: 12, background: "var(--bg-elev)", borderRadius: 6, border: "1px solid var(--line)" }}>
          {templates === null && <p className="card__sub">Carregando…</p>}
          {templates && templates.length === 0 && <p className="card__sub">Nenhuma ação modelo cadastrada no Super Admin ainda.</p>}
          {templates && templates.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflow: "auto" }}>
              {templates.map((t) => (
                <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{t.title}</strong>
                    <div className="card__sub" style={{ fontSize: 11 }}>
                      {t.category} · revisão em {t.defaultReviewDays}d
                      {t.suggestedResponsible && ` · ${t.suggestedResponsible}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--outline-dark btn--sm"
                    onClick={() => importTemplate(t.id)}
                    disabled={importingId === t.id}
                  >
                    {importingId === t.id ? "Importando…" : "+ usar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="prod-form__grid">
        <label className="prod-field prod-field--full"><span>Ponto identificado</span>
          <input value={f.point} onChange={(e) => set("point")(e.target.value)} required placeholder="Ex.: Sobrecarga na liderança do turno B" />
        </label>
        <label className="prod-field prod-field--full"><span>Ação proposta</span>
          <input value={f.action} onChange={(e) => set("action")(e.target.value)} required />
        </label>
        <label className="prod-field"><span>Responsável</span>
          <input value={f.responsible} onChange={(e) => set("responsible")(e.target.value)} />
        </label>
        <label className="prod-field"><span>Prazo</span>
          <input type="date" value={f.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
        </label>
        <label className="prod-field"><span>Origem</span>
          <select value={f.origin} onChange={(e) => set("origin")(e.target.value)}>
            <option value="">—</option><option>autoavaliação</option><option>escuta</option>
            <option>questionário</option><option>observação</option><option>parecer</option>
          </select>
        </label>
        <label className="prod-field"><span>Evidência esperada</span>
          <input value={f.expectedEvidence} onChange={(e) => set("expectedEvidence")(e.target.value)} placeholder="Ex.: ata, comunicado…" />
        </label>
        <label className="prod-field"><span>Grupos expostos (inventário/PGR)</span>
          <input value={f.exposedGroup} onChange={(e) => set("exposedGroup")(e.target.value)} placeholder="Ex.: turno B, líderes intermediários…" />
        </label>
        {/* Matriz do dossiê (doc 09 §6): severidade e probabilidade são as ENTRADAS;
            o risco técnico é DERIVADO delas — o consultor não digita o risco. */}
        <label className="prod-field"><span>Severidade</span>
          <select value={f.severity} onChange={(e) => set("severity")(e.target.value)}>
            <option value="">—</option>
            {RISK_LEVELS_3.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label className="prod-field"><span>Probabilidade (exposição/recorrência)</span>
          <select value={f.probability} onChange={(e) => set("probability")(e.target.value)}>
            <option value="">—</option>
            {RISK_LEVELS_3.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label className="prod-field prod-field--full"><span>Risco técnico (derivado da matriz)</span>
          <DerivedRisk severity={f.severity} probability={f.probability} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !f.point.trim() || !f.action.trim()}>
          {saving ? "Adicionando…" : "Adicionar ação"}
        </button>
      </div>
    </form>
  );
}
