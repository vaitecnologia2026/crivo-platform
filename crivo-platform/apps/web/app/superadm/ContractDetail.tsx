"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ADDON_RECURRENCE_LABEL,
  ADDON_STATUS_LABEL,
  AI_POLICY_STATUS_LABEL,
  CONTRACT_MODEL_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  MODULES,
  ROLE_LABELS,
  TECHNICAL_OUTPUT_LABEL,
  type AddonSummary,
  type AiPolicyData,
  type ContractData,
  type ContractStatus,
  type ProductSummary,
  type TenantSummary,
  type UpsertContractRequest,
  type UserSummary,
} from "@crivo/types";
import {
  deleteContractTemplate,
  getAuditLog,
  getContract,
  getGroupContract,
  listAddons,
  listContractTemplates,
  listProducts,
  listTenantAiPolicies,
  listTenantUsers,
  uploadContractTemplate,
  upsertContract,
  upsertGroupContract,
  type AuditEntry,
  type ContractListItem,
  type ContractTemplateSummary,
} from "@/lib/admin-api";
import { ContractModal } from "./ContractModal";

type Tab = "comercial" | "escopo" | "governanca" | "auditoria";

const TABS: { key: Tab; label: string }[] = [
  { key: "comercial", label: "Comercial" },
  { key: "escopo", label: "Escopo & Liberações" },
  { key: "governanca", label: "Governança & IA" },
  { key: "auditoria", label: "Auditoria & Documentos" },
];

const AUDIT_LABEL: Record<string, string> = {
  "contract.create": "Contrato criado",
  "contract.update": "Contrato atualizado",
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Datas do contrato são date-only (meia-noite UTC). */
const dataUtc = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const STATUS_TONE: Record<string, "ok" | "alert" | "mute"> = {
  ATIVO: "ok",
  RASCUNHO: "mute",
  SUSPENSO: "alert",
  ENCERRADO: "mute",
};

function Chip({ tone, children }: { tone: "ok" | "alert" | "mute"; children: ReactNode }) {
  return <span className={`ge-chip ge-chip--${tone}`}>{children}</span>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ge-field">
      <span className="ge-field__label">{label}</span>
      <span className="ge-field__value">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="gd-kpi gd-kpi--mini">
      <span className="gd-kpi__label">{label}</span>
      <strong className="gd-kpi__value">{value}</strong>
    </div>
  );
}

function BlockList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="ge-field">
      <span className="ge-field__label">{title}</span>
      <ul className="cd-list">
        {items.length === 0 && <li className="cell-mute">—</li>}
        {items.map((i) => <li key={i}>· {i}</li>)}
      </ul>
    </div>
  );
}

function Panel({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="gd-panel cd-panel">
      <div className="cd-panel__head">
        <div>
          <h3 className="cd-panel__title">{title}</h3>
          {sub && <p className="ge-note">{sub}</p>}
        </div>
        {actions && <div className="ge-actions" style={{ marginTop: 0 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

async function exportarXlsx(nome: string, aba: string, rows: Record<string, string | number>[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), aba);
  XLSX.writeFile(wb, `${nome}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Ficha do contrato (protótipo Lovable /contratos/$id): resumo + 4 abas
 *  oficiais. Dados reais do contrato; o que o contrato ainda não guarda
 *  (preço negociado, desconto, condições de pagamento, limite de IA) aparece
 *  como "a definir". Edição completa continua no formulário (Editar contrato). */
export function ContractDetail({
  row,
  tenants,
  groupName,
  onBack,
  onChanged,
}: {
  row: ContractListItem;
  tenants: TenantSummary[];
  groupName?: string | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const isGroup = row.byGroup && !!row.groupId;
  const tenant = !isGroup ? tenants.find((t) => t.id === row.tenantId) ?? null : null;
  const escopo = isGroup ? tenants.filter((t) => t.groupId === row.groupId && t.status !== "DELETED") : tenant ? [tenant] : [];
  const auditTarget = isGroup ? row.groupId : tenant?.organizationId ?? null;

  const [tab, setTab] = useState<Tab>("comercial");
  const [contract, setContract] = useState<ContractData | null | undefined>(undefined);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [addons, setAddons] = useState<AddonSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [policies, setPolicies] = useState<AiPolicyData[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function carregarContrato() {
    try {
      const c = isGroup ? await getGroupContract(row.groupId!) : row.tenantId ? await getContract(row.tenantId) : null;
      setContract(c);
      setSel(c?.optionalModules ?? []);
    } catch {
      setContract(null);
    }
  }
  async function carregarAuditoria() {
    if (!auditTarget) return setAudit([]);
    try {
      setAudit(await getAuditLog({ target: auditTarget, prefixes: ["contract."], limit: 100 }));
    } catch {
      setAudit([]);
    }
  }

  const escopoIds = escopo.map((t) => t.id).join(",");
  useEffect(() => {
    void carregarContrato();
    void carregarAuditoria();
    listProducts().then(setProducts).catch(() => setProducts([]));
    listAddons().then(setAddons).catch(() => setAddons([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  // Usuários e política dependem da lista de empresas (chega depois da lista de contratos).
  useEffect(() => {
    Promise.all(escopo.map((t) => listTenantUsers(t.id).catch(() => [] as UserSummary[])))
      .then((xs) => setUsers(xs.flat().filter((u) => u.active)))
      .catch(() => setUsers([]));
    if (tenant) listTenantAiPolicies(tenant.id).then(setPolicies).catch(() => setPolicies([]));
    else setPolicies([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoIds]);

  async function salvar(dto: UpsertContractRequest, ok: string) {
    setSaving(true);
    setMsg(null);
    try {
      const c = isGroup ? await upsertGroupContract(row.groupId!, dto) : await upsertContract(row.tenantId!, dto);
      setContract(c);
      setSel(c.optionalModules);
      setMsg(ok);
      void carregarAuditoria();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar o contrato");
    } finally {
      setSaving(false);
    }
  }

  function trocarStatus(s: ContractStatus) {
    if (!contract || s === contract.status) return;
    const aviso =
      s === "ATIVO"
        ? "Ativar o contrato libera na empresa os módulos das soluções e adicionais contratados. Confirmar?"
        : `Mudar o status do contrato para "${CONTRACT_STATUS_LABEL[s]}"?`;
    if (!confirm(aviso)) return;
    void salvar({ status: s }, s === "ATIVO" ? "Contrato ativado. Acessos liberados conforme contrato." : "Status do contrato alterado.");
  }

  // ── Derivados do contrato ──
  const sols = (contract?.solutionIds ?? [])
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is ProductSummary => !!p);
  const adds = (contract?.optionalModules ?? []).map(
    (code) => addons.find((a) => a.moduleCode === code) ?? ({ moduleCode: code, label: code } as AddonSummary),
  );
  const moduleNames = new Map<string, string>(MODULES.map((m) => [m.code, m.name]));
  const moduleCats = new Map<string, string>(MODULES.map((m) => [m.code, m.category]));
  const origem = new Map<string, string[]>();
  const marca = (code: string, de: string) => {
    if (!moduleNames.has(code)) return;
    origem.set(code, [...(origem.get(code) ?? []), de]);
  };
  for (const p of sols) for (const c of [...p.modules, ...p.coreModules]) marca(c, `Solução ${p.name}`);
  for (const a of adds) {
    marca(a.moduleCode, `Adicional ${a.label}`);
    for (const c of a.activatedModules ?? []) marca(c, `Adicional ${a.label}`);
  }
  const liberados = [...origem.keys()];
  const naoLiberados = MODULES.filter((m) => !origem.has(m.code)).map((m) => m.name);
  const ativo = contract?.status === "ATIVO";

  const setupCents = sols.reduce((s, p) => s + p.setupPriceCents, 0) + adds.reduce((s, a) => s + (a.setupPriceCents ?? 0), 0);
  const mrrCents = row.mrrCents;
  const meses =
    contract?.startDate && contract?.endDate
      ? Math.max(1, Math.round((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (30.44 * 86_400_000)))
      : null;

  const composicao = [
    ...sols.map((p) => ({
      item: p.name,
      nota: p.category ?? "",
      tipo: "Solução",
      publico: p.companyType ?? "—",
      modelo: contract ? CONTRACT_MODEL_LABEL[contract.model] : "—",
      qtd: "1",
      ref: p.priceLabel || (p.monthlyPriceCents ? `${brl(p.monthlyPriceCents)}/mês` : "—"),
      implantacao: p.setupPriceCents ? brl(p.setupPriceCents) : "—",
      recorrencia: p.monthlyPriceCents ? "Mensal" : "Única",
      subtotal: p.monthlyPriceCents ? `${brl(p.monthlyPriceCents)}/mês` : p.setupPriceCents ? brl(p.setupPriceCents) : "—",
    })),
    ...adds.map((a) => ({
      item: a.label,
      nota: a.description ?? "",
      tipo: "Adicional",
      publico: a.category ?? "—",
      modelo: a.recurring ? "Recorrente" : "Avulso",
      qtd: "1",
      ref: a.priceLabel || (a.monthlyPriceCents ? `${brl(a.monthlyPriceCents)}/mês` : "—"),
      implantacao: a.setupPriceCents ? brl(a.setupPriceCents) : "—",
      recorrencia: a.recurrence ? ADDON_RECURRENCE_LABEL[a.recurrence] : "—",
      subtotal: a.monthlyPriceCents ? `${brl(a.monthlyPriceCents)}/mês` : a.setupPriceCents ? brl(a.setupPriceCents) : "—",
    })),
  ];

  const porPapel = new Map<string, string[]>();
  for (const u of users ?? []) porPapel.set(u.role, [...(porPapel.get(u.role) ?? []), u.name]);
  const iaLiberada = sols.some((p) => p.allowsAi) || liberados.some((c) => c === "contexto" || c === "govia");
  const politica = [...(policies ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  const recursos = [
    {
      nome: "Mentorias",
      tipo: "Serviço",
      regra: contract?.contractedHours != null ? `${contract.contractedHours} h contratadas no ciclo` : "Horas não informadas no contrato",
      publico: "Líderes",
    },
    {
      nome: "Documentos técnicos",
      tipo: "Entregável",
      regra: contract ? TECHNICAL_OUTPUT_LABEL[contract.technicalOutput] : "—",
      publico: "Empresa",
    },
    ...(liberados.includes("biblioteca")
      ? [{ nome: "Academia CRIVO", tipo: "Conteúdo", regra: "Liberada pelo módulo Academia", publico: "Colaboradores" }]
      : []),
  ];

  const titulo = isGroup ? `Grupo ${row.clientName}` : `${row.clientName}${groupName ? ` · ${groupName}` : ""}`;
  const cnpjs = escopo.map((t) => (t.cnpj ? formatCnpj(t.cnpj) : null)).filter(Boolean).join(", ");
  const unidades = escopo.flatMap((t) => t.stats?.unitNames ?? []).join(" · ");

  return (
    <div>
      <button type="button" className="linklike" style={{ fontSize: 12, marginBottom: 10 }} onClick={onBack}>
        ← Contratos e Liberações
      </button>
      <div className="route__head">
        <div>
          <h1 className="page-title">Contrato {row.shortId}</h1>
          <p className="page-sub">
            Fonte de verdade das liberações do cliente. 4 abas oficiais consolidam Comercial, Escopo, Governança e Auditoria.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {contract && <Chip tone={STATUS_TONE[contract.status] ?? "mute"}>{CONTRACT_STATUS_LABEL[contract.status]}</Chip>}
          <button type="button" className="btn btn--outline-dark btn--sm" disabled={!contract} onClick={() => setEditing(true)}>
            Editar contrato
          </button>
        </div>
      </div>

      {contract === undefined && <p className="dash-state">Carregando contrato…</p>}
      {contract === null && <div className="dash-state dash-state--error">Não foi possível carregar este contrato.</div>}

      {contract && (
        <>
          <div className="gd-panel cd-summary">
            <Field label="Cliente / Grupo" value={titulo} />
            <Field label="CNPJs" value={cnpjs || "—"} />
            <Field label="Unidades" value={unidades || "—"} />
            <Field
              label="Vigência"
              value={contract.startDate || contract.endDate
                ? `${dataUtc(contract.startDate)} → ${dataUtc(contract.endDate)}`
                : contract.accessDays ? `${contract.accessDays} dias de acesso` : "—"}
            />
            <Field label="Responsável interno" value={contract.responsible || "—"} />
            <Field label="Responsável cliente" value={tenant?.internalResponsible || "—"} />
            <Field label="Modelo comercial" value={CONTRACT_MODEL_LABEL[contract.model]} />
            <Field label="Status" value={<Chip tone={STATUS_TONE[contract.status] ?? "mute"}>{CONTRACT_STATUS_LABEL[contract.status]}</Chip>} />
          </div>

          <div className="adm-tabs" style={{ marginTop: 20 }}>
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`adm-tab${tab === t.key ? " is-active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {msg && <div className="adm-callout" style={{ borderLeftColor: "var(--gold)" }}>{msg}</div>}

          {/* ═══ 1 · COMERCIAL ═══ */}
          {tab === "comercial" && (
            <div className="cd-stack">
              <div className="cd-stats3">
                <Stat label="Soluções" value={String(sols.length)} />
                <Stat label="Módulos liberados" value={String(liberados.length)} />
                <Stat label="Adicionais contratados" value={String(adds.length)} />
              </div>

              <Panel
                title="Composição comercial"
                sub="Soluções, variantes e adicionais como linhas separadas — cada uma com modelo, preço, desconto, implantação, recorrência e vigência."
                actions={
                  <>
                    <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => setEditing(true)}>Adicionar linha</button>
                    <button
                      type="button"
                      className="btn btn--outline-dark btn--sm"
                      disabled={!composicao.length}
                      onClick={() =>
                        void exportarXlsx(`contrato-${row.shortId}-composicao`, "Composicao", composicao.map((l) => ({
                          Item: l.item, Tipo: l.tipo, "Público / escopo": l.publico, Modelo: l.modelo, Qtd: l.qtd,
                          "Preço ref.": l.ref, "Preço negociado": "a definir", Desconto: "a definir", Implantação: l.implantacao,
                          Recorrência: l.recorrencia, Início: dataUtc(contract.startDate), Fim: dataUtc(contract.endDate), Subtotal: l.subtotal,
                        })))
                      }
                    >
                      ↓ Exportar XLSX
                    </button>
                  </>
                }
              >
                <div className="ge-subtable">
                  <table className="data-table cd-nowrap" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Item</th><th>Tipo</th><th>Público / escopo</th><th>Modelo</th><th>Qtd</th><th>Preço ref.</th>
                        <th>Preço negociado</th><th>Desc.</th><th>Implantação</th><th>Recorrência</th><th>Início</th><th>Fim</th>
                        <th style={{ textAlign: "right" }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {composicao.map((l) => (
                        <tr key={`${l.tipo}-${l.item}`}>
                          <td>
                            <strong>{l.item}</strong>
                            {l.nota && <div className="cell-mute cd-wrap" style={{ fontSize: 10.5 }}>{l.nota}</div>}
                          </td>
                          <td><Chip tone="ok">{l.tipo}</Chip></td>
                          <td className="cell-mute">{l.publico}</td>
                          <td>{l.modelo}</td>
                          <td>{l.qtd}</td>
                          <td className="cell-mute">{l.ref}</td>
                          <td className="cell-mute">a definir</td>
                          <td className="cell-mute">a definir</td>
                          <td>{l.implantacao}</td>
                          <td>{l.recorrencia}</td>
                          <td>{dataUtc(contract.startDate)}</td>
                          <td>{dataUtc(contract.endDate)}</td>
                          <td style={{ textAlign: "right" }}><strong>{l.subtotal}</strong></td>
                        </tr>
                      ))}
                      {composicao.length === 0 && (
                        <tr><td colSpan={13} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhuma solução ou adicional no contrato.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="cd-warn">
                  Os valores do catálogo são referências. O valor final é definido na proposta e preservado no contrato como
                  snapshot comercial. Preço negociado e desconto por linha ainda não têm campo no contrato.
                </div>
              </Panel>

              <Panel title="Preço final e condições">
                <div className="ge-fields">
                  <Field label="Modelo comercial" value={CONTRACT_MODEL_LABEL[contract.model]} />
                  <Field label="Ciclo" value={`${contract.rounds} ${contract.rounds === 1 ? "ciclo" : "ciclos"}`} />
                  <Field
                    label="Valor total do contrato"
                    value={meses ? `${brl(mrrCents * meses + setupCents)} (estimado · ${meses} meses)` : "a definir (sem vigência)"}
                  />
                  <Field label="Implantação (única)" value={setupCents ? brl(setupCents) : "—"} />
                  <Field label="Recorrente mensal" value={brl(mrrCents)} />
                  <Field label="Recorrente anual" value={brl(mrrCents * 12)} />
                  <Field label="Contribuição ao MRR" value={ativo ? brl(mrrCents) : "R$ 0 (contrato não ativo)"} />
                  <Field label="Contribuição ao ARR" value={ativo ? brl(mrrCents * 12) : "R$ 0 (contrato não ativo)"} />
                  <Field label="Condições de pagamento" value="a definir" />
                  <Field label="Data-base" value={dataUtc(contract.startDate)} />
                </div>
              </Panel>

              <ModeloContratoPanel />
            </div>
          )}

          {/* ═══ 2 · ESCOPO & LIBERAÇÕES ═══ */}
          {tab === "escopo" && (
            <div className="cd-stack">
              <Panel title="Composição contratada">
                <div className="ge-fields">
                  <BlockList title="Soluções" items={sols.map((p) => p.name)} />
                  <BlockList title="Adicionais" items={adds.map((a) => a.label)} />
                  <BlockList title="Módulos" items={liberados.map((c) => moduleNames.get(c) ?? c)} />
                  <BlockList title="Recursos liberados" items={recursos.map((r) => r.nome)} />
                </div>
              </Panel>

              <Panel
                title="Adicionais deste contrato"
                sub="Ative ou desative — cada mudança gera evento em Auditoria."
                actions={
                  <button
                    type="button"
                    className="btn btn--gold btn--sm"
                    disabled={saving || JSON.stringify([...sel].sort()) === JSON.stringify([...contract.optionalModules].sort())}
                    onClick={() => void salvar({ optionalModules: sel }, "Adicionais salvos no contrato.")}
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                }
              >
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr><th>Adicional</th><th>Categoria</th><th>Modelo de cobrança</th><th>Recorrência</th><th>Status</th><th style={{ textAlign: "right" }}>Contratado</th></tr>
                    </thead>
                    <tbody>
                      {addons.map((a) => {
                        const on = sel.includes(a.moduleCode);
                        return (
                          <tr key={a.moduleCode}>
                            <td><strong>{a.label}</strong></td>
                            <td className="cell-mute">{a.category}</td>
                            <td>{a.priceLabel || (a.monthlyPriceCents ? `${brl(a.monthlyPriceCents)}/mês` : a.setupPriceCents ? brl(a.setupPriceCents) : "—")}</td>
                            <td className="cell-mute">{ADDON_RECURRENCE_LABEL[a.recurrence] ?? "—"}</td>
                            <td><Chip tone={a.active ? "ok" : "mute"}>{a.active ? ADDON_STATUS_LABEL[a.statusEx] ?? "Ativo" : "Inativo"}</Chip></td>
                            <td style={{ textAlign: "right" }}>
                              <label className="cd-switch" title={on ? "Contratado" : "Não contratado"}>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => setSel((s) => (on ? s.filter((c) => c !== a.moduleCode) : [...s, a.moduleCode]))}
                                />
                                <span />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                      {addons.length === 0 && (
                        <tr><td colSpan={6} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhum adicional no catálogo.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel
                title="Liberações técnicas calculadas"
                sub="Calculadas automaticamente a partir dos itens comerciais. Sem preço próprio. Só valem com o contrato ativo; ajuste manual de módulo fica em Grupos e Empresas-cliente e vira evento em Auditoria."
              >
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Módulo</th><th>Categoria</th><th>Origem</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
                    <tbody>
                      {liberados.map((c) => (
                        <tr key={c}>
                          <td><strong>{moduleNames.get(c)}</strong></td>
                          <td className="cell-mute">{moduleCats.get(c)}</td>
                          <td style={{ fontSize: 12 }}>{[...new Set(origem.get(c))].join(" · ")}</td>
                          <td style={{ textAlign: "right" }}>
                            <Chip tone={ativo ? "ok" : "mute"}>{ativo ? "Liberado" : "Aguarda ativação"}</Chip>
                          </td>
                        </tr>
                      ))}
                      {liberados.length === 0 && (
                        <tr><td colSpan={4} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhum módulo calculado — escolha as soluções e adicionais no contrato.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {naoLiberados.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <span className="ge-field__label">Não liberados por este contrato</span>
                    <ul className="cd-dots">
                      {naoLiberados.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </Panel>

              <Panel title="Limites do contrato">
                <div className="cd-stats4">
                  <Stat label="Usuários" value={contract.maxRespondents ? String(contract.maxRespondents) : "Ilimitado"} />
                  <Stat label="Líderes" value={contract.maxLeaders ? String(contract.maxLeaders) : "Ilimitado"} />
                  <Stat label="CNPJs" value={String(escopo.length || 1)} />
                  <Stat label="Ciclos" value={String(contract.rounds)} />
                  <Stat label="Prazo de acesso" value={contract.accessDays ? `${contract.accessDays} dias` : meses ? `${meses} meses` : "—"} />
                  <Stat label="Horas de mentoria" value={contract.contractedHours != null ? `${contract.contractedHours} h` : "—"} />
                  <Stat label="Saída técnica" value={TECHNICAL_OUTPUT_LABEL[contract.technicalOutput]} />
                  <Stat label="Uso IA" value="a definir" />
                </div>
              </Panel>

              <Panel title="Recursos da entrega">
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Recurso</th><th>Tipo</th><th>Regra de liberação</th><th>Público</th></tr></thead>
                    <tbody>
                      {recursos.map((r) => (
                        <tr key={r.nome}>
                          <td><strong>{r.nome}</strong></td>
                          <td className="cell-mute">{r.tipo}</td>
                          <td className="cell-mute">{r.regra}</td>
                          <td className="cell-mute">{r.publico}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {/* ═══ 3 · GOVERNANÇA & IA ═══ */}
          {tab === "governanca" && (
            <div className="cd-stack">
              <Panel title="IA no contrato">
                <div className="ge-fields">
                  <Field label="IA liberada no contrato" value={<Chip tone={iaLiberada ? "ok" : "alert"}>{iaLiberada ? "Sim" : "Não"}</Chip>} />
                  <Field
                    label="Política vinculada"
                    value={isGroup
                      ? "Por empresa (ver cada CNPJ)"
                      : policies === null ? "…" : politica
                        ? `${politica.title} · v${politica.version} (${AI_POLICY_STATUS_LABEL[politica.status]})`
                        : "Nenhuma política cadastrada"}
                  />
                  <Field label="Validação humana antes de publicar" value={<Chip tone="ok">Obrigatória</Chip>} />
                  <Field label="Uso de IA (limite)" value="a definir" />
                </div>
              </Panel>

              <Panel title="Papéis e usuários" sub={isGroup ? "Usuários ativos de todos os CNPJs do grupo." : "Usuários ativos do portal da empresa."}>
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Papel</th><th>Pessoas vinculadas</th></tr></thead>
                    <tbody>
                      {users === null && <tr><td colSpan={2} className="cell-mute">Carregando…</td></tr>}
                      {[...porPapel.entries()].map(([papel, nomes]) => (
                        <tr key={papel}>
                          <td><strong>{ROLE_LABELS[papel as keyof typeof ROLE_LABELS] ?? papel}</strong></td>
                          <td className="cd-wrap">
                            {nomes.length} · <span className="cell-mute">{nomes.slice(0, 5).join(", ")}{nomes.length > 5 ? "…" : ""}</span>
                          </td>
                        </tr>
                      ))}
                      {users?.length === 0 && <tr><td colSpan={2} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhum usuário ativo.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="gd-rulebox" style={{ marginTop: 0 }}>
                A IA apoia a decisão. Não valida diagnóstico, plano, evidência, dossiê ou parecer sem revisão humana.
                Alterações em política ou permissão geram evento em Auditoria.
              </div>
            </div>
          )}

          {/* ═══ 4 · AUDITORIA & DOCUMENTOS ═══ */}
          {tab === "auditoria" && (
            <div className="cd-stack">
              <Panel title="Status e ativação">
                <div className="cd-status">
                  <span className="cell-mute">Alterar status:</span>
                  {CONTRACT_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`gd-pill${s === contract.status ? " is-active" : ""}`}
                      disabled={saving}
                      onClick={() => trocarStatus(s)}
                    >
                      {CONTRACT_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <div className="ge-actions">
                  <button type="button" className="btn btn--gold btn--sm" disabled={ativo || saving} onClick={() => trocarStatus("ATIVO")}>
                    {ativo ? "Contrato ativo" : "Ativar contrato e liberar acessos"}
                  </button>
                </div>
                <p className="ge-note">Cada alteração de status é registrada abaixo.</p>
              </Panel>

              <Panel
                title="Trilha de auditoria"
                actions={
                  <button
                    type="button"
                    className="btn btn--outline-dark btn--sm"
                    disabled={!audit?.length}
                    onClick={() =>
                      void exportarXlsx(`contrato-${row.shortId}-auditoria`, "Auditoria", (audit ?? []).map((a) => ({
                        Quando: new Date(a.at).toLocaleString("pt-BR"),
                        Quem: a.actorEmail ?? "sistema",
                        Ação: AUDIT_LABEL[a.action] ?? a.action,
                        Status: typeof a.meta?.status === "string" ? CONTRACT_STATUS_LABEL[a.meta.status as ContractStatus] ?? a.meta.status : "",
                      })))
                    }
                  >
                    ↓ Exportar XLSX
                  </button>
                }
              >
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Status gravado</th></tr></thead>
                    <tbody>
                      {audit === null && <tr><td colSpan={4} className="cell-mute">Carregando…</td></tr>}
                      {(audit ?? []).map((a) => (
                        <tr key={a.id}>
                          <td className="cell-mute" style={{ whiteSpace: "nowrap" }}>{new Date(a.at).toLocaleString("pt-BR")}</td>
                          <td>{a.actorEmail ?? "sistema"}</td>
                          <td>{AUDIT_LABEL[a.action] ?? a.action}</td>
                          <td>
                            {typeof a.meta?.status === "string"
                              ? <Chip tone={STATUS_TONE[a.meta.status] ?? "mute"}>{CONTRACT_STATUS_LABEL[a.meta.status as ContractStatus] ?? a.meta.status}</Chip>
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {audit?.length === 0 && <tr><td colSpan={4} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Sem eventos registrados para este contrato.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          <div className="gd-rulebox">
            <div className="gd-rulebox__title">Regras desta tela</div>
            Fonte de verdade das liberações do cliente. Soluções, módulos, adicionais, limites, IA, recursos e permissões
            são administrados a partir deste contrato. Contrato em rascunho não libera portal; contrato ativo libera apenas
            o contratado. Alterações geram evento em <b>Auditoria &amp; Documentos</b>.
          </div>
        </>
      )}

      {editing && (
        <ContractModal
          tenant={isGroup ? undefined : tenant ?? ({ id: row.tenantId!, name: row.clientName } as TenantSummary)}
          group={isGroup ? { id: row.groupId!, name: row.clientName } : undefined}
          onClose={() => {
            setEditing(false);
            void carregarContrato();
            void carregarAuditoria();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ── Modelo de contrato (arquivo usado na assinatura via Clicksign) ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** Modelos de contrato da plataforma (valem para todos os contratos). */
function ModeloContratoPanel() {
  const [items, setItems] = useState<ContractTemplateSummary[] | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setItems(await listContractTemplates());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar.");
      setItems([]);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function upload() {
    if (!file) return setErr("Selecione um arquivo (PDF ou DOCX).");
    if (file.size > MAX_BYTES) return setErr("Arquivo muito grande (máx. 8 MB).");
    setBusy(true);
    setErr(null);
    try {
      await uploadContractTemplate({
        name: name.trim() || file.name,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data: await fileToBase64(file),
      });
      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este modelo de contrato?")) return;
    await deleteContractTemplate(id).catch(() => undefined);
    await refresh();
  }

  const atual = items?.[0] ?? null;

  return (
    <Panel
      title="Modelo de contrato"
      sub="Suba o modelo (PDF ou DOCX). Fica disponível para envio à assinatura (Clicksign) a partir do Onboarding da empresa."
    >
      {err && <div className="dash-state dash-state--error" style={{ marginTop: 10 }}>{err}</div>}
      <div className="ge-fields">
        <label className="ge-field">
          <span className="ge-field__label">Nome do modelo</span>
          <input
            className="gd-select cd-input"
            value={name}
            placeholder="Ex.: Contrato de Prestação de Serviço CRIVO"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="ge-field">
          <span className="ge-field__label">Arquivo (PDF/DOCX)</span>
          <input
            ref={inputRef}
            type="file"
            style={{ marginTop: 6, fontSize: 12 }}
            accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div className="cd-foot">
        <span className="cell-mute" style={{ fontSize: 12 }}>
          {items === null ? "Carregando…" : atual ? <>Modelo atual: <strong>{atual.name}</strong> · {atual.fileName}</> : "Nenhum modelo carregado ainda."}
        </span>
        <button type="button" className="btn btn--gold btn--sm" disabled={busy || !file} onClick={upload}>
          {busy ? "Enviando…" : "Subir modelo"}
        </button>
      </div>
      {items && items.length > 0 && (
        <ul className="cd-templates">
          {items.map((t) => (
            <li key={t.id}>
              <span><strong>{t.name}</strong> <span className="cell-mute">· {t.fileName} · {new Date(t.createdAt).toLocaleDateString("pt-BR")}</span></span>
              <button type="button" className="row-action row-action--danger" onClick={() => remove(t.id)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
