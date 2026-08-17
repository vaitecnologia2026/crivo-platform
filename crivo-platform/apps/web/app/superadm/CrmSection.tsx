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
  archiveLead,
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

// Board em 6 colunas (análise 17/08). É agrupamento de VISUALIZAÇÃO: as 15 etapas
// continuam existindo no banco, nos relatórios e no seletor "Mover etapa" — só
// deixam de ocupar uma coluna cada. PERDIDO segue fora do board (painel "Motivos
// de perda") e as etapas pós-onboarding (implantação → upsell) seguem dobradas.
type ColAction = { label: string; next?: PlatformLeadStage; kind?: "contato" | "habilitar" | "onboarding" };
type BoardCol = {
  key: string;
  label: string;
  /** O que precisa ser verdade para o card estar aqui — tira a dúvida de onde ele deveria estar. */
  criteria: string;
  stages: PlatformLeadStage[];
  /** Só onde acrescenta algo que o título da coluna já não diz. */
  pill?: { label: string; tone: "lav" | "green" | "blue" | "gray" };
  /** Coluna onde o relógio COMERCIAL não corre (pós-venda): o tempo continua
   *  escrito no card, mas nunca em âmbar/vermelho. Um cliente já implantado, em
   *  sustentação, não tem toque comercial a cada três semanas — deixá-lo alarmar
   *  pintaria a coluna inteira de vermelho e o alerta perderia o sentido nas
   *  colunas onde ele estava certo. */
  semAlerta?: boolean;
  /** Ação primária do card: avança para `next` (ou ação especial via `kind`). */
  action: ColAction;
  /** Coluna que junta etapas: cada etapa mantém a SUA ação, para que a fusão não
   *  apague nenhuma transição de um clique. Sem entrada aqui, vale `action`. */
  stageActions?: Partial<Record<PlatformLeadStage, ColAction>>;
};
const COLUMNS: BoardCol[] = [
  { key: "novos", label: "Novos", criteria: "Chegou e ninguém falou ainda", stages: ["NOVO"],
    pill: { label: "Sem 1º contato", tone: "lav" },
    action: { label: "Marcar 1º contato", kind: "contato", next: "OPORTUNIDADE" } },
  { key: "contato", label: "Em contato", criteria: "Já conversamos, faz sentido", stages: ["OPORTUNIDADE"],
    action: { label: "Agendar diagnóstico", next: "PRE_DIAGNOSTICO" } },
  { key: "diagnostico", label: "Diagnóstico", criteria: "Reunião ou pré-diagnóstico em curso", stages: ["PRE_DIAGNOSTICO", "REUNIAO"],
    action: { label: "Enviar proposta", next: "PROPOSTA" } },
  { key: "proposta", label: "Proposta", criteria: "Proposta na mesa, em negociação", stages: ["PROPOSTA", "NEGOCIACAO"],
    action: { label: "Registrar fechamento", next: "FECHADO" },
    stageActions: { PROPOSTA: { label: "Iniciar negociação", next: "NEGOCIACAO" } } },
  { key: "fechado", label: "Fechado", criteria: "Assinou; contrato sendo preparado", stages: ["FECHADO", "CONTRATO"],
    semAlerta: true,
    action: { label: "Gerar contrato rascunho", next: "CONTRATO" },
    stageActions: { CONTRATO: { label: "Enviar assinatura", kind: "habilitar", next: "ONBOARDING" } } },
  { key: "ativo", label: "Cliente ativo", criteria: "Sistema liberado, em implantação", stages: ["ONBOARDING", "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL"],
    semAlerta: true,
    action: { label: "Ver onboarding", kind: "onboarding" } },
];
const ALL_STAGES: PlatformLeadStage[] = [...COLUMNS.flatMap((c) => c.stages), "PERDIDO"];

/** Etapas anteriores ao Fechamento. Lead já convertido (sistema liberado) não
 *  regride para elas — regra que já valia no select "Mover etapa"; virou
 *  constante para o arraste obedecer EXATAMENTE a mesma, sem duplicar a lista. */
const PRE_FECHAMENTO: PlatformLeadStage[] = ["NOVO", "OPORTUNIDADE", "PRE_DIAGNOSTICO", "REUNIAO", "PROPOSTA", "NEGOCIACAO"];

/** Etapa de destino ao soltar um card numa coluna — ou `null` quando o arraste
 *  não deve mudar nada. Uma coluna dobra várias etapas (Pré-diagnóstico =
 *  PRE_DIAGNOSTICO+REUNIAO; Onboarding = 6): se o lead JÁ está numa delas,
 *  soltar ali não move, senão largar de volta rebaixaria REUNIAO para
 *  PRE_DIAGNOSTICO. Convertido não volta para antes do Fechamento. */
function dropStage(lead: PlatformLeadSummary, col: BoardCol): PlatformLeadStage | null {
  if (col.stages.includes(lead.stage)) return null;
  const target = col.stages[0];
  if (lead.convertedTenantId && PRE_FECHAMENTO.includes(target)) return null;
  return target;
}

/** Quem cuida e o tamanho da empresa numa linha só, por extenso: "Resp." e
 *  "Func." abreviados não se leem de primeira por quem chegou agora. */
function quemEQuantos(lead: PlatformLeadSummary): string {
  const quem = lead.commercialOwner?.trim() || "Sem responsável";
  return lead.employeesCount ? `${quem} · ${lead.employeesCount} funcionários` : quem;
}

/** Dias desde a última movimentação do lead.
 *  ATENÇÃO ao rótulo: é "sem movimentação" (qualquer alteração no lead), NÃO
 *  "parado nesta etapa" — o lead guarda `updatedAt`, não a data de entrada na
 *  etapa. Chamar de outra coisa seria mentir com o dado que existe hoje. */
function diasSemMovimento(lead: PlatformLeadSummary): number {
  const ms = Date.now() - new Date(lead.updatedAt).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
const AGE_ATENCAO = 7;
const AGE_CRITICO = 21;
function ageTone(dias: number): "ok" | "warn" | "bad" {
  if (dias >= AGE_CRITICO) return "bad";
  if (dias >= AGE_ATENCAO) return "warn";
  return "ok";
}
function ageLabel(dias: number): string {
  if (dias === 0) return "Movimentado hoje";
  return dias === 1 ? "1 dia sem movimentação" : `${dias} dias sem movimentação`;
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

/**
 * Preenchimento rápido no próprio card: dono e próximo passo — os dois campos
 * que TODO lead recém-chegado não tem, porque chega pela landing page sem dono
 * e sem próxima ação definida. Antes, preencher os dois exigia abrir o ⋮ e
 * encarar 10 campos e 13 caixas de seleção.
 *
 * Não há endpoint novo: usa os MESMOS `setLeadCommercial` e `setLeadNextAction`
 * do editor comercial completo, que continua inteiro no ⋮.
 *
 * A data vem junto por necessidade, não por escolha: o backend faz `?? null` nos
 * dois campos da próxima ação, então salvar só a nota APAGARIA a data já gravada.
 */
function QuickFill({
  lead,
  busy,
  onOwner,
  onNextAction,
  onClose,
}: {
  lead: PlatformLeadSummary;
  busy: boolean;
  onOwner: (v: string) => void | Promise<void>;
  onNextAction: (at: string, note: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const atInicial = lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : "";
  const [owner, setOwner] = useState(lead.commercialOwner ?? "");
  const [note, setNote] = useState(lead.nextActionNote ?? "");
  const [at, setAt] = useState(atInicial);

  const ownerChanged = owner !== (lead.commercialOwner ?? "");
  const naChanged = note !== (lead.nextActionNote ?? "") || at !== atInicial;

  async function salvar() {
    // Só grava o que mudou — o editor completo continua dono do resto.
    if (ownerChanged) await onOwner(owner);
    if (naChanged) await onNextAction(at, note);
    onClose();
  }

  return (
    <div className="crm-quick">
      <span style={EDITOR_LABEL}>Responsável</span>
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
      <span style={EDITOR_LABEL}>Próximo passo</span>
      <input
        type="text"
        className="kb-stage-select"
        value={note}
        maxLength={240}
        disabled={busy}
        placeholder="O que fazer (ex.: ligar)"
        onChange={(e) => setNote(e.target.value)}
        aria-label="O que fazer na próxima ação"
      />
      <span style={EDITOR_LABEL}>Quando</span>
      <input
        type="date"
        className="kb-stage-select"
        value={at}
        disabled={busy}
        onChange={(e) => setAt(e.target.value)}
        aria-label="Data da próxima ação"
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" className="crm-btn" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className="crm-btn crm-btn--dark"
          onClick={salvar}
          disabled={busy || (!ownerChanged && !naChanged)}
        >
          Salvar
        </button>
      </div>
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
  const [quickId, setQuickId] = useState<string | null>(null); // card no preenchimento rápido
  const [dragId, setDragId] = useState<string | null>(null); // card sendo arrastado
  const [overCol, setOverCol] = useState<string | null>(null); // coluna sob o cursor

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

  /** Conclui a jornada do lead — sai do kanban (empresa segue em Grupos e Empresas). */
  async function archive(id: string) {
    if (!window.confirm("Concluir a jornada deste lead? Ele sai do funil (a empresa continua em Grupos e Empresas)."))
      return;
    setBusyId(id);
    try {
      const updated = await archiveLead(id, true);
      setLeads((prev) => prev?.map((l) => (l.id === id ? updated : l)) ?? prev);
    } catch {
      try { setLeads(await listLeads()); } catch { /* mantém */ }
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

  /** Arraste do card entre as colunas — HTML5 nativo, sem biblioteca nova.
   *  Só monta o transporte; quem move o lead continua sendo o `move()` acima,
   *  o mesmo do select "Mover etapa" (otimista, com recarga se o PATCH falhar). */
  function onCardDragStart(e: React.DragEvent, lead: PlatformLeadSummary) {
    // Começar o arraste em cima de um controle roubaria o clique dele.
    if ((e.target as HTMLElement).closest("input, textarea, select, button, a")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(lead.id);
  }

  function onCardDragEnd() {
    setDragId(null);
    setOverCol(null);
  }

  /** Sinaliza a coluna que aceita o card. Sem `preventDefault` o navegador não
   *  deixa soltar — é assim que a coluna que não mudaria nada recusa o drop. */
  function onColDragOver(e: React.DragEvent, col: BoardCol) {
    const lead = (leads ?? []).find((l) => l.id === dragId);
    if (!lead || dropStage(lead, col) == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overCol !== col.key) setOverCol(col.key);
  }

  function onColDragLeave(e: React.DragEvent, col: BoardCol) {
    // `dragleave` também dispara ao passar de um card para outro DENTRO da
    // coluna; só apaga o destaque quando o cursor sai mesmo da coluna.
    const to = e.relatedTarget as Node | null;
    if (to && e.currentTarget.contains(to)) return;
    setOverCol((k) => (k === col.key ? null : k));
  }

  function onColDrop(e: React.DragEvent, col: BoardCol) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverCol(null);
    const lead = (leads ?? []).find((l) => l.id === id);
    if (!lead) return;
    const stage = dropStage(lead, col);
    if (stage) void move(lead.id, stage);
  }

  // Catálogo de soluções (para "solução de interesse") — todas as cadastradas,
  // exceto a de captura de lead (mesma regra do modal de conversão e de Contratos).
  useEffect(() => {
    listProducts()
      .then((ps) => setProducts(ps.filter((p) => !p.isLeadCapture)))
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
      if (l.archivedAt) continue; // jornada concluída — fora do kanban (call 14/07)
      if (l.stage === "PERDIDO") { lost.push(l); continue; }
      const col = COLUMNS.find((c) => c.stages.includes(l.stage));
      map.get(col?.key ?? "novos")?.push(l);
    }
    map.set("__perdidos", lost);
    return map;
  }, [leads]);

  const perdidos = byColumn.get("__perdidos") ?? [];
  const arquivados = (leads ?? []).filter((l) => l.archivedAt).length;
  const abertos = (leads ?? []).filter((l) => l.stage !== "PERDIDO" && !l.archivedAt);
  const total = abertos.length;
  const reunioes = (byColumn.get("diagnostico") ?? []).length;
  const preDiags = abertos.filter((l) => l.diagnosticScore != null).length;
  const semContato = abertos.filter((l) => !l.firstContactedAt && !l.convertedTenantId).length;
  const GANHO: PlatformLeadStage[] = ["FECHADO", "CONTRATO", "ONBOARDING", "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL"];
  const todosLeads = leads ?? [];
  // Ganhos contando TAMBÉM as jornadas já concluídas (arquivadas). Antes o
  // numerador saía de `abertos` e o denominador incluía os arquivados: concluir
  // um cliente ganho o tirava de cima e o mantinha embaixo, então a taxa CAÍA
  // justamente quando a venda dava certo. Mesma conta do "Conversão por origem".
  const ganhosTodos = todosLeads.filter((l) => GANHO.includes(l.stage) || l.convertedTenantId);
  const conv = todosLeads.length ? Math.round((ganhosTodos.length / todosLeads.length) * 100) : 0;
  // Ticket médio dos GANHOS. Sem nenhum ganho com valor mostra "—": cair para a
  // média dos leads em aberto trocava o significado do número sem trocar o rótulo.
  const comValor = ganhosTodos.filter((l) => (l.proposedValueCents ?? 0) > 0);
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
  const [showAdmin, setShowAdmin] = useState(false); // revela o botão destrutivo
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
          {/* "Zerar base" apaga clientes, leads e diagnósticos. Sai de lado a lado
              com uma ação de rotina e passa a exigir abrir "Administração" antes —
              a confirmação por digitação continua exatamente como estava. */}
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowAdmin((v) => !v)}
            aria-expanded={showAdmin}
          >
            {showAdmin ? "Ocultar administração" : "Administração"}
          </button>
          {showAdmin && (
            <button className="btn btn--ghost btn--sm is-danger" onClick={onResetData} disabled={resetting}>
              {resetting ? "Zerando…" : "Zerar base (admin)"}
            </button>
          )}
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
              {/* Conta o tamanho da coluna Diagnóstico, não reuniões marcadas. */}
              <span className="kpi__label">Em diagnóstico</span>
              <strong className="kpi__value">{reunioes}</strong>
            </div>
            <div className="kpi">
              {/* Quem TEM nota de diagnóstico — diferente de estar NA etapa
                  Diagnóstico. Os dois números conviviam com nomes parecidos. */}
              <span className="kpi__label">Leads com diagnóstico feito</span>
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
                <div
                  className={`crm-col${overCol === col.key ? " crm-col--over" : ""}`}
                  key={col.key}
                  onDragOver={(e) => onColDragOver(e, col)}
                  onDragLeave={(e) => onColDragLeave(e, col)}
                  onDrop={(e) => onColDrop(e, col)}
                >
                  <div className="crm-col__head">
                    <span>{col.label}</span>
                    <em>{items.length}</em>
                  </div>
                  {/* Critério de entrada: o que precisa ser verdade para o card estar aqui. */}
                  <p className="crm-col__crit">{col.criteria}</p>
                  {items.map((l) => {
                    const contatoFeito = !!l.firstContactedAt;
                    const pill =
                      col.key === "novos" && contatoFeito
                        ? { label: "Contato feito", tone: "green" as const }
                        : col.pill;
                    // Coluna que junta etapas usa a ação da etapa REAL do lead: sem
                    // isto a fusão apagaria transições de um clique (Proposta →
                    // Negociação, Fechado → Contrato rascunho).
                    const act = col.stageActions?.[l.stage] ?? col.action;
                    // Ação primária da coluna (rótulo/comportamento por etapa).
                    let actionLabel = act.label;
                    let onAction: () => void = () => {};
                    if (act.kind === "contato") {
                      if (!contatoFeito) onAction = () => markContact(l.id);
                      else { actionLabel = "Qualificar lead"; onAction = () => move(l.id, "OPORTUNIDADE"); }
                    } else if (act.kind === "habilitar") {
                      if (l.convertedTenantId) onAction = () => openContract(l.convertedTenantId!);
                      else { actionLabel = "Liberar acesso do cliente"; onAction = () => setConverting(l); }
                    } else if (act.kind === "onboarding") {
                      if (l.convertedTenantId) onAction = () => openContract(l.convertedTenantId!);
                      else { actionLabel = "Liberar acesso do cliente"; onAction = () => setConverting(l); }
                    } else if (act.next) {
                      const n = act.next;
                      onAction = () => move(l.id, n);
                    }
                    const dias = diasSemMovimento(l);
                    // Colunas de pós-venda mantêm o texto e perdem o alarme.
                    const tomIdade = col.semAlerta ? "ok" : ageTone(dias);
                    const faltaDono = !l.commercialOwner?.trim();
                    const faltaProximo = !l.nextActionNote?.trim() && !l.nextActionAt;
                    const expanded = expandedId === l.id;
                    return (
                      <article
                        key={l.id}
                        className={`crm-card${dragId === l.id ? " crm-card--dragging" : ""}`}
                        style={{ opacity: busyId === l.id ? 0.55 : dragId === l.id ? 0.5 : 1 }}
                        /* Card com formulário aberto NÃO arrasta — vale tanto para o
                           editor comercial (⋮) quanto para o preenchimento rápido: os
                           dois têm campos de texto, e um ancestral arrastável
                           atrapalharia a seleção dentro deles. Fechar devolve o arraste. */
                        draggable={busyId !== l.id && !expanded && quickId !== l.id}
                        onDragStart={(e) => onCardDragStart(e, l)}
                        onDragEnd={onCardDragEnd}
                        title={expanded || quickId === l.id ? undefined : "Arraste o card para mover o lead de etapa"}
                      >
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
                        {/* Uma linha por extenso no lugar de duas abreviações. A origem
                            continua no painel do card (⋮), onde também se edita. */}
                        <p className="crm-who">{quemEQuantos(l)}</p>
                        <p className={`crm-age crm-age--${tomIdade}`}>{ageLabel(dias)}</p>
                        {pill && <span className={`crm-pill crm-pill--${pill.tone}`}>{pill.label}</span>}
                        <p className="crm-next">
                          <b>Próximo passo:</b>{" "}
                          {l.nextActionNote
                            ? `${l.nextActionNote}${l.nextActionAt ? ` · ${new Date(l.nextActionAt).toLocaleDateString("pt-BR")}` : ""}`
                            : l.nextActionAt
                              ? new Date(l.nextActionAt).toLocaleDateString("pt-BR")
                              : "—"}
                        </p>
                        <button
                          type="button"
                          className={`crm-btn${col.key === "contato" ? " crm-btn--dark" : ""}`}
                          disabled={busyId === l.id}
                          onClick={onAction}
                        >
                          {actionLabel}
                        </button>
                        {/* Atalho: o que falta vira botão, em vez de virar traço. */}
                        {(faltaDono || faltaProximo) && !expanded && quickId !== l.id && (
                          <button
                            type="button"
                            className="crm-btn crm-btn--quick"
                            disabled={busyId === l.id}
                            onClick={() => setQuickId(l.id)}
                          >
                            + definir {faltaDono && faltaProximo ? "dono e próximo passo" : faltaDono ? "dono" : "próximo passo"}
                          </button>
                        )}
                        {quickId === l.id && (
                          <QuickFill
                            lead={l}
                            busy={busyId === l.id}
                            onOwner={(v) => saveCommercial(l.id, { commercialOwner: v })}
                            onNextAction={(at, note) => saveNextAction(l.id, at, note)}
                            onClose={() => setQuickId(null)}
                          />
                        )}
                        {col.key === "ativo" && (
                          <button
                            type="button"
                            className="crm-btn"
                            disabled={busyId === l.id}
                            onClick={() => archive(l.id)}
                            title="O kanban é uma jornada: concluiu o onboarding, sai do funil."
                          >
                            Concluir jornada (sair do funil)
                          </button>
                        )}

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
                            {!contatoFeito && col.key !== "novos" && (
                              <button type="button" className="kb-report" disabled={busyId === l.id} onClick={() => markContact(l.id)}>
                                Marcar 1º contato
                              </button>
                            )}
                            <span style={EDITOR_LABEL}>Mover etapa</span>
                            <select
                              value={l.stage}
                              disabled={busyId === l.id}
                              onChange={(e) => move(l.id, e.target.value as PlatformLeadStage)}
                              className="kb-stage-select"
                              aria-label="Mover lead no funil"
                            >
                              {/* Convertido não regride para antes do Fechamento (o sistema já foi liberado). */}
                              {ALL_STAGES.filter((s) => s !== "PERDIDO")
                                .filter((s) => !l.convertedTenantId || !PRE_FECHAMENTO.includes(s))
                                .map((s) => (
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
        // TODAS as soluções do catálogo (menos a de captura de lead, que é a porta
        // de entrada e não se contrata). Filtrar por status ACTIVE escondia
        // soluções recém-cadastradas — e Contratos já as listava, então o mesmo
        // produto aparecia lá e sumia aqui. Rascunho aparece sinalizado.
        const active = all.filter((p) => !p.isLeadCapture);
        setProducts(active);
        // Pré-seleciona a solução de interesse do lead (Tela 02 [4]→[3]), se listada.
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
                  {/* O rótulo diz o que o botão FAZ: ele gera uma senha nova e
                      invalida a que está à vista. Chamado só de "Enviar acesso",
                      levava a copiar a senha da conversão e clicar em seguida —
                      e a senha copiada morria sem ninguém perceber. */}
                  {access.sending ? "Enviando…" : "Gerar nova senha e enviar por e-mail"}
                </button>
                {access.sent === true && (
                  <p className="convert-warn" style={{ color: "#1d9e75" }}>
                    Acesso enviado para {done.adminEmail} — a senha acima foi atualizada para a que foi enviada.
                  </p>
                )}
                {access.sent === false && access.reason === "email-not-configured" && (
                  <p className="convert-warn">
                    E-mail ainda não configurado — nada foi enviado, mas a <strong>senha foi
                    trocada</strong>. Use a que está acima e envie manualmente: a anterior deixou de
                    valer.
                  </p>
                )}
                {access.sent === false && access.reason && access.reason !== "email-not-configured" && (
                  <p className="convert-warn">
                    Não foi possível enviar agora, mas a <strong>senha foi trocada</strong>. Use a que
                    está acima: a anterior deixou de valer.
                  </p>
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
                      {p.status !== "ACTIVE" ? " (rascunho)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {products?.length === 0 && (
                <p className="convert-warn">
                  Nenhuma solução cadastrada em Catálogo Comercial · Soluções CRIVO.
                </p>
              )}
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
