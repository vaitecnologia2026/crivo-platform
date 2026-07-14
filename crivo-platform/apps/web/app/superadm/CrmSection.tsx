"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MODULES,
  PLATFORM_LEAD_LOST_REASONS,
  PLATFORM_LEAD_ORIGINS,
  PLATFORM_LEAD_STAGE_LABEL,
  platformLeadOriginLabel,
  type PlatformLeadStage,
  type PlatformLeadSummary,
  type ProductSummary,
  type ProvisionResult,
  type TenantSummary,
} from "@crivo/types";
import {
  convertLead,
  dedupLeads,
  listLeads,
  listProducts,
  listTenants,
  markFirstContact,
  resetTestData,
  sendLeadAccess,
  setLeadCommercial,
  setLeadInterest,
  setLeadNextAction,
  setLeadNotes,
  setLeadOrigin,
  setLeadStage,
} from "@/lib/admin-api";
import { PreliminaryReportModal } from "./PreliminaryReportModal";
import { LeadDataModal } from "./LeadDataModal";
import { ContractModal } from "./ContractModal";

const brlCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Board no modelo do cliente (mockup 14/07): 8 colunas da captação ao onboarding.
// PERDIDO sai do board (painel "Motivos de perda"); etapas pós-onboarding
// (implantação → upsell) aparecem dobradas na coluna Onboarding.
type BoardCol = {
  key: string;
  label: string;
  stages: PlatformLeadStage[];
  pill: { label: string; tone: "lav" | "green" | "blue" | "gray" };
  /** Ação primária do card: avança para `next` (ou ação especial via `kind`). */
  action: { label: string; next?: PlatformLeadStage; kind?: "contato" | "habilitar" | "onboarding" };
};
const COLUMNS: BoardCol[] = [
  { key: "captacao", label: "Captação", stages: ["NOVO"],
    pill: { label: "Sem 1º contato", tone: "lav" },
    action: { label: "Marcar 1º contato", kind: "contato", next: "OPORTUNIDADE" } },
  { key: "qualificacao", label: "Qualificação", stages: ["OPORTUNIDADE"],
    pill: { label: "Lead qualificado", tone: "green" },
    action: { label: "Agendar pré-diagnóstico", next: "PRE_DIAGNOSTICO" } },
  { key: "prediag", label: "Pré-diagnóstico", stages: ["PRE_DIAGNOSTICO", "REUNIAO"],
    pill: { label: "Reunião marcada", tone: "lav" },
    action: { label: "Enviar proposta", next: "PROPOSTA" } },
  { key: "proposta", label: "Proposta", stages: ["PROPOSTA"],
    pill: { label: "Proposta enviada", tone: "lav" },
    action: { label: "Iniciar negociação", next: "NEGOCIACAO" } },
  { key: "negociacao", label: "Negociação", stages: ["NEGOCIACAO"],
    pill: { label: "Em negociação", tone: "blue" },
    action: { label: "Registrar fechamento", next: "FECHADO" } },
  { key: "fechamento", label: "Fechamento", stages: ["FECHADO"],
    pill: { label: "Assinado", tone: "green" },
    action: { label: "Gerar contrato rascunho", next: "CONTRATO" } },
  { key: "contrato", label: "Contrato rascunho", stages: ["CONTRATO"],
    pill: { label: "Contrato rascunho", tone: "gray" },
    action: { label: "Enviar assinatura", kind: "habilitar", next: "ONBOARDING" } },
  { key: "onboarding", label: "Onboarding", stages: ["ONBOARDING", "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL"],
    pill: { label: "Em onboarding", tone: "blue" },
    action: { label: "Ver onboarding", kind: "onboarding" } },
];
const ALL_STAGES: PlatformLeadStage[] = [...COLUMNS.flatMap((c) => c.stages), "PERDIDO"];

const EDITOR_LABEL: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-sec)", marginTop: 6 };

/** Bloco de edição comercial do lead (Tela 02): origem/canal, solução de interesse e
 *  follow-up (próxima ação + observações). Origem e solução salvam na hora; o follow-up
 *  (data+nota) e as observações salvam juntos no botão. */
function LeadEditor({
  lead,
  products,
  busy,
  onOrigin,
  onInterest,
  onNextAction,
  onNotes,
  onCommercial,
}: {
  lead: PlatformLeadSummary;
  products: ProductSummary[];
  busy: boolean;
  onOrigin: (v: string) => void | Promise<void>;
  onInterest: (v: string) => void | Promise<void>;
  onNextAction: (at: string, note: string) => void | Promise<void>;
  onNotes: (v: string) => void | Promise<void>;
  onCommercial: (input: {
    commercialOwner?: string | null;
    proposedValueCents?: number | null;
    proposalSentAt?: string | null;
    potentialAddons?: string[];
  }) => void | Promise<void>;
}) {
  const [naAt, setNaAt] = useState(lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : "");
  const [naNote, setNaNote] = useState(lead.nextActionNote ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [owner, setOwner] = useState(lead.commercialOwner ?? "");
  const valorInicial = lead.proposedValueCents != null ? String(lead.proposedValueCents / 100) : "";
  const [valor, setValor] = useState(valorInicial);
  const [propAt, setPropAt] = useState(lead.proposalSentAt ? lead.proposalSentAt.slice(0, 10) : "");
  const [addons, setAddons] = useState<string[]>(lead.potentialAddons ?? []);

  const canonVals = PLATFORM_LEAD_ORIGINS.map((o) => o.value) as string[];
  const naChanged = naAt !== (lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : "") || naNote !== (lead.nextActionNote ?? "");
  const notesChanged = notes !== (lead.notes ?? "");
  const addonsKey = (a: string[]) => [...a].sort().join(",");
  const commercialChanged =
    owner !== (lead.commercialOwner ?? "") ||
    valor !== valorInicial ||
    propAt !== (lead.proposalSentAt ? lead.proposalSentAt.slice(0, 10) : "") ||
    addonsKey(addons) !== addonsKey(lead.potentialAddons ?? []);

  function parseValorCents(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  async function saveText() {
    if (naChanged) await onNextAction(naAt, naNote);
    if (notesChanged) await onNotes(notes);
    if (commercialChanged) {
      await onCommercial({
        commercialOwner: owner,
        proposedValueCents: parseValorCents(valor),
        proposalSentAt: propAt || null,
        potentialAddons: addons,
      });
    }
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)", display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={EDITOR_LABEL}>Origem / canal</span>
      <select
        className="kb-stage-select"
        value={lead.origin ?? ""}
        disabled={busy}
        onChange={(e) => onOrigin(e.target.value)}
        aria-label="Origem do lead"
      >
        <option value="">— selecione —</option>
        {lead.origin && !canonVals.includes(lead.origin) && (
          <option value={lead.origin}>{platformLeadOriginLabel(lead.origin)}</option>
        )}
        {PLATFORM_LEAD_ORIGINS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <span style={EDITOR_LABEL}>Solução de interesse</span>
      <select
        className="kb-stage-select"
        value={lead.interestProductId ?? ""}
        disabled={busy}
        onChange={(e) => onInterest(e.target.value)}
        aria-label="Solução de interesse"
      >
        <option value="">— nenhuma —</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <span style={EDITOR_LABEL}>Responsável comercial</span>
      <input
        type="text"
        className="kb-stage-select"
        value={owner}
        maxLength={120}
        disabled={busy}
        placeholder="Quem cuida deste lead"
        onChange={(e) => setOwner(e.target.value)}
        aria-label="Responsável comercial"
      />

      <span style={EDITOR_LABEL}>Valor proposto (R$)</span>
      <input
        type="number"
        min={0}
        step="0.01"
        className="kb-stage-select"
        value={valor}
        disabled={busy}
        placeholder="0,00"
        onChange={(e) => setValor(e.target.value)}
        aria-label="Valor proposto em reais"
      />

      <span style={EDITOR_LABEL}>Proposta enviada em</span>
      <input
        type="date"
        className="kb-stage-select"
        value={propAt}
        disabled={busy}
        onChange={(e) => setPropAt(e.target.value)}
        aria-label="Data de envio da proposta"
      />

      <span style={EDITOR_LABEL}>Adicionais potenciais</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", padding: "2px 0" }}>
        {MODULES.map((m) => (
          <label key={m.code} style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={addons.includes(m.code)}
              disabled={busy}
              onChange={(e) =>
                setAddons((prev) => (e.target.checked ? [...prev, m.code] : prev.filter((c) => c !== m.code)))
              }
            />
            {m.name}
          </label>
        ))}
      </div>

      <span style={EDITOR_LABEL}>Follow-up — próxima ação</span>
      <input
        type="date"
        className="kb-stage-select"
        value={naAt}
        disabled={busy}
        onChange={(e) => setNaAt(e.target.value)}
        aria-label="Data da próxima ação"
      />
      <input
        type="text"
        className="kb-stage-select"
        value={naNote}
        maxLength={240}
        disabled={busy}
        placeholder="O que fazer (ex.: enviar proposta)"
        onChange={(e) => setNaNote(e.target.value)}
        aria-label="Nota da próxima ação"
      />

      <span style={EDITOR_LABEL}>Observações</span>
      <textarea
        className="kb-stage-select"
        value={notes}
        rows={2}
        maxLength={4000}
        disabled={busy}
        placeholder="Anotações internas do lead"
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Observações"
        style={{ resize: "vertical" }}
      />

      <button
        type="button"
        className="kb-convert"
        disabled={busy || (!naChanged && !notesChanged && !commercialChanged)}
        onClick={saveText}
        style={{ marginTop: 8 }}
      >
        Salvar dados comerciais
      </button>
    </div>
  );
}

/** CRM do Super Admin — funil comercial da CRIVO (leads da LP + manuais). */
export function CrmSection() {
  const [leads, setLeads] = useState<PlatformLeadSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [converting, setConverting] = useState<PlatformLeadSummary | null>(null);
  const [reportingLead, setReportingLead] = useState<PlatformLeadSummary | null>(null);
  const [dataLead, setDataLead] = useState<PlatformLeadSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null); // card em edição comercial
  const [products, setProducts] = useState<ProductSummary[]>([]); // catálogo p/ "solução de interesse"
  const [tenants, setTenants] = useState<TenantSummary[]>([]); // p/ abrir o contrato da empresa
  const [contractTenant, setContractTenant] = useState<TenantSummary | null>(null);

  async function refresh() {
    try { setLeads(await listLeads()); setStatus("ok"); } catch { setStatus("error"); }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await listLeads();
        if (alive) { setLeads(d); setStatus("ok"); }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, []);

  async function move(id: string, stage: PlatformLeadStage) {
    setBusyId(id);
    // Atualização otimista.
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, stage } : l)) ?? prev);
    try {
      await setLeadStage(id, stage);
    } catch {
      // Reverte recarregando.
      try { setLeads(await listLeads()); } catch { /* mantém estado atual */ }
    } finally {
      setBusyId(null);
    }
  }

  /** Grava o motivo de perda (mantém o lead em PERDIDO). */
  async function setLostReason(id: string, lostReason: string) {
    setBusyId(id);
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, lostReason } : l)) ?? prev);
    try {
      await setLeadStage(id, "PERDIDO", lostReason);
    } catch {
      try { setLeads(await listLeads()); } catch { /* mantém estado atual */ }
    } finally {
      setBusyId(null);
    }
  }

  /** Registra o 1º contato (idempotente no backend). */
  async function markContact(id: string) {
    setBusyId(id);
    try {
      const updated = await markFirstContact(id);
      setLeads((prev) => prev?.map((l) => (l.id === id ? updated : l)) ?? prev);
    } catch {
      try { setLeads(await listLeads()); } catch { /* mantém estado atual */ }
    } finally {
      setBusyId(null);
    }
  }

  // Catálogo de soluções (para "solução de interesse"). Só ativas, sem captura de lead.
  useEffect(() => {
    listProducts()
      .then((ps) => setProducts(ps.filter((p) => p.status === "ACTIVE" && !p.isLeadCapture)))
      .catch(() => setProducts([]));
    // Empresas — para "link para contrato" (abre o contrato da empresa convertida).
    listTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  /** Abre o contrato da empresa criada na conversão (link para contrato). */
  async function openContract(convertedTenantId: string) {
    let t = tenants.find((x) => x.id === convertedTenantId);
    if (!t) {
      try {
        const fresh = await listTenants();
        setTenants(fresh);
        t = fresh.find((x) => x.id === convertedTenantId);
      } catch { /* ignora */ }
    }
    if (t) setContractTenant(t);
  }

  /** Dados comerciais (responsável, valor proposto, proposta enviada, adicionais). */
  async function saveCommercial(id: string, input: Parameters<typeof setLeadCommercial>[1]) {
    setBusyId(id);
    try { applyUpdate(await setLeadCommercial(id, input)); }
    catch { try { setLeads(await listLeads()); } catch { /* mantém */ } }
    finally { setBusyId(null); }
  }

  /** Aplica o retorno do backend ao lead na lista (mantém sincronizado). */
  function applyUpdate(updated: PlatformLeadSummary) {
    setLeads((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? prev);
  }

  /** [2] Origem/canal. */
  async function saveOrigin(id: string, origin: string) {
    setBusyId(id);
    try { applyUpdate(await setLeadOrigin(id, origin)); }
    catch { try { setLeads(await listLeads()); } catch { /* mantém */ } }
    finally { setBusyId(null); }
  }

  /** [4] Solução de interesse (id do produto; "" limpa). */
  async function saveInterest(id: string, interestProductId: string) {
    setBusyId(id);
    try { applyUpdate(await setLeadInterest(id, interestProductId || null)); }
    catch { try { setLeads(await listLeads()); } catch { /* mantém */ } }
    finally { setBusyId(null); }
  }

  /** [5] Follow-up / próxima ação (data + nota juntas). */
  async function saveNextAction(id: string, at: string, note: string) {
    setBusyId(id);
    try { applyUpdate(await setLeadNextAction(id, at || null, note.trim() || null)); }
    catch { try { setLeads(await listLeads()); } catch { /* mantém */ } }
    finally { setBusyId(null); }
  }

  /** Observações (endpoint já existia, sem UI no CRM até agora). */
  async function saveNotes(id: string, notes: string) {
    setBusyId(id);
    try { applyUpdate(await setLeadNotes(id, notes)); }
    catch { try { setLeads(await listLeads()); } catch { /* mantém */ } }
    finally { setBusyId(null); }
  }

  const byColumn = useMemo(() => {
    const map = new Map<string, PlatformLeadSummary[]>();
    for (const c of COLUMNS) map.set(c.key, []);
    const lost: PlatformLeadSummary[] = [];
    for (const l of leads ?? []) {
      if (l.stage === "PERDIDO") { lost.push(l); continue; }
      const col = COLUMNS.find((c) => c.stages.includes(l.stage));
      map.get(col?.key ?? "captacao")?.push(l);
    }
    map.set("__perdidos", lost);
    return map;
  }, [leads]);

  const perdidos = byColumn.get("__perdidos") ?? [];
  const abertos = (leads ?? []).filter((l) => l.stage !== "PERDIDO");
  const total = abertos.length;
  const reunioes = (byColumn.get("prediag") ?? []).length;
  const preDiags = abertos.filter((l) => l.diagnosticScore != null).length;
  const semContato = abertos.filter((l) => !l.firstContactedAt && !l.convertedTenantId).length;
  const GANHO: PlatformLeadStage[] = ["FECHADO", "CONTRATO", "ONBOARDING", "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL"];
  const ganhos = abertos.filter((l) => GANHO.includes(l.stage) || l.convertedTenantId);
  const todosLeads = leads ?? [];
  const conv = todosLeads.length ? Math.round((ganhos.length / todosLeads.length) * 100) : 0;
  const comValor = (ganhos.length ? ganhos : abertos).filter((l) => (l.proposedValueCents ?? 0) > 0);
  const ticket = comValor.length
    ? brlCents(Math.round(comValor.reduce((s, l) => s + (l.proposedValueCents ?? 0), 0) / comValor.length))
    : "—";

  // Conversão por origem: % de ganhos dentro de cada origem (inclui perdidos na base).
  const porOrigem = useMemo(() => {
    const acc = new Map<string, { total: number; ganhos: number }>();
    for (const l of todosLeads) {
      const key = platformLeadOriginLabel(l.origin);
      const cur = acc.get(key) ?? { total: 0, ganhos: 0 };
      cur.total += 1;
      if (GANHO.includes(l.stage) || l.convertedTenantId) cur.ganhos += 1;
      acc.set(key, cur);
    }
    return [...acc.entries()]
      .map(([label, v]) => ({ label, pct: Math.round((v.ganhos / v.total) * 100), total: v.total }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const motivosPerda = useMemo(() => {
    const acc = new Map<string, number>();
    for (const l of perdidos) {
      const r = PLATFORM_LEAD_LOST_REASONS.find((x) => x.value === l.lostReason);
      const label = r?.label ?? (l.lostReason || "Não informado");
      acc.set(label, (acc.get(label) ?? 0) + 1);
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const [resetting, setResetting] = useState(false);
  const [deduping, setDeduping] = useState(false);
  async function onDedup() {
    if (
      !window.confirm(
        "Remover leads duplicados pelo mesmo CNPJ?\n\nMantém os clientes já habilitados e o lead mais avançado de cada empresa; apaga as cópias abertas.",
      )
    )
      return;
    setDeduping(true);
    try {
      const r = await dedupLeads();
      window.alert(`${r.deleted} duplicado(s) removido(s). ${r.kept} lead(s) no funil.`);
      await refresh();
    } catch (e) {
      window.alert("Falha ao limpar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setDeduping(false);
    }
  }
  async function onResetData() {
    const typed = window.prompt(
      "Isto APAGA todos os clientes, leads e diagnósticos (mantém login, soluções e RBAC). " +
        "É irreversível.\n\nDigite ZERAR para confirmar:",
    );
    if (typed !== "ZERAR") return;
    setResetting(true);
    try {
      const r = await resetTestData("ZERAR");
      const totalDel = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      window.alert(`Base zerada — ${totalDel} registros removidos. Recarregando…`);
      window.location.reload();
    } catch (e) {
      window.alert("Falha ao zerar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">CRM — Funil</h1>
          <p className="page-sub">
            Gestão da jornada comercial CRIVO — da captação do lead ao contrato e onboarding.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--ghost btn--sm" onClick={onDedup} disabled={deduping}>
            {deduping ? "Limpando…" : "Limpar duplicados"}
          </button>
          <button className="btn btn--ghost btn--sm is-danger" onClick={onResetData} disabled={resetting}>
            {resetting ? "Zerando…" : "Zerar base (admin)"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando funil…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os leads.</div>
      )}

      {status === "ok" && leads && (
        <>
          <div className="kpi-grid crm-kpis" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Leads no funil</span>
              <strong className="kpi__value">{total}</strong>
            </div>
            <div className="kpi">
              <span className="kpi__label">Reuniões agendadas</span>
              <strong className="kpi__value">{reunioes}</strong>
            </div>
            <div className="kpi">
              <span className="kpi__label">Pré-diagnósticos</span>
              <strong className="kpi__value">{preDiags}</strong>
            </div>
            <div className="kpi">
              <span className="kpi__label">Sem 1º contato</span>
              <strong className="kpi__value">{semContato}</strong>
            </div>
            <div className="kpi">
              <span className="kpi__label">Taxa de conversão</span>
              <strong className="kpi__value">{conv}%</strong>
            </div>
            <div className="kpi">
              <span className="kpi__label">Ticket médio</span>
              <strong className="kpi__value">{ticket}</strong>
            </div>
          </div>

          <div className="crm-board">
            {COLUMNS.map((col) => {
              const items = byColumn.get(col.key) ?? [];
              return (
                <div className="crm-col" key={col.key}>
                  <div className="crm-col__head">
                    <span>{col.label}</span>
                    <em>{items.length}</em>
                  </div>
                  {items.map((l) => {
                    const contatoFeito = !!l.firstContactedAt;
                    const pill =
                      col.key === "captacao" && contatoFeito
                        ? { label: "Contato feito", tone: "green" as const }
                        : col.pill;
                    // Ação primária da coluna (rótulo/comportamento por etapa).
                    let actionLabel = col.action.label;
                    let onAction: () => void = () => {};
                    if (col.action.kind === "contato") {
                      if (!contatoFeito) onAction = () => markContact(l.id);
                      else { actionLabel = "Qualificar lead"; onAction = () => move(l.id, "OPORTUNIDADE"); }
                    } else if (col.action.kind === "habilitar") {
                      if (l.convertedTenantId) onAction = () => openContract(l.convertedTenantId!);
                      else { actionLabel = "Habilitar cliente (sistema)"; onAction = () => setConverting(l); }
                    } else if (col.action.kind === "onboarding") {
                      if (l.convertedTenantId) onAction = () => openContract(l.convertedTenantId!);
                      else { actionLabel = "Habilitar cliente (sistema)"; onAction = () => setConverting(l); }
                    } else if (col.action.next) {
                      const n = col.action.next;
                      onAction = () => move(l.id, n);
                    }
                    const expanded = expandedId === l.id;
                    return (
                      <article key={l.id} className="crm-card" style={{ opacity: busyId === l.id ? 0.55 : 1 }}>
                        <div className="crm-card__top">
                          <strong className="crm-card__name" title={l.company || l.name}>
                            {l.company || l.name}
                          </strong>
                          <button
                            type="button"
                            className="crm-card__menu"
                            aria-label="Mais ações do lead"
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : l.id)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                            </svg>
                          </button>
                        </div>
                        <span className="crm-chip">Origem: {platformLeadOriginLabel(l.origin)}</span>
                        <div className="crm-rows">
                          <div className="crm-row">
                            <span>Func.</span>
                            <b>{l.employeesCount ?? "—"}</b>
                          </div>
                          <div className="crm-row">
                            <span>Resp.</span>
                            <b>{l.commercialOwner ?? "—"}</b>
                          </div>
                        </div>
                        <span className={`crm-pill crm-pill--${pill.tone}`}>{pill.label}</span>
                        <p className="crm-next">
                          <b>Próxima:</b>{" "}
                          {l.nextActionNote
                            ? `${l.nextActionNote}${l.nextActionAt ? ` · ${new Date(l.nextActionAt).toLocaleDateString("pt-BR")}` : ""}`
                            : l.nextActionAt
                              ? new Date(l.nextActionAt).toLocaleDateString("pt-BR")
                              : "—"}
                        </p>
                        <button
                          type="button"
                          className={`crm-btn${col.key === "qualificacao" ? " crm-btn--dark" : ""}`}
                          disabled={busyId === l.id}
                          onClick={onAction}
                        >
                          {actionLabel}
                        </button>

                        {expanded && (
                          <div className="crm-more">
                            {l.convertedTenantId && (
                              <span className="kb-converted">Cliente habilitado — sistema liberado</span>
                            )}
                            <button type="button" className="kb-report" onClick={() => setDataLead(l)}>
                              Ver dados da empresa
                            </button>
                            {l.diagnosticScore != null && (
                              <button type="button" className="kb-report" onClick={() => setReportingLead(l)}>
                                Relatório Preliminar CRIVO
                              </button>
                            )}
                            {l.convertedTenantId && (
                              <button type="button" className="kb-report" onClick={() => openContract(l.convertedTenantId!)}>
                                Contrato da empresa
                              </button>
                            )}
                            {!contatoFeito && col.key !== "captacao" && (
                              <button type="button" className="kb-report" disabled={busyId === l.id} onClick={() => markContact(l.id)}>
                                Marcar 1º contato
                              </button>
                            )}
                            <span style={EDITOR_LABEL}>Mover etapa</span>
                            <select
                              value={l.stage}
                              disabled={busyId === l.id || !!l.convertedTenantId}
                              onChange={(e) => move(l.id, e.target.value as PlatformLeadStage)}
                              className="kb-stage-select"
                              aria-label="Mover lead no funil"
                            >
                              {ALL_STAGES.filter((s) => s !== "PERDIDO").map((s) => (
                                <option key={s} value={s}>{PLATFORM_LEAD_STAGE_LABEL[s]}</option>
                              ))}
                            </select>
                            {!l.convertedTenantId && (
                              <>
                                <span style={EDITOR_LABEL}>Marcar como perdido</span>
                                <select
                                  value=""
                                  disabled={busyId === l.id}
                                  onChange={(e) => { if (e.target.value) setLostReason(l.id, e.target.value); }}
                                  className="kb-stage-select"
                                  aria-label="Marcar lead como perdido com motivo"
                                >
                                  <option value="">Escolha o motivo…</option>
                                  {PLATFORM_LEAD_LOST_REASONS.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                              </>
                            )}
                            <LeadEditor
                              lead={l}
                              products={products}
                              busy={busyId === l.id}
                              onOrigin={(v) => saveOrigin(l.id, v)}
                              onInterest={(v) => saveInterest(l.id, v)}
                              onNextAction={(at, note) => saveNextAction(l.id, at, note)}
                              onNotes={(v) => saveNotes(l.id, v)}
                              onCommercial={(input) => saveCommercial(l.id, input)}
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="crm-panels">
            <div className="crm-panel">
              <span className="crm-panel__title">Conversão por origem</span>
              {porOrigem.length === 0 && <p className="dash-state">Nenhum lead com origem registrada.</p>}
              {porOrigem.map((o) => (
                <div className="crm-panel__row" key={o.label}>
                  <span>{o.label}</span>
                  <b>{o.pct}%</b>
                </div>
              ))}
            </div>
            <div className="crm-panel">
              <span className="crm-panel__title">Motivos de perda</span>
              {motivosPerda.length === 0 && <p className="dash-state">Nenhuma perda registrada.</p>}
              {motivosPerda.map(([label, count]) => (
                <div className="crm-panel__row" key={label}>
                  <span>{label}</span>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              Origem do lead é preenchida <strong>automaticamente</strong> por formulário, UTM, campanha, indicação,
              MAPA Executivo CRIVO ou cadastro manual identificado. Correção manual da origem é ação administrativa{" "}
              <strong>auditável</strong>. Lead fechado gera <strong>contrato rascunho</strong>; a conversão real
              ocorre em <strong>Contratos e Liberações</strong>.
            </p>
          </div>
        </>
      )}

      {converting && (
        <ConvertModal
          lead={converting}
          onClose={() => setConverting(null)}
          onConverted={async () => { setConverting(null); await refresh(); }}
        />
      )}

      {reportingLead && (
        <PreliminaryReportModal
          lead={reportingLead}
          onClose={() => setReportingLead(null)}
        />
      )}

      {dataLead && <LeadDataModal lead={dataLead} onClose={() => setDataLead(null)} />}

      {contractTenant && <ContractModal tenant={contractTenant} onClose={() => setContractTenant(null)} />}
    </>
  );
}

/** Modal de conversão Lead → Cliente: escolhe o produto e provisiona a empresa. */
function ConvertModal({
  lead,
  onClose,
  onConverted,
}: {
  lead: PlatformLeadSummary;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [productId, setProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ProvisionResult | null>(null);
  const [access, setAccess] = useState<{ sending: boolean; sent?: boolean; reason?: string }>({ sending: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await listProducts();
        if (!alive) return;
        const active = all.filter((p) => !p.isLeadCapture && p.status === "ACTIVE");
        setProducts(active);
        // Pré-seleciona a solução de interesse do lead (Tela 02 [4]→[3]), se ativa.
        if (lead.interestProductId && active.some((p) => p.id === lead.interestProductId)) {
          setProductId(lead.interestProductId);
        }
      } catch {
        if (alive) setProducts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function confirm() {
    if (!productId) return;
    setSaving(true);
    setError(null);
    try {
      setDone(await convertLead(lead.id, productId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conversão");
    } finally {
      setSaving(false);
    }
  }

  // #12 — envia o acesso por e-mail (gera nova senha; atualiza a exibida p/ bater).
  async function sendAccessEmail() {
    setAccess({ sending: true });
    try {
      const r = await sendLeadAccess(lead.id);
      setDone((d) => (d ? { ...d, tempPassword: r.tempPassword } : d));
      setAccess({ sending: false, sent: r.sent, reason: r.reason });
    } catch (e) {
      setAccess({ sending: false, sent: false, reason: e instanceof Error ? e.message : "erro" });
    }
  }

  return (
    <div className="modal-backdrop" onClick={done ? onConverted : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{done ? "Cliente Habilitado ✓ · sistema liberado" : "Converter em cliente"}</h2>
          <button className="icon-btn" onClick={done ? onConverted : onClose} title="Fechar">✕</button>
        </header>

        <div className="modal__body">
          {done ? (
            <div className="convert-done">
              <p>
                Empresa <strong>{done.tenant.name}</strong> criada a partir do produto contratado.
              </p>
              <dl className="convert-creds">
                <div><dt>Subdomínio</dt><dd>{done.tenant.slug}</dd></div>
                <div><dt>Admin</dt><dd>{done.adminEmail}</dd></div>
                {done.tempPassword && (
                  <div>
                    <dt>Senha temporária</dt>
                    <dd><code>{done.tempPassword}</code></dd>
                  </div>
                )}
              </dl>
              {done.tempPassword && (
                <p className="convert-warn">Copie a senha agora — não será exibida novamente.</p>
              )}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn--terra btn--sm" onClick={sendAccessEmail} disabled={access.sending}>
                  {access.sending ? "Enviando…" : "Enviar acesso por e-mail"}
                </button>
                {access.sent === true && (
                  <p className="convert-warn" style={{ color: "#1d9e75" }}>
                    Acesso enviado para {done.adminEmail} — a senha acima foi atualizada para a que foi enviada.
                  </p>
                )}
                {access.sent === false && access.reason === "email-not-configured" && (
                  <p className="convert-warn">
                    E-mail ainda não configurado — acesso preparado. Copie a senha acima e envie manualmente.
                  </p>
                )}
                {access.sent === false && access.reason && access.reason !== "email-not-configured" && (
                  <p className="convert-warn">Não foi possível enviar agora. Copie a senha acima.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="convert-lead">
                Lead: <strong>{lead.name}</strong>{lead.company ? ` · ${lead.company}` : ""} · {lead.email ?? "sem e-mail"}
              </p>
              {!lead.email && (
                <p className="convert-warn">Este lead não tem e-mail — necessário para criar o acesso do admin.</p>
              )}
              <label className="prod-field prod-field--full" style={{ marginTop: 10 }}>
                <span>Solução contratada</span>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!products}>
                  <option value="">{products ? "Selecione…" : "Carregando…"}</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.modules.length} módulos
                    </option>
                  ))}
                </select>
              </label>
              <p className="prod-note">
                O sistema cria automaticamente: empresa, admin, módulos liberados, perguntas e IA do produto.
              </p>
              {error && <p className="convert-warn">{error}</p>}
            </>
          )}
        </div>

        <div className="modal__foot">
          {done ? (
            <button className="btn btn--terra btn--sm" onClick={onConverted}>Concluir</button>
          ) : (
            <>
              <button className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
              <button
                className="btn btn--terra btn--sm"
                disabled={saving || !productId || !lead.email}
                onClick={confirm}
              >
                {saving ? "Provisionando…" : "Converter e provisionar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
