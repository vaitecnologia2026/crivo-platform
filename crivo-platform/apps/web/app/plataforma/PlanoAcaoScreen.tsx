"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  type DevolutivaData,
  type DiagnosticCycleData,
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  type RiskActionSuggestions,
  psychosocialRiskClass,
  rotuloDoGhe,
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
  listDevolutivas,
  createDevolutiva,
  listCycles,
  openCycle,
  closeCycle,
  getDiagnosticContext,
  listRiskActionSuggestions,
  acceptRiskActionSuggestions,
  listGhesDoPlano,
} from "@/lib/api";
import { IconCheck, IconPaperclip, IconGrid } from "./Icons";

const EVIDENCE_KINDS = ["ata", "reunião", "print", "foto", "documento", "comunicado", "lista", "treinamento", "link"];

/** GHEs ELEGÍVEIS do ciclo — os escopos que uma ação pode ter além da
 *  Organização (Dossiê Organizacional). Vazio fora do Organizacional: aí o
 *  escopo nem aparece na tela. */
type GheOpcao = { value: string; label: string };
const GhesContext = createContext<GheOpcao[]>([]);

/** Escopo da ação na linha do plano. Só aparece quando a empresa tem GHE
 *  elegível (ou a ação já tem escopo): no Essencial seria ruído. */
function EscopoPill({ scopeGhe }: { scopeGhe: string | null }) {
  const ghes = useContext(GhesContext);
  if (!scopeGhe && !ghes.length) return null;
  return (
    <span
      className={`pill pill--sm${scopeGhe ? " pill--gold" : " pill--outline"}`}
      style={{ marginLeft: 6 }}
      title={scopeGhe ? "Ação específica deste GHE — sai no anexo do grupo no Dossiê" : "Ação geral — vale para a organização e para os GHEs em que o fator exige ação"}
    >
      {scopeGhe ? rotuloDoGhe(scopeGhe) : "Organização"}
    </span>
  );
}

/** Seletor de escopo: Organização (ação geral) ou um GHE elegível. Ação geral
 *  NÃO se repete por GHE — ela já vale para os grupos em que o fator exige ação. */
function EscopoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ghes = useContext(GhesContext);
  if (!ghes.length && !value) return null;
  const foraDaLista = value && !ghes.some((g) => g.value === value);
  return (
    <label className="prod-field"><span>Escopo da ação</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Organização (Resultado Geral)</option>
        {ghes.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
        {foraDaLista && <option value={value}>{rotuloDoGhe(value)} (fora dos GHEs elegíveis)</option>}
      </select>
    </label>
  );
}

/** Plano de Ação + Evidências do tenant (Briefing §8/§9). */
export function PlanoAcaoScreen() {
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [creating, setCreating] = useState(false);
  const [ghes, setGhes] = useState<GheOpcao[]>([]);

  async function refresh() {
    try { setPlans(await listActionPlans()); setStatus("ok"); } catch { setStatus("error"); }
  }
  useEffect(() => { void refresh(); }, []);
  // Escopos (GHEs elegíveis): falha aqui não derruba a tela — sem a lista, a
  // ação continua sendo da Organização, que é o padrão.
  useEffect(() => {
    let vivo = true;
    listGhesDoPlano().then((r) => { if (vivo) setGhes(r.ghes); }).catch(() => { if (vivo) setGhes([]); });
    return () => { vivo = false; };
  }, []);

  return (
    <GhesContext.Provider value={ghes}>
      <div className="route__head">
        <div>
          <h1 className="page-title">Plano de Evolução</h1>
          <p className="page-sub">
            Fonte única das ações do programa: fator → ação → responsável → prazo → risco (Sev×Prob) →
            evidência. Documentos e dossiês vivem em <strong>Relatórios e Dossiês</strong>.
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

      {status === "ok" && <CyclesCard />}
      {status === "ok" && <DevolutivaCard />}
    </GhesContext.Provider>
  );
}

/**
 * F4 — Ciclos formais de diagnóstico (definição acordada: ciclo = aplicação
 * formal aberta e encerrada). O encerramento CONGELA os fatores/risco do plano;
 * com dois ciclos encerrados, o Relatório de Evolução (TPL-003) compara os dois
 * em Relatórios e Dossiês.
 */

/** "Diagnóstico Essencial" já vem com a palavra — prefixar dava "Diagnóstico Diagnóstico Essencial". */
function nomeDoDiagnostico(nome: string): string {
  return /^diagn[óo]stico/i.test(nome.trim()) ? nome : `Diagnóstico ${nome}`;
}

function CyclesCard() {
  const [rows, setRows] = useState<DiagnosticCycleData[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoadError(false);
    try { setRows(await listCycles()); } catch { setRows(null); setLoadError(true); }
  }
  useEffect(() => { void refresh(); }, []);

  const openRow = rows?.find((c) => c.status === "ABERTO") ?? null;
  const closedCount = rows?.filter((c) => c.status === "ENCERRADO").length ?? 0;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha na operação do ciclo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card__head">
        <div>
          <h3>Ciclos de diagnóstico</h3>
          <span className="card__sub">
            Ciclo formal = aplicação aberta e encerrada. Encerrar congela os fatores e riscos do
            momento; com dois ciclos encerrados, o Relatório de Evolução compara os dois.
          </span>
        </div>
        {!openRow && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Ciclo ${(rows?.length ?? 0) + 1}`}
              maxLength={120}
              style={{ maxWidth: 180 }}
            />
            <button
              className="btn btn--terra btn--sm"
              disabled={busy || rows === null}
              onClick={() => void run(async () => { await openCycle({ label: label.trim() || undefined }); setLabel(""); })}
            >
              Abrir ciclo
            </button>
          </div>
        )}
        {openRow && (
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Encerrar o ciclo "${openRow.label}"? O encerramento congela os fatores e riscos do plano — é irreversível.`)) return;
              void run(() => closeCycle(openRow.id));
            }}
          >
            Encerrar ciclo aberto
          </button>
        )}
      </div>

      {loadError && (
        <p className="dash-state dash-state--error">
          Não foi possível carregar os ciclos.{" "}
          <button className="btn btn--ghost btn--sm" onClick={() => void refresh()}>Tentar de novo</button>
        </p>
      )}
      {rows === null && !loadError && <p className="card__sub">Carregando ciclos…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="card__sub">Nenhum ciclo ainda. Abra o primeiro para formalizar a aplicação do diagnóstico.</p>
      )}
      {rows !== null && rows.length > 0 && (
        <>
          {closedCount === 1 && (
            <p className="card__sub" style={{ marginBottom: 8 }}>
              1 ciclo encerrado — o Relatório de Evolução é liberado quando houver dois.
            </p>
          )}
          <table className="data-table">
            <thead>
              <tr><th>Ciclo</th><th>Período</th><th>Status</th><th>Fatores congelados</th><th>Encerrado por</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(c.openedAt).toLocaleDateString("pt-BR")}
                    {" a "}
                    {c.closedAt ? new Date(c.closedAt).toLocaleDateString("pt-BR") : "em aberto"}
                  </td>
                  <td>{c.status === "ABERTO" ? "Aberto" : "Encerrado"}</td>
                  <td>{c.factorsCount ?? "—"}</td>
                  <td>{c.closedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/**
 * F2 — Registro de comunicação e devolutiva (TPL-002 §10): a empresa registra
 * quando/como comunicou resultados e medidas aos trabalhadores. Os registros
 * entram automaticamente na seção 10 do Dossiê Técnico.
 */
function DevolutivaCard() {
  const [rows, setRows] = useState<DevolutivaData[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: "", format: "", audience: "", topics: "", confirmedPoints: "", communicatedMeasures: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function refresh() {
    setLoadError(false);
    try { setRows(await listDevolutivas()); } catch { setRows(null); setLoadError(true); }
  }
  useEffect(() => { void refresh(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDevolutiva({
        date: f.date,
        format: f.format,
        audience: f.audience || undefined,
        topics: f.topics || undefined,
        confirmedPoints: f.confirmedPoints || undefined,
        communicatedMeasures: f.communicatedMeasures || undefined,
      });
      setF({ date: "", format: "", audience: "", topics: "", confirmedPoints: "", communicatedMeasures: "" });
      setOpen(false);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao registrar a devolutiva.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card__head">
        <div>
          <h3>Comunicação e devolutiva</h3>
          <span className="card__sub">
            Registro de quando e como os resultados e medidas foram comunicados aos trabalhadores —
            entra na seção 10 do Dossiê Técnico.
          </span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Fechar" : "+ Registrar devolutiva"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} style={{ padding: 14, background: "var(--line-soft)", borderRadius: 8, marginBottom: 12 }}>
          <div className="prod-form__grid">
            <label className="prod-field"><span>Data</span>
              <input type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} required />
            </label>
            <label className="prod-field"><span>Formato</span>
              <select value={f.format} onChange={(e) => set("format")(e.target.value)} required>
                <option value="">— selecione —</option>
                <option>Reunião</option>
                <option>Comunicado</option>
                <option>Treinamento</option>
                <option>Outro</option>
              </select>
            </label>
            <label className="prod-field"><span>Público envolvido</span>
              <input value={f.audience} onChange={(e) => set("audience")(e.target.value)} placeholder="Ex.: todos os setores" />
            </label>
            <label className="prod-field"><span>Temas comunicados</span>
              <input value={f.topics} onChange={(e) => set("topics")(e.target.value)} placeholder="Ex.: resultados do diagnóstico" />
            </label>
            <label className="prod-field prod-field--full"><span>Pontos confirmados</span>
              <input value={f.confirmedPoints} onChange={(e) => set("confirmedPoints")(e.target.value)} />
            </label>
            <label className="prod-field prod-field--full"><span>Medidas comunicadas</span>
              <input value={f.communicatedMeasures} onChange={(e) => set("communicatedMeasures")(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !f.date || !f.format}>
              {saving ? "Registrando…" : "Registrar"}
            </button>
          </div>
        </form>
      )}

      {loadError && (
        <p className="dash-state dash-state--error">
          Não foi possível carregar os registros.{" "}
          <button className="btn btn--ghost btn--sm" onClick={() => void refresh()}>Tentar de novo</button>
        </p>
      )}
      {rows === null && !loadError && <p className="card__sub">Carregando registros…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="card__sub">Nenhuma devolutiva registrada ainda.</p>
      )}
      {rows !== null && rows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr><th>Data</th><th>Formato</th><th>Público</th><th>Temas</th><th>Registrado por</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td>{r.format}</td>
                <td>{r.audience ?? "—"}</td>
                <td>{r.topics ?? "—"}</td>
                <td>{r.createdBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
  const [instrumentSlug, setInstrumentSlug] = useState("");
  const [instruments, setInstruments] = useState<{ slug: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // A4 — diagnósticos do Motor p/ a proveniência estruturada (opcional).
    getDiagnosticContext().then((c) => setInstruments(c.instruments ?? [])).catch(() => setInstruments([]));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createActionPlan({
        title: title.trim(),
        source: source || undefined,
        sourceInstrumentSlug: instrumentSlug || undefined,
      });
      onCreated();
    }
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
        {instruments.length > 0 && (
          <label className="prod-field">
            <span>Diagnóstico de origem (opcional)</span>
            <select value={instrumentSlug} onChange={(e) => setInstrumentSlug(e.target.value)}>
              <option value="">—</option>
              {instruments.map((i) => (
                <option key={i.slug} value={i.slug}>{i.name}</option>
              ))}
            </select>
          </label>
        )}
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

  // Descartadas (NAO_ADOTADA) saem da lista operacional e ficam recolhidas
  // embaixo: não entram no Dossiê e não devem poluir o plano — mas o rastro da
  // recomendação continua, e dá para reconsiderar.
  const ativas = plan.items.filter((i) => i.status !== "NAO_ADOTADA");
  const descartadas = plan.items.filter((i) => i.status === "NAO_ADOTADA");

  // Sugestões ainda sem decisão. Validar o plano NÃO as aprova — só ação
  // aprovada entra no Dossiê (o servidor recusa validar com pendência; aqui a
  // tela mostra a conta antes do clique, para ninguém tomar "validar" por
  // "aprovar" — foi o que aconteceu na homologação de 17/09).
  const pendentes = plan.items.filter((i) => i.status === "SUGERIDA" || i.status === "EM_REVISAO").length;
  const aprovadas = plan.items.filter((i) => i.status === "APROVADA" || i.status === "EM_ANDAMENTO" || i.status === "CONCLUIDA" || i.status === "REAVALIADA").length;

  async function validate() {
    if (pendentes > 0) {
      alert(`${pendentes} sugestão(ões) ainda pendente(s). Aprove ou descarte cada uma antes de validar o plano — só ação aprovada entra no Dossiê.`);
      return;
    }
    if (!confirm(`Validar o plano com ${aprovadas} ação(ões) aprovada(s)? Após validar, ele passa a valer como documento final.`)) return;
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
            {plan.sourceInstrumentName
              ? `Origem: ${nomeDoDiagnostico(plan.sourceInstrumentName)} · `
              : plan.source
                ? `Origem: ${plan.source} · `
                : ""}
            {validated ? `Validado por ${plan.validatedBy ?? "—"}` : "Minuta — aguardando validação"}
            {" · "}
            <strong>{aprovadas}</strong> aprovada(s) entram no Dossiê
            {pendentes > 0 && <> · <strong>{pendentes}</strong> pendente(s) de decisão</>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className={`pattern-tag${validated ? "" : ""}`} style={{ color: validated ? "var(--success)" : "var(--gold-deep)" }}>
            {validated ? <><IconCheck size={13} /> Documento final</> : "Minuta"}
          </span>
          {!validated && (
            <button
              className="btn btn--outline-dark btn--sm"
              disabled={busy || plan.items.length === 0}
              title={pendentes > 0 ? `${pendentes} sugestão(ões) ainda sem decisão — aprove ou descarte antes` : ""}
              onClick={validate}
            >
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
          {ativas.map((it) => (
            <ItemRow key={it.id} item={it} onChanged={onChanged} />
          ))}
          {ativas.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: 20 }}>Nenhuma ação. Adicione abaixo.</td></tr>
          )}
        </tbody>
      </table>

      {descartadas.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="card__sub" style={{ cursor: "pointer" }}>
            Descartadas ({descartadas.length}) — não entram no Dossiê
          </summary>
          <table className="data-table" style={{ marginTop: 6 }}>
            <tbody>
              {descartadas.map((it) => (
                <DescartadaRow key={it.id} item={it} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </details>
      )}

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Detalhes abertos PARA APROVAR: o formulário salva os campos exigidos e
  // aprova na mesma gravação.
  const [aprovando, setAprovando] = useState(false);
  async function setStatus(s: ActionStatus) {
    try { await updateActionItem(item.id, { status: s }); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
  }
  // Sugestão ainda não decidida: a organização Edita, Aprova ou Descarta
  // (Ajustes Finais de Homologação). Só depois de aprovada entra no Dossiê.
  const pendente = item.status === "SUGERIDA" || item.status === "EM_REVISAO";
  // Responsável e evidência esperada são exigidos pelo servidor para aprovar.
  // Antes, o clique falhava com um alerta e abria os detalhes; quem preenchia e
  // salvava achava que tinha aprovado — e a ação seguia SUGERIDA, fora do
  // Dossiê (homologação 17/09: 12 ações editadas, zero aprovadas). Agora, se
  // falta algo, os detalhes abrem em modo "Salvar e aprovar": uma gravação só.
  const prontaParaAprovar = !!item.responsible?.trim() && !!item.expectedEvidence?.trim();
  async function aprovar() {
    if (!prontaParaAprovar) {
      setAprovando(true);
      setDetailsOpen(true);
      return;
    }
    try { await updateActionItem(item.id, { status: "APROVADA" }); onChanged(); }
    catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao aprovar");
      setAprovando(true);
      setDetailsOpen(true);
    }
  }
  async function descartar() {
    if (!window.confirm("Descartar esta sugestão? Ela sai do plano operacional e não entra no Dossiê (fica registrada como não adotada).")) return;
    await setStatus("NAO_ADOTADA");
  }
  const hasDetails = !!(item.areaProcess || item.existingMeasure || item.indicator || item.objective);
  return (
    <>
      <tr>
        <td>
          <strong>{item.point}</strong>
          <EscopoPill scopeGhe={item.scopeGhe} />
          {(item.sourceInstrumentName || item.origin) && (
            <span className="card__sub">
              {" · "}
              {item.sourceInstrumentName ? nomeDoDiagnostico(item.sourceInstrumentName) : item.origin}
            </span>
          )}
          {/* Origem do CÁLCULO: por que esta ação foi sugerida. Fica visível para
              a ação continuar auditável depois, quando a matriz já tiver mudado. */}
          {item.riskProbability != null && item.riskSeverity != null && (
            <div className="card__sub" style={{ fontSize: 11 }}>
              Sugerida pela matriz · P{item.riskProbability} × S{item.riskSeverity} ={" "}
              <strong>{item.riskProbability * item.riskSeverity}</strong> ·{" "}
              {PSYCHOSOCIAL_RISK_CLASS_LABEL[psychosocialRiskClass(item.riskProbability * item.riskSeverity)]}
            </div>
          )}
        </td>
        <td>{item.action}</td>
        <td><RiskCell item={item} /></td>
        <td>{item.responsible ?? "—"}</td>
        <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
        <td>
          {pendente ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="card__sub">{ACTION_STATUS_LABEL[item.status]}</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button className="btn btn--terra btn--sm" onClick={() => void aprovar()} title="Exige responsável e evidência esperada (em detalhes)">Aprovar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setDetailsOpen(true)}>Editar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => void descartar()}>Descartar</button>
              </div>
            </div>
          ) : (
            <select value={item.status} onChange={(e) => setStatus(e.target.value as ActionStatus)} className="kb-stage-select" style={{ width: 130 }}>
              {ACTION_STATUSES.filter((s) => s !== "NAO_ADOTADA" || s === item.status).map((s) => (<option key={s} value={s}>{ACTION_STATUS_LABEL[s]}</option>))}
            </select>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setEvOpen((v) => !v)}>
            {item.evidences.length} · anexar
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setDetailsOpen((v) => !v)}
            title="Área/processo, medida existente e indicador (entram no Dossiê)"
          >
            {hasDetails ? "detalhes ✓" : "detalhes"}
          </button>
        </td>
      </tr>
      {detailsOpen && (
        <tr>
          <td colSpan={7} style={{ background: "var(--line-soft)" }}>
            <ItemDetailsForm
              item={item}
              aprovar={aprovando}
              onChanged={onChanged}
              onClose={() => { setDetailsOpen(false); setAprovando(false); }}
            />
          </td>
        </tr>
      )}
      {evOpen && (
        <tr>
          <td colSpan={7} style={{ background: "var(--line-soft)" }}>
            <EvidenceBlock item={item} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Sugestão descartada: fica recolhida, fora do plano operacional, com o
 *  caminho de volta (reconsiderar = volta a SUGERIDA). */
function DescartadaRow({ item, onChanged }: { item: ActionPlanData["items"][number]; onChanged: () => void }) {
  async function reconsiderar() {
    try { await updateActionItem(item.id, { status: "SUGERIDA" }); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
  }
  return (
    <tr style={{ opacity: 0.75 }}>
      <td><strong>{item.point}</strong></td>
      <td>{item.action}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn btn--ghost btn--sm" onClick={() => void reconsiderar()}>Reconsiderar</button>
      </td>
    </tr>
  );
}

/**
 * F2 — Detalhes técnicos da ação (área/processo, medida existente, indicador).
 * Editável em item EXISTENTE — inclusive os importados do catálogo/sugestões,
 * que nascem sem esses campos. Entram na matriz e no plano do Dossiê.
 */
function ItemDetailsForm({ item, aprovar = false, onChanged, onClose }: { item: ActionPlanData["items"][number]; aprovar?: boolean; onChanged: () => void; onClose: () => void }) {
  const initialMode = item.existingMeasure === "Nenhuma medida existente" ? "none" : item.existingMeasure ? "other" : "";
  const [f, setF] = useState({
    areaProcess: item.areaProcess ?? "",
    existingMeasure: item.existingMeasure && item.existingMeasure !== "Nenhuma medida existente" ? item.existingMeasure : "",
    indicator: item.indicator ?? "",
    objective: item.objective ?? "",
    // Exigidos para APROVAR (regra de homologação): a ação gerada pela IA nasce
    // sem os dois, e antes não havia onde preenchê-los numa ação existente.
    responsible: item.responsible ?? "",
    expectedEvidence: item.expectedEvidence ?? "",
    dueDate: item.dueDate ? item.dueDate.slice(0, 10) : "",
    scopeGhe: item.scopeGhe ?? "",
    // O texto da MEDIDA é o que o Dossiê imprime no card PA-00N. A sugestão da
    // IA nasce como "título — etapas"; a empresa ajusta antes de aprovar.
    action: item.action,
  });
  const [measureMode, setMeasureMode] = useState<"" | "none" | "other">(initialMode);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function save() {
    // Em modo aprovar, valida aqui o que o servidor vai exigir — a mensagem
    // fica no formulário, ao lado do campo, em vez de num alerta que some.
    if (aprovar) {
      const faltam = [
        !f.responsible.trim() ? "responsável" : null,
        !f.expectedEvidence.trim() ? "evidência esperada" : null,
      ].filter(Boolean);
      if (faltam.length) {
        setErro(`Para aprovar, preencha: ${faltam.join(" e ")}.`);
        return;
      }
    }
    setErro(null);
    setSaving(true);
    try {
      await updateActionItem(item.id, {
        ...(aprovar ? { status: "APROVADA" as const } : {}),
        areaProcess: f.areaProcess || undefined,
        existingMeasure:
          measureMode === "none" ? "Nenhuma medida existente" : f.existingMeasure || undefined,
        indicator: f.indicator || undefined,
        objective: f.objective || undefined,
        responsible: f.responsible || undefined,
        expectedEvidence: f.expectedEvidence || undefined,
        dueDate: f.dueDate ? new Date(`${f.dueDate}T12:00:00`).toISOString() : undefined,
        // Escopo só vai quando MUDOU: uma ação cujo GHE deixou de ser elegível
        // não pode travar o salvamento dos outros campos.
        ...(f.scopeGhe !== (item.scopeGhe ?? "") ? { scopeGhe: f.scopeGhe || null } : {}),
        ...(f.action.trim() && f.action.trim() !== item.action ? { action: f.action.trim() } : {}),
      });
      onChanged();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : aprovar ? "Falha ao aprovar a ação." : "Falha ao salvar os detalhes.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ padding: 12 }}>
      {aprovar && (
        <p className="card__sub" style={{ margin: "0 0 10px" }}>
          <strong>Aprovar esta ação.</strong> Informe o responsável e a evidência esperada (obrigatórios) —
          ao salvar, a ação fica <strong>Aprovada</strong> e passa a compor o Dossiê.
        </p>
      )}
      <div className="prod-form__grid">
        <label className="prod-field prod-field--full"><span>Medida (texto que sai no Dossiê)</span>
          <textarea rows={2} maxLength={1000} value={f.action} onChange={(e) => setF((s) => ({ ...s, action: e.target.value }))} />
        </label>
        <EscopoSelect value={f.scopeGhe} onChange={(v) => setF((s) => ({ ...s, scopeGhe: v }))} />
        <label className="prod-field"><span>Responsável (obrigatório para aprovar)</span>
          <input value={f.responsible} onChange={(e) => setF((s) => ({ ...s, responsible: e.target.value }))} placeholder="Ex.: Gerente de Operações" />
        </label>
        <label className="prod-field"><span>Evidência esperada (obrigatória para aprovar)</span>
          <input value={f.expectedEvidence} onChange={(e) => setF((s) => ({ ...s, expectedEvidence: e.target.value }))} placeholder="Ex.: ata da reunião, relatório de carga" />
        </label>
        <label className="prod-field"><span>Prazo</span>
          <input type="date" value={f.dueDate} onChange={(e) => setF((s) => ({ ...s, dueDate: e.target.value }))} />
        </label>
        <label className="prod-field"><span>Área/Processo</span>
          <input value={f.areaProcess} onChange={(e) => setF((s) => ({ ...s, areaProcess: e.target.value }))} placeholder="Ex.: Comercial / atendimento" />
        </label>
        <label className="prod-field"><span>Indicador de acompanhamento</span>
          <input value={f.indicator} onChange={(e) => setF((s) => ({ ...s, indicator: e.target.value }))} placeholder="Ex.: % de adesão ao novo fluxo" />
        </label>
        {/* Coluna "Objetivo" do Plano de ação no Dossiê. Quando a ação veio de
            uma sugestão, já chega preenchida. */}
        <label className="prod-field"><span>Objetivo da medida</span>
          <input value={f.objective} onChange={(e) => setF((s) => ({ ...s, objective: e.target.value }))} placeholder="Ex.: Reduzir sobrecarga recorrente" />
        </label>
        <label className="prod-field"><span>Medida que já existe</span>
          <select
            value={measureMode}
            onChange={(e) => {
              const v = e.target.value as "" | "none" | "other";
              setMeasureMode(v);
              if (v !== "other") setF((s) => ({ ...s, existingMeasure: "" }));
            }}
          >
            <option value="">— selecione —</option>
            <option value="none">Nenhuma medida existente</option>
            <option value="other">Outra medida (descrever)</option>
          </select>
        </label>
        {measureMode === "other" && (
          <label className="prod-field"><span>Descreva a medida existente</span>
            <input value={f.existingMeasure} onChange={(e) => setF((s) => ({ ...s, existingMeasure: e.target.value }))} placeholder="Ex.: rodízio de escala já implantado" />
          </label>
        )}
      </div>
      {erro && <p className="card__sub" role="alert" style={{ color: "var(--danger, #b4432f)", margin: "8px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="btn btn--outline-dark btn--sm" onClick={onClose} disabled={saving}>Fechar</button>
        <button className="btn btn--terra btn--sm" onClick={() => void save()} disabled={saving}>
          {saving ? (aprovar ? "Aprovando…" : "Salvando…") : aprovar ? "Salvar e aprovar" : "Salvar detalhes"}
        </button>
      </div>
    </div>
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
              {/* A3 — status da governança CRIVO: fator de risco Alto só
                  libera o dossiê com evidência APROVADA. */}
              <span
                className="pattern-tag"
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  color: ev.status === "APROVADA" ? "var(--success)" : ev.status === "REJEITADA" ? "var(--danger, #b4432f)" : "var(--gold-deep)",
                }}
              >
                {ev.status === "APROVADA" ? "Aprovada pela CRIVO" : ev.status === "REJEITADA" ? "Rejeitada" : ev.status === "SUBSTITUIDA" ? "Substituída" : "Aguardando validação CRIVO"}
              </span>
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
  const [f, setF] = useState({ point: "", action: "", responsible: "", dueDate: "", expectedEvidence: "", origin: "", exposedGroup: "", severity: "", probability: "", riskLevel: "", areaProcess: "", existingMeasure: "", indicator: "", objective: "", scopeGhe: "" });
  const [measureMode, setMeasureMode] = useState<"" | "none" | "other">("");
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<ActionTemplateLite[] | null>(null);
  const [showSuggested, setShowSuggested] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedActions | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  // Sugestões da MATRIZ DE RISCO (P x S) — fonte diferente das "sugeridas pelo
  // diagnóstico" acima, que vêm do catálogo pela tensão de liderança.
  const [showRisk, setShowRisk] = useState(false);
  const [risk, setRisk] = useState<RiskActionSuggestions | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function loadTemplates() {
    if (templates) return;
    try { setTemplates(await getMyActionTemplates()); } catch { setTemplates([]); }
  }
  async function loadSuggested() {
    if (suggested) return;
    try { setSuggested(await getSuggestedActions()); } catch { setSuggested({ tension: null, reason: "", templates: [] }); }
  }

  async function loadRisk() {
    if (risk) return;
    try {
      setRisk(await listRiskActionSuggestions(planId));
    } catch (err) {
      setRisk({ origin: "biblioteca", suggestions: [], reason: err instanceof Error ? err.message : "Falha ao ler a matriz de risco." });
    }
  }
  function togglePick(key: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }
  async function acceptPicked() {
    if (!picked.size) return;
    setAccepting(true);
    try {
      await acceptRiskActionSuggestions(planId, [...picked]);
      setPicked(new Set());
      setRisk(null);
      onAdded();
    } catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setAccepting(false); }
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
        areaProcess: f.areaProcess || undefined,
        existingMeasure:
          measureMode === "none" ? "Nenhuma medida existente" : f.existingMeasure || undefined,
        indicator: f.indicator || undefined,
        objective: f.objective || undefined,
        scopeGhe: f.scopeGhe || undefined,
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
            className="btn btn--terra btn--sm"
            onClick={() => { setShowRisk((s) => !s); loadRisk(); }}
            title="Ações para os fatores cujo risco (P × S) torna o plano obrigatório"
          >
            {showRisk ? "Fechar matriz de risco" : "▲ Do diagnóstico de risco (P × S)"}
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

      {showRisk && (
        <div style={{ marginBottom: 14, padding: 12, background: "var(--bg-elev)", borderRadius: 6, border: "1px solid var(--terra-soft, var(--line))" }}>
          {risk === null && <p className="card__sub">Lendo a matriz de risco do diagnóstico…</p>}
          {risk && risk.suggestions.length === 0 && (
            <p className="card__sub" style={{ fontSize: 12, margin: 0 }}>{risk.reason}</p>
          )}
          {risk && risk.suggestions.length > 0 && (
            <>
              <p className="card__sub" style={{ marginBottom: 10, fontSize: 12 }}>
                Ações para os fatores cujo risco <strong>torna o plano obrigatório</strong> (R = P × S ≥ 10,
                NR-1 §1.5.4.4.2). Conteúdo{" "}
                {risk.origin === "IA" ? "elaborado com apoio da IA da plataforma" : "da biblioteca técnica CRIVO"}.
                O que você marcar entra no plano como <strong>Sugerida</strong> — o dossiê só é emitido
                depois que a empresa aprovar cada ação.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 340, overflow: "auto" }}>
                {risk.suggestions.map((x) => (
                  <li key={x.key} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line-soft)", opacity: x.alreadyInPlan ? 0.55 : 1 }}>
                    <input
                      type="checkbox"
                      checked={picked.has(x.key)}
                      disabled={x.alreadyInPlan}
                      onChange={() => togglePick(x.key)}
                      style={{ marginTop: 4 }}
                      aria-label={`Adicionar ${x.title}`}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>{x.title}</strong>
                      <div className="card__sub" style={{ fontSize: 11, marginTop: 2 }}>
                        {x.factorLabel} · P{x.probability} × S{x.severity} = <strong>{x.risk}</strong> ·{" "}
                        {PSYCHOSOCIAL_RISK_CLASS_LABEL[x.riskClass]} · prazo {x.prazo}
                        {x.scopeGhe && <> · <strong>{rotuloDoGhe(x.scopeGhe)}</strong> (fator só deste GHE)</>}
                        {x.alreadyInPlan && " · já no plano"}
                      </div>
                      <div className="card__sub" style={{ fontSize: 11, marginTop: 4 }}>{x.objetivo}</div>
                      <div className="card__sub" style={{ fontSize: 11, marginTop: 2 }}>
                        <em>Etapas:</em> {x.etapas}
                      </div>
                      <div className="card__sub" style={{ fontSize: 11, marginTop: 2 }}>
                        <em>Indicadores:</em> {x.indicadores}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn--terra btn--sm"
                style={{ marginTop: 12 }}
                disabled={!picked.size || accepting}
                onClick={acceptPicked}
              >
                {accepting ? "Adicionando…" : `Adicionar ${picked.size} ao plano`}
              </button>
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
        <EscopoSelect value={f.scopeGhe} onChange={set("scopeGhe")} />
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
        <label className="prod-field"><span>Área/Processo</span>
          <input value={f.areaProcess} onChange={(e) => set("areaProcess")(e.target.value)} placeholder="Ex.: Comercial / atendimento" />
        </label>
        <label className="prod-field"><span>Indicador de acompanhamento</span>
          <input value={f.indicator} onChange={(e) => set("indicator")(e.target.value)} placeholder="Ex.: % de adesão ao novo fluxo" />
        </label>
        <label className="prod-field"><span>Objetivo da medida</span>
          <input value={f.objective} onChange={(e) => set("objective")(e.target.value)} placeholder="Ex.: Reduzir sobrecarga recorrente" />
        </label>
        {/* Medida existente: a EMPRESA informa — o sistema nunca inventa (decisão 27/07). */}
        <label className="prod-field"><span>Medida que já existe para este fator</span>
          <select
            value={measureMode}
            onChange={(e) => {
              const v = e.target.value as "" | "none" | "other";
              setMeasureMode(v);
              if (v !== "other") set("existingMeasure")("");
            }}
          >
            <option value="">— selecione —</option>
            <option value="none">Nenhuma medida existente</option>
            <option value="other">Outra medida (descrever)</option>
          </select>
        </label>
        {measureMode === "other" && (
          <label className="prod-field"><span>Descreva a medida existente</span>
            <input value={f.existingMeasure} onChange={(e) => set("existingMeasure")(e.target.value)} placeholder="Ex.: rodízio de escala já implantado" />
          </label>
        )}
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
