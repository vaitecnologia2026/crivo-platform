"use client";

import { useEffect, useState } from "react";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  type ActionPlanData,
  type ActionStatus,
} from "@crivo/types";
import {
  addActionItem,
  addEvidence,
  createActionPlan,
  listActionPlans,
  updateActionItem,
  validateActionPlan,
} from "@/lib/api";

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
            {validated ? "✓ Documento final" : "Minuta"}
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
          <tr><th>Ponto</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Evidências</th></tr>
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

function EvidenceBlock({ item, onChanged }: { item: ActionPlanData["items"][number]; onChanged: () => void }) {
  const [kind, setKind] = useState("documento");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await addEvidence(item.id, { kind, title: title.trim(), url: url || undefined }); setTitle(""); setUrl(""); onChanged(); }
    catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setSaving(false); }
  }
  return (
    <div style={{ padding: "12px 6px" }}>
      {item.expectedEvidence && <p className="card__sub" style={{ marginBottom: 8 }}>Evidência esperada: {item.expectedEvidence}</p>}
      <ul className="lib-list" style={{ marginBottom: 10 }}>
        {item.evidences.map((ev) => (
          <li key={ev.id} className="lib-row">
            <span className="lib-ic">▤</span>
            <div>
              <strong>{ev.title}</strong>
              <span>{ev.kind}{ev.url ? " · " : ""}{ev.url && <a href={ev.url} target="_blank" rel="noopener">abrir</a>}</span>
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex.: Ata da reunião 12/06" />
        </label>
        <label className="prod-field" style={{ flex: 1, minWidth: 160 }}><span>Link (opcional)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !title.trim()}>Anexar</button>
      </form>
    </div>
  );
}

function NewItemForm({ planId, onClose, onAdded }: { planId: string; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ point: "", action: "", responsible: "", dueDate: "", expectedEvidence: "", origin: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addActionItem(planId, {
        point: f.point.trim(), action: f.action.trim(),
        origin: f.origin || undefined, responsible: f.responsible || undefined,
        dueDate: f.dueDate || null, expectedEvidence: f.expectedEvidence || undefined,
      });
      onAdded();
    } catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 12, padding: 14, background: "var(--line-soft)", borderRadius: 8 }}>
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
