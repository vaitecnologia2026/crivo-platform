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

// Ciclo comercial completo (PDF §4.2 CRM Interno): captação → pós-venda.
// PERDIDO sai do board (continua no banco) — movido via o seletor do card.
// PRE_DIAGNOSTICO/REUNIAO (legado) são dobrados na coluna OPORTUNIDADE.
const BOARD: PlatformLeadStage[] = [
  "NOVO", "OPORTUNIDADE", "PROPOSTA", "FECHADO", "CONTRATO", "ONBOARDING",
  "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL",
];
const ALL_STAGES: PlatformLeadStage[] = [...BOARD, "PRE_DIAGNOSTICO", "REUNIAO", "PERDIDO"];

/** Próxima etapa do funil (BOARD em sequência); null se não houver. */
function nextStage(stage: PlatformLeadStage): PlatformLeadStage | null {
  const i = BOARD.indexOf(stage);
  return i >= 0 && i < BOARD.length - 1 ? BOARD[i + 1] : null;
}
// Estágios legados que aparecem dentro de "Oportunidade" no board.
const FOLD_INTO_OPORTUNIDADE: PlatformLeadStage[] = ["PRE_DIAGNOSTICO", "REUNIAO"];

// Board em 4 MACRO-colunas (redesign aprovado pelo Elison, 09/07): as 11 etapas
// finas continuam existindo (pill no card + "Avançar" continua fino) — só a
// APRESENTAÇÃO agrupa, para caber na tela sem scroll horizontal.
const MACROS: { key: string; label: string; help: string; stages: PlatformLeadStage[] }[] = [
  { key: "comercial", label: "Comercial", help: "Da captação à proposta — qualificar e avançar.", stages: ["NOVO", "OPORTUNIDADE", "PROPOSTA"] },
  { key: "fechamento", label: "Fechamento", help: "Negócio ganho — formalizar contrato e habilitar.", stages: ["FECHADO", "CONTRATO"] },
  { key: "entrega", label: "Entrega", help: "Cliente novo — do onboarding à primeira entrega.", stages: ["ONBOARDING", "IMPLANTACAO", "ENTREGA"] },
  { key: "carteira", label: "Carteira", help: "Sustentação, renovação e expansão (upsell).", stages: ["SUSTENTACAO", "RENOVACAO", "UPSELL"] },
];

// Legenda curta de cada passo do funil — ajuda o operador a entender o que cada
// coluna significa e quando mover o lead para a próxima.
const STAGE_HELP: Partial<Record<PlatformLeadStage, string>> = {
  NOVO: "Lead recém-chegado, ainda sem contato ou qualificação.",
  OPORTUNIDADE: "Em conversa/qualificação — pré-diagnóstico ou reunião.",
  PROPOSTA: "Proposta comercial enviada, aguardando decisão.",
  FECHADO: "Negócio ganho — pronto para virar contrato e cliente.",
  CONTRATO: "Contrato assinado e formalização concluída.",
  ONBOARDING: "Boas-vindas e coleta dos dados iniciais do cliente.",
  IMPLANTACAO: "Configuração e ativação do sistema/serviço.",
  ENTREGA: "Primeira entrega/diagnóstico concluído ao cliente.",
  SUSTENTACAO: "Acompanhamento contínuo e suporte ativo.",
  RENOVACAO: "Ciclo perto do fim — hora de renovar o contrato.",
  UPSELL: "Oportunidade de ampliar (novos módulos ou serviços).",
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

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

  const byStage = useMemo(() => {
    const map = new Map<PlatformLeadStage, PlatformLeadSummary[]>();
    for (const s of ALL_STAGES) map.set(s, []);
    for (const l of leads ?? []) {
      // Leads em estágios legados aparecem na coluna Oportunidade.
      const col = FOLD_INTO_OPORTUNIDADE.includes(l.stage) ? "OPORTUNIDADE" : l.stage;
      map.get(col)?.push(l);
    }
    return map;
  }, [leads]);

  const total = leads?.length ?? 0;
  const fechados = byStage.get("FECHADO")?.length ?? 0;
  const reunioes = byStage.get("OPORTUNIDADE")?.length ?? 0;
  const conv = total ? Math.round((fechados / total) * 100) : 0;

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
          <h1 className="page-title">CRM — Funil comercial</h1>
          <p className="page-sub">
            Gestão da jornada comercial CRIVO — da captação do lead ao contrato e onboarding.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--ghost btn--sm" onClick={onDedup} disabled={deduping}>
            {deduping ? "Limpando…" : "Limpar duplicados"}
          </button>
          <button className="btn btn--ghost btn--sm is-danger" onClick={onResetData} disabled={resetting}>
            {resetting ? "Zerando…" : "⚠ Zerar base de teste"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando funil…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os leads.</div>
      )}

      {status === "ok" && leads && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Leads no funil</span>
              <strong className="kpi__value">{total}</strong>
              <span className="kpi__delta">todas as origens</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Reuniões agendadas</span>
              <strong className="kpi__value">{reunioes}</strong>
              <span className="kpi__delta">em negociação</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Taxa de conversão</span>
              <strong className="kpi__value">{conv}%</strong>
              <span className="kpi__delta">fechados / total</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Pré-diagnósticos</span>
              <strong className="kpi__value">{leads.filter((l) => l.diagnosticScore != null).length}</strong>
              <span className="kpi__delta">leads qualificados</span>
            </div>
          </div>

          <div className="kanban kanban--macro">
            {MACROS.map((m) => {
              const items = m.stages.flatMap((s) => byStage.get(s) ?? []);
              const totalValue = items.reduce((sum, l) => sum + (l.proposedValueCents ?? 0), 0);
              return (
                <div className="kb-col kb-col--macro" key={m.key}>
                  <div className="kb-col__head">
                    {m.label}
                    <em>{items.length}{totalValue > 0 ? ` · ${brlCents(totalValue)}` : ""}</em>
                  </div>
                  <p className="kb-col__help">{m.help}</p>
                  {/* Etapas FINAS sempre visíveis como subgrupos (feedback do cliente:
                      "sumiu as etapas" / "Avançar não muda nada") — o card muda de
                      subgrupo ao avançar, e etapas vazias ficam esmaecidas. */}
                  {m.stages.map((s) => {
                    const stageItems = byStage.get(s) ?? [];
                    return (
                      <div className="kb-substage" key={s}>
                        <div
                          className={`kb-substage__head${stageItems.length === 0 ? " is-empty" : ""}`}
                          title={STAGE_HELP[s] ?? ""}
                        >
                          <i aria-hidden="true" />
                          <span>{PLATFORM_LEAD_STAGE_LABEL[s]}</span>
                          <em>{stageItems.length}</em>
                        </div>
                        {stageItems.map((l) => (
                    <article
                      key={l.id}
                      className={`kb-card${l.stage === "FECHADO" ? " kb-card--won" : l.diagnosticScore != null ? " kb-card--hot" : ""}`}
                      style={{ opacity: busyId === l.id ? 0.5 : 1 }}
                    >
                      <strong>{l.company || l.name}</strong>
                      <span className="kb-meta">
                        {l.company ? `${l.name} · ` : ""}
                        {l.segment ?? "—"}
                        {l.employeesCount ? ` · ${l.employeesCount} colab.` : ""}
                      </span>
                      <div className="kb-foot">
                        <span className="kb-score">
                          {l.diagnosticScore != null ? `Pré ${l.diagnosticScore}` : "Sem pré-diag."}
                        </span>
                        {l.riskGrade && (
                          <span
                            className={`kb-risk kb-risk--${l.riskGrade.toLowerCase()}`}
                            title="Grau de risco preliminar (base: CNPJ)"
                          >
                            Risco {l.riskGrade}
                          </span>
                        )}
                        {l.phone && <span className="kb-wpp">{l.phone}</span>}
                      </div>
                      {(l.origin || l.nextActionAt || l.interestProductId || l.proposedValueCents != null || l.commercialOwner) && (
                        <div className="kb-meta" style={{ marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {l.origin && <span title="Origem/canal">◦ {platformLeadOriginLabel(l.origin)}</span>}
                          {l.interestProductId && (
                            <span title="Solução de interesse">
                              ◈ {products.find((p) => p.id === l.interestProductId)?.name ?? "Solução"}
                            </span>
                          )}
                          {l.proposedValueCents != null && (
                            <span title="Valor proposto" style={{ color: "#2E7D4F" }}>{brlCents(l.proposedValueCents)}</span>
                          )}
                          {l.commercialOwner && <span title="Responsável comercial">◭ {l.commercialOwner}</span>}
                          {l.nextActionAt && (
                            <span
                              title={l.nextActionNote ?? "Próxima ação"}
                              style={{ color: new Date(l.nextActionAt) < new Date(new Date().toDateString()) ? "#C0392B" : "#8A6D1F" }}
                            >
                              ▶ {new Date(l.nextActionAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      )}
                      <select
                        value={l.stage}
                        disabled={busyId === l.id || !!l.convertedTenantId}
                        onChange={(e) => move(l.id, e.target.value as PlatformLeadStage)}
                        className="kb-stage-select"
                        aria-label="Mover lead no funil"
                      >
                        {ALL_STAGES.map((s) => (
                          <option key={s} value={s}>{PLATFORM_LEAD_STAGE_LABEL[s]}</option>
                        ))}
                      </select>
                      {l.stage === "PERDIDO" && (
                        <select
                          value={l.lostReason ?? ""}
                          disabled={busyId === l.id}
                          onChange={(e) => setLostReason(l.id, e.target.value)}
                          className="kb-stage-select"
                          style={{ marginTop: 6 }}
                          aria-label="Motivo da perda"
                        >
                          <option value="">Motivo da perda…</option>
                          {PLATFORM_LEAD_LOST_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                      {!l.convertedTenantId && l.stage !== "PERDIDO" && (
                        l.firstContactedAt ? (
                          <span className="kb-meta" style={{ marginTop: 6, color: "#2E7D4F" }}>
                            ✓ 1º contato {new Date(l.firstContactedAt).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="kb-report"
                            style={{ marginTop: 6 }}
                            disabled={busyId === l.id}
                            onClick={() => markContact(l.id)}
                          >
                            ◷ Marcar 1º contato
                          </button>
                        )
                      )}
                      {l.convertedTenantId ? (
                        <>
                          <span className="kb-converted">✓ Cliente Habilitado · sistema liberado</span>
                          <button
                            type="button"
                            className="kb-report"
                            onClick={() => openContract(l.convertedTenantId!)}
                            title="Abrir o contrato da empresa (configurar/assinar)"
                          >
                            ▦ Contrato da empresa
                          </button>
                        </>
                      ) : l.stage === "ONBOARDING" ? (
                        <button type="button" className="kb-convert" onClick={() => setConverting(l)}>
                          Habilitar cliente (sistema) →
                        </button>
                      ) : nextStage(l.stage) ? (
                        <button
                          type="button"
                          className="kb-convert"
                          disabled={busyId === l.id}
                          onClick={() => {
                            const n = nextStage(l.stage);
                            if (n) move(l.id, n);
                          }}
                        >
                          Avançar → {PLATFORM_LEAD_STAGE_LABEL[nextStage(l.stage)!]}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="kb-report"
                        onClick={() => setDataLead(l)}
                        title="Ver todos os dados capturados pelo CNPJ + recomendação CNAE"
                      >
                        ⊙ Ver dados da empresa
                      </button>
                      {l.diagnosticScore != null && (
                        <button
                          type="button"
                          className="kb-report"
                          onClick={() => setReportingLead(l)}
                          title="Gerar Relatório Preliminar CRIVO via IA"
                        >
                          ◈ Relatório CRIVO
                        </button>
                      )}
                      <button
                        type="button"
                        className="kb-report"
                        onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                        title="Registrar origem, solução de interesse e follow-up"
                      >
                        {expandedId === l.id ? "▾ Fechar" : "✎ Registrar (origem · solução · follow-up)"}
                      </button>
                      {expandedId === l.id && (
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
                      )}
                    </article>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {(byStage.get("PERDIDO")?.length ?? 0) > 0 && (
            <p className="dash-state" style={{ marginTop: 16 }}>
              {byStage.get("PERDIDO")!.length} lead(s) marcados como perdidos (fora do funil).
            </p>
          )}
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
