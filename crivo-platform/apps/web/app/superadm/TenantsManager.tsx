"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@crivo/ui";
import {
  PLANS,
  PLAN_LABELS,
  type BusinessGroupSummary,
  type Plan,
  type PlatformAdmin,
  type ProvisionResult,
  type TenantBrandingData,
  type TenantDomainData,
  type TenantStatus,
  type TenantSummary,
} from "@crivo/types";
import {
  createGroup,
  deleteGroup,
  getTenantBranding,
  listAllContracts,
  listGroups,
  listTenantDomains,
  setTenantGroup,
  setTenantProfile,
  type ContractListItem,
} from "@/lib/admin-api";

/** CNPJ (14 dígitos) → 00.000.000/0000-00; devolve cru se não tiver 14 dígitos. */
function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
import { CnpjLookupCard } from "./CnpjLookupCard";
import { GroupOverviewModal } from "./GroupOverviewModal";
import { useTenants } from "./useTenants";
import { ModulesModal } from "./ModulesModal";
import { OnboardingModal } from "./OnboardingModal";
import { BrandingModal } from "./BrandingModal";
import { ContractModal } from "./ContractModal";
import { TenantUsersModal } from "./TenantUsersModal";

const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Bloqueada",
  DELETED: "Excluída",
};

const CONTRACT_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  ENCERRADO: "Encerrado",
};

const CONSENTS = [
  ["consentBenchmark", "Participar do benchmark agregado da Base CRIVO"],
  ["consentAnonymized", "Uso de dados anonimizados em estudos CRIVO"],
  ["consentCase", "Virar case autorizado (com revisão prévia)"],
  ["consentLogo", "Uso de logo em vitrine institucional CRIVO"],
  ["consentTestimonial", "Depoimento público de C-level ou consultor"],
] as const;

const dataBr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

/** Cadastro completo = CNPJ + responsável interno (coluna "Dados"). */
const dadosOk = (t: TenantSummary) => !!(t.cnpj && t.internalResponsible);

/** Último trecho de uma URL (nome do arquivo do logo/favicon). */
const arquivo = (url: string | null) => (url ? decodeURIComponent(url.split(/[/?#]/).filter(Boolean).pop() ?? url) : "—");

/** Selo de status (StatusChip do protótipo). */
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

function Swatch({ hex }: { hex: string | null }) {
  if (!hex) return <>padrão CRIVO</>;
  return (
    <span className="ge-swatch">
      <span style={{ background: hex }} />
      {hex}
    </span>
  );
}

async function exportarXlsx(rows: Record<string, string | number>[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Empresas");
  XLSX.writeFile(wb, `grupos-empresas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Grupos e Empresas-cliente (Caderno Tela 06 · protótipo Lovable /grupos) —
 *  cadastro administrativo. A habilitação real (módulos, soluções, adicionais)
 *  vive no Contrato; as ações desta tela são atalhos. */
export function TenantsManager({
  admin,
  onLogout,
  embedded = false,
}: {
  admin: PlatformAdmin;
  onLogout: () => void;
  embedded?: boolean;
}) {
  const { tenants, status, refresh, provision, setStatusOf, applyTenant } = useTenants();
  const [showForm, setShowForm] = useState(false);
  const [showCnpj, setShowCnpj] = useState(false);
  const [provisioned, setProvisioned] = useState<ProvisionResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [groups, setGroups] = useState<BusinessGroupSummary[] | null>(null);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [overviewOf, setOverviewOf] = useState<BusinessGroupSummary | null>(null);

  // Filtros (FilterBar do protótipo).
  const [busca, setBusca] = useState("");
  const [statusF, setStatusF] = useState<"" | TenantStatus>("");
  const [grupoF, setGrupoF] = useState(""); // "" = todos · "none" = sem grupo · id

  // Empresa em foco nos painéis de baixo.
  const [selId, setSelId] = useState<string | null>(null);
  const [branding, setBranding] = useState<{ id: string; data: TenantBrandingData | null; domains: TenantDomainData[] } | null>(null);

  const [modulesOf, setModulesOf] = useState<TenantSummary | null>(null);
  const [brandingOf, setBrandingOf] = useState<TenantSummary | null>(null);
  const [contractOf, setContractOf] = useState<TenantSummary | null>(null);
  const [usersOf, setUsersOf] = useState<TenantSummary | null>(null);
  const [onboardingOf, setOnboardingOf] = useState<TenantSummary | null>(null);
  const [profileOf, setProfileOf] = useState<TenantSummary | null>(null);
  const [groupContractOf, setGroupContractOf] = useState<{ id: string; name: string } | null>(null);

  // F1 · Grupos Empresariais (Caderno Tela 06): catálogo leve acima dos tenants.
  async function refreshGroups() {
    try {
      setGroups(await listGroups());
    } catch {
      setGroups([]);
    }
  }
  async function refreshContracts() {
    try {
      setContracts(await listAllContracts());
    } catch {
      setContracts([]);
    }
  }
  useEffect(() => {
    void refreshGroups();
    void refreshContracts();
  }, []);

  const selected = tenants.find((t) => t.id === selId) ?? tenants.find((t) => t.status !== "DELETED") ?? null;

  // Marca e domínio da empresa em foco (carregados sob demanda; recarrega ao
  // fechar o modal de marca).
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedId || brandingOf) return;
    let alive = true;
    Promise.all([getTenantBranding(selectedId).catch(() => null), listTenantDomains(selectedId).catch(() => [])]).then(
      ([data, domains]) => {
        if (alive) setBranding({ id: selectedId, data, domains });
      },
    );
    return () => {
      alive = false;
    };
  }, [selectedId, brandingOf]);

  /** Contratos da empresa: os próprios e o do grupo (vale para todos os CNPJs). */
  const contratosDe = (t: TenantSummary) => {
    const proprios = contracts.filter((c) => c.tenantId === t.id);
    const doGrupo = t.groupId ? contracts.filter((c) => c.byGroup && c.groupId === t.groupId) : [];
    return { proprios, doGrupo };
  };
  /** Contrato de referência da linha: ativo primeiro, depois o mais recente. */
  const contratoPrincipal = (t: TenantSummary) => {
    const { proprios, doGrupo } = contratosDe(t);
    const ordena = (xs: ContractListItem[]) =>
      [...xs].sort((a, b) => Number(b.status === "ATIVO") - Number(a.status === "ATIVO") || b.updatedAt.localeCompare(a.updatedAt));
    const p = ordena(proprios)[0];
    if (p) return { c: p, grupo: false };
    const g = ordena(doGrupo)[0];
    return g ? { c: g, grupo: true } : null;
  };

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = busca.replace(/\D/g, "");
    return tenants.filter((t) => {
      if (statusF && t.status !== statusF) return false;
      if (grupoF === "none" && t.groupId) return false;
      if (grupoF && grupoF !== "none" && t.groupId !== grupoF) return false;
      if (!q) return true;
      return (
        `${t.name} ${t.groupName ?? ""} ${t.slug}`.toLowerCase().includes(q) ||
        (qDig.length >= 3 && (t.cnpj ?? "").includes(qDig))
      );
    });
  }, [tenants, busca, statusF, grupoF]);

  const vivos = tenants.filter((t) => t.status !== "DELETED");
  const semContratoAtivo = vivos.filter((t) => contratoPrincipal(t)?.c.status !== "ATIVO").length;
  const grupoSel = grupoF && grupoF !== "none" ? groups?.find((g) => g.id === grupoF) ?? null : null;

  async function onCreateGroup() {
    const name = window.prompt("Nome do grupo empresarial (ex.: Grupo ABC):")?.trim();
    if (!name) return;
    try {
      await createGroup(name);
      await refreshGroups();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao criar o grupo");
    }
  }

  async function onDeleteGroup(g: BusinessGroupSummary) {
    if (g.tenants.length > 0) {
      alert(`"${g.name}" tem ${g.tenants.length} empresa(s) vinculada(s). Desvincule antes de excluir.`);
      return;
    }
    if (!confirm(`Excluir o grupo "${g.name}"?`)) return;
    try {
      await deleteGroup(g.id);
      setGrupoF("");
      await refreshGroups();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir o grupo");
    }
  }

  async function onSetGroup(t: TenantSummary, groupId: string | null) {
    setBusyId(t.id);
    try {
      const updated = await setTenantGroup(t.id, groupId);
      applyTenant(updated);
      await refreshGroups();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao vincular o grupo");
    } finally {
      setBusyId(null);
    }
  }

  async function act(id: string, action: "suspend" | "activate" | "delete") {
    if (action === "delete" && !confirm("Excluir esta empresa? (exclusão lógica, reversível)")) return;
    setBusyId(id);
    try {
      await setStatusOf(id, action);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      setBusyId(null);
    }
  }

  function exportar() {
    void exportarXlsx(
      filtered.map((t) => {
        const cp = contratoPrincipal(t);
        return {
          Empresa: t.name,
          CNPJ: t.cnpj ? formatCnpj(t.cnpj) : "",
          Slug: t.slug,
          Grupo: t.groupName ?? "",
          Plano: PLAN_LABELS[t.plan],
          Status: STATUS_LABEL[t.status],
          "Criada em": new Date(t.createdAt).toLocaleDateString("pt-BR"),
          Contrato: cp ? `${cp.c.shortId}${cp.grupo ? " (grupo)" : ""} · ${CONTRACT_STATUS[cp.c.status] ?? cp.c.status}` : "",
          Módulos: t.stats?.modulesEnabled ?? "",
          Usuários: t.stats?.usersCount ?? "",
          Dados: dadosOk(t) ? "OK" : "Pendente",
        };
      }),
    );
  }

  const marcaCarregada = !!selected && branding?.id === selected.id;
  const marca = marcaCarregada ? branding!.data : null;
  const dominio = marcaCarregada
    ? branding!.domains.find((d) => d.primary) ?? branding!.domains.find((d) => d.verified) ?? branding!.domains[0] ?? null
    : null;

  return (
    <div className={embedded ? "font-body text-text" : "min-h-screen bg-off-white font-body text-text"}>
      {!embedded && (
        <header className="flex items-center justify-between border-b border-line bg-azul-profundo px-6 py-4 text-off-white">
          <div>
            <span className="font-display text-lg tracking-[0.04em]">CRIVO™</span>
            <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-terra-dourado">
              Painel da Plataforma
            </span>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="text-text-on-dark-sec">{admin.name}</span>
            <button onClick={onLogout} className="text-off-white underline-offset-4 hover:underline">
              Sair
            </button>
          </div>
        </header>
      )}

      <div className={embedded ? "" : "mx-auto max-w-[1040px] px-6 py-8"}>
        <div className="route__head">
          <div>
            <h1 className="page-title">Grupos e Empresas-cliente</h1>
            <p className="page-sub">
              Cadastro administrativo. Empresa é identidade cadastral — nenhum módulo, IA, solução ou adicional é
              habilitado nesta tela.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--outline-dark btn--sm" onClick={onCreateGroup}>Novo grupo</button>
            {/* C2 (call 14/07): o caminho preferido cria a empresa pelos dados
                REAIS da Receita — mesmo fluxo de consulta CNPJ do Dashboard. */}
            <button className="btn btn--terra btn--sm" onClick={() => { setShowCnpj((v) => !v); setShowForm(false); }}>
              {showCnpj ? "Fechar" : "Nova empresa"}
            </button>
          </div>
        </div>

        {showCnpj && (
          <div style={{ marginBottom: 20 }}>
            <CnpjLookupCard
              groups={groups ?? []}
              onProvisioned={() => {
                void refresh();
                void refreshGroups();
                void refreshContracts();
              }}
            />
            <button
              type="button"
              className="linklike"
              style={{ fontSize: 12, marginTop: 8 }}
              onClick={() => { setShowForm(true); setShowCnpj(false); }}
            >
              Empresa sem CNPJ? Cadastrar manualmente
            </button>
          </div>
        )}

        {showForm && (
          <NewTenantForm
            onCreated={(r) => {
              setProvisioned(r);
              setShowForm(false);
            }}
            onError={(m) => alert(m)}
            provision={provision}
          />
        )}

        {provisioned && <ProvisionedNotice result={provisioned} onClose={() => setProvisioned(null)} />}

        {status === "loading" && <p className="dash-state">Carregando empresas-cliente…</p>}

        {status === "error" && (
          <div className="dash-state dash-state--error">
            Não foi possível carregar as empresas.
            <button onClick={refresh} className="dash-state__retry">
              Tentar novamente
            </button>
          </div>
        )}

        {status === "ok" && (
          <>
            <div className="ge-kpis">
              {([
                ["Empresas totais", tenants.length, "todas as empresas da base"],
                ["Ativas", tenants.filter((t) => t.status === "ACTIVE").length, "acesso liberado"],
                ["Rascunho", semContratoAtivo, "sem contrato ativo (próprio ou do grupo)"],
                ["Bloqueadas", tenants.filter((t) => t.status === "SUSPENDED").length, "acesso suspenso"],
                ["Excluídas", tenants.filter((t) => t.status === "DELETED").length, "exclusão lógica"],
                ["Grupos empresariais", groups?.length ?? 0, "grupos cadastrados"],
              ] as const).map(([label, value, title]) => (
                <div key={label} className="gd-kpi gd-kpi--mini" title={title}>
                  <span className="gd-kpi__label">{label}</span>
                  <strong className="gd-kpi__value">{value}</strong>
                </div>
              ))}
            </div>

            {/* FilterBar */}
            <div className="ge-filters">
              <input
                className="gd-select ge-search"
                placeholder="Buscar por empresa, grupo, CNPJ ou slug"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <select className="gd-select" value={statusF} onChange={(e) => setStatusF(e.target.value as "" | TenantStatus)} title="Status">
                <option value="">Status: Todos</option>
                {(Object.keys(STATUS_LABEL) as TenantStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select className="gd-select" value={grupoF} onChange={(e) => setGrupoF(e.target.value)} title="Grupo">
                <option value="">Grupo: Todos</option>
                <option value="none">Sem grupo</option>
                {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" className="gd-chip" onClick={() => { setBusca(""); setStatusF(""); setGrupoF(""); }}>
                Limpar
              </button>
              <button type="button" className="btn btn--sm btn--outline-dark" style={{ marginLeft: "auto" }} disabled={!filtered.length} onClick={exportar}>
                ↓ Exportar XLSX
              </button>
            </div>

            {/* Grupo escolhido no filtro: ações do grupo (consolidado, contrato, exclusão). */}
            {grupoSel && (
              <div className="ge-groupbar">
                <div>
                  <strong>{grupoSel.name}</strong>
                  <span className="cell-mute">
                    {" · "}
                    {grupoSel.tenants.length === 0
                      ? "nenhum CNPJ vinculado — vincule pela coluna Grupo"
                      : `${grupoSel.tenants.length} CNPJ${grupoSel.tenants.length === 1 ? "" : "s"} no grupo`}
                  </span>
                </div>
                <div className="row-actions">
                  <ActionLink onClick={() => setOverviewOf(grupoSel)}>Consolidado</ActionLink>
                  <ActionLink onClick={() => setGroupContractOf({ id: grupoSel.id, name: grupoSel.name })}>Contrato do grupo</ActionLink>
                  <ActionLink danger disabled={grupoSel.tenants.length > 0} onClick={() => onDeleteGroup(grupoSel)}>
                    Excluir grupo
                  </ActionLink>
                </div>
              </div>
            )}

            <div className="card ge-table">
              <table className="data-table data-table--tenants">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Slug</th>
                    <th>Grupo</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Criada em</th>
                    <th>Contrato</th>
                    <th>Módulos</th>
                    <th>Usuários</th>
                    <th>Dados</th>
                    <th style={{ textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const cp = contratoPrincipal(t);
                    const vivo = t.status !== "DELETED";
                    return (
                      <tr key={t.id} className={selected?.id === t.id ? "is-selected" : undefined}>
                        <td>
                          <button type="button" className="ge-name" onClick={() => setSelId(t.id)} title="Ver dados da empresa abaixo">
                            {t.name}
                          </button>
                          {t.cnpj && <div className="cell-mute" style={{ fontSize: 11, marginTop: 2 }}>{formatCnpj(t.cnpj)}</div>}
                        </td>
                        <td className="cell-mute ge-mono">{t.slug}</td>
                        <td>
                          {!vivo || !groups ? (
                            <span className="cell-mute">{t.groupName ?? "—"}</span>
                          ) : (
                            <select
                              className="ge-inline-select"
                              value={t.groupId ?? ""}
                              disabled={busyId === t.id}
                              onChange={(e) => onSetGroup(t, e.target.value || null)}
                              title="Grupo empresarial da empresa"
                            >
                              <option value="">— sem grupo</option>
                              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="cell-mute" style={{ fontSize: 12 }}>{PLAN_LABELS[t.plan]}</td>
                        <td>
                          <Chip tone={t.status === "ACTIVE" ? "ok" : t.status === "SUSPENDED" ? "alert" : "mute"}>{STATUS_LABEL[t.status]}</Chip>
                        </td>
                        <td className="cell-mute" style={{ fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td>
                          {!vivo ? (
                            <span className="cell-mute">—</span>
                          ) : cp ? (
                            <button
                              type="button"
                              className="ge-link"
                              title={`Contrato ${CONTRACT_STATUS[cp.c.status] ?? cp.c.status}${cp.grupo ? " do grupo" : ""}`}
                              onClick={() => (cp.grupo && t.groupId
                                ? setGroupContractOf({ id: t.groupId, name: t.groupName ?? "Grupo" })
                                : setContractOf(t))}
                            >
                              {cp.c.shortId}{cp.grupo ? " (grupo)" : ""} →
                            </button>
                          ) : (
                            <button type="button" className="ge-link ge-link--mute" onClick={() => setContractOf(t)}>Criar contrato →</button>
                          )}
                        </td>
                        <td>
                          {vivo ? (
                            <button type="button" className="ge-link ge-link--mute" onClick={() => setModulesOf(t)}>
                              Ver módulos ({t.stats?.modulesEnabled ?? 0})
                            </button>
                          ) : <span className="cell-mute">—</span>}
                        </td>
                        <td>
                          {vivo ? (
                            <button type="button" className="ge-link ge-link--mute" onClick={() => setUsersOf(t)} title="Usuários ativos do portal">
                              {t.stats?.usersCount ?? 0}
                            </button>
                          ) : <span className="cell-mute">{t.stats?.usersCount ?? 0}</span>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ge-chipbtn"
                            disabled={!vivo}
                            onClick={() => setProfileOf(t)}
                            title={dadosOk(t) ? "CNPJ e responsável interno cadastrados" : "Falta CNPJ ou responsável interno"}
                          >
                            <Chip tone={dadosOk(t) ? "ok" : "alert"}>{dadosOk(t) ? "OK" : "Pendente"}</Chip>
                          </button>
                        </td>
                        <td>
                          <div className="row-actions">
                            {vivo && <ActionLink onClick={() => setBrandingOf(t)}>Marca</ActionLink>}
                            {t.status === "ACTIVE" ? (
                              <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "suspend")}>Bloquear</ActionLink>
                            ) : t.status === "SUSPENDED" ? (
                              <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "activate")}>Desbloquear</ActionLink>
                            ) : null}
                            {vivo && (
                              <ActionLink danger disabled={busyId === t.id} onClick={() => act(t.id, "delete")}>Excluir</ActionLink>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: "center", padding: 40, color: "var(--text-sec)" }}>
                        {tenants.length === 0 ? "Nenhuma empresa ainda. Crie a primeira em “Nova empresa”." : "Nenhuma empresa neste filtro."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selected && (
              <>
                <div className="ge-2col">
                  <div className="gd-panel">
                    <div className="gd-panel__title">{selected.name} · dados autorizados</div>
                    <div className="ge-fields">
                      <Field label="Grupo" value={selected.groupName ?? "Sem grupo"} />
                      <Field label="CNPJ principal" value={selected.cnpj ? formatCnpj(selected.cnpj) : "—"} />
                      <Field
                        label="Unidades"
                        value={selected.stats?.unitsCount
                          ? selected.stats.unitNames.join(" · ") +
                            (selected.stats.unitsCount > selected.stats.unitNames.length
                              ? ` +${selected.stats.unitsCount - selected.stats.unitNames.length}`
                              : "")
                          : "Nenhuma unidade cadastrada"}
                      />
                      <Field label="Usuários administrativos" value={String(selected.stats?.adminUsersCount ?? 0)} />
                      <Field label="Marca visível" value={selected.name} />
                      <Field
                        label="Bloqueio"
                        value={selected.status === "SUSPENDED"
                          ? <Chip tone="alert">Bloqueada</Chip>
                          : selected.status === "DELETED" ? <Chip tone="mute">Excluída</Chip> : <Chip tone="mute">Sem bloqueio</Chip>}
                      />
                    </div>
                    {selected.status !== "DELETED" && (
                      <div className="ge-actions">
                        <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => setOnboardingOf(selected)}>Ver onboarding</button>
                        <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => setUsersOf(selected)}>Usuários</button>
                      </div>
                    )}
                  </div>

                  <div className="gd-panel">
                    <div className="gd-panel__title">Contratos desta empresa</div>
                    <ContratosDaEmpresa
                      linhas={[
                        ...contratosDe(selected).proprios.map((c) => ({ c, grupo: false })),
                        ...contratosDe(selected).doGrupo.map((c) => ({ c, grupo: true })),
                      ]}
                      podeCriar={selected.status !== "DELETED"}
                      onAbrir={(grupo) => (grupo && selected.groupId
                        ? setGroupContractOf({ id: selected.groupId, name: selected.groupName ?? "Grupo" })
                        : setContractOf(selected))}
                    />
                  </div>
                </div>

                <div className="ge-2col">
                  <div className="gd-panel">
                    <div className="gd-panel__title">Marca / White-label — {selected.name}</div>
                    <p className="ge-note">Identidade visual e canais aplicados ao Portal Executivo e comunicações operacionais desta empresa.</p>
                    <div className="ge-fields">
                      <Field label="Cor primária" value={marcaCarregada ? <Swatch hex={marca?.primaryColor ?? null} /> : "…"} />
                      <Field label="Cor de acento" value={marcaCarregada ? <Swatch hex={marca?.accentColor ?? null} /> : "…"} />
                      <Field label="Logo" value={arquivo(marca?.logoUrl ?? null)} />
                      <Field label="Favicon" value={arquivo(marca?.faviconUrl ?? null)} />
                      <Field label="E-mail remetente" value={marca?.emailFrom || "—"} />
                      <Field label="WhatsApp" value={marca?.whatsapp || "—"} />
                      <Field label="Rodapé institucional" value={marca?.footerText || "—"} />
                      <Field label="Domínio próprio" value={dominio ? `${dominio.domain}${dominio.verified ? "" : " (não verificado)"}` : "—"} />
                    </div>
                    {selected.status !== "DELETED" && (
                      <div className="ge-actions">
                        <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => setBrandingOf(selected)}>Editar marca</button>
                      </div>
                    )}
                  </div>

                  <div className="gd-panel">
                    <div className="gd-panel__title">Dados da empresa e autorizações de uso</div>
                    <p className="ge-note">Registros administrativos e consentimentos que habilitam benchmark, cases e vitrine institucional CRIVO.</p>
                    <div className="ge-fields">
                      <Field label="CNPJ principal" value={selected.cnpj ? formatCnpj(selected.cnpj) : "—"} />
                      <Field
                        label="Matriz / Filiais"
                        value={`${selected.headquarterType === "FILIAL" ? "Filial" : selected.headquarterType === "MATRIZ" ? "Matriz" : "—"} · ${selected.stats?.unitsCount ?? 0} unidade(s) cadastrada(s)`}
                      />
                      <Field label="Responsável interno" value={selected.internalResponsible || "—"} />
                      <Field label="LGPD" value={selected.stats?.termsAccepted ? <Chip tone="ok">Termo aceito</Chip> : <Chip tone="mute">Aguardando aceite</Chip>} />
                    </div>
                    <div className="ge-auths">
                      {CONSENTS.map(([key, label]) => (
                        <div key={key} className="ge-auth">
                          <span>{label}</span>
                          <Chip tone={selected[key] ? "ok" : "mute"}>{selected[key] ? "Autorizado" : "Não autorizado"}</Chip>
                        </div>
                      ))}
                    </div>
                    {selected.status !== "DELETED" && (
                      <div className="ge-actions">
                        <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => setProfileOf(selected)}>Editar autorizações</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="gd-rulebox">
              <div className="gd-rulebox__title">Regras desta tela</div>
              Grupos e Empresas-cliente é <b>cadastro administrativo</b>. As ações desta tela são atalhos — habilitação
              real de módulos, IA, soluções, adicionais, limites e recursos vive em <b>Contratos e Liberações</b>.
              Bloqueio de empresa suspende acessos do Portal Executivo e é registrado em <b>Auditoria</b>. Para ver o
              consolidado ou o contrato de um grupo, escolha o grupo no filtro.
            </div>
          </>
        )}
      </div>

      {overviewOf && <GroupOverviewModal group={overviewOf} onClose={() => setOverviewOf(null)} />}

      {modulesOf && (
        <ModulesModal
          tenant={modulesOf}
          onClose={() => { setModulesOf(null); void refresh(); }}
          onTenantUpdated={(t) => {
            applyTenant(t);
            setModulesOf(t);
          }}
        />
      )}

      {brandingOf && <BrandingModal tenant={brandingOf} onClose={() => setBrandingOf(null)} />}

      {contractOf && <ContractModal tenant={contractOf} onClose={() => { setContractOf(null); void refreshContracts(); }} />}

      {groupContractOf && (
        <ContractModal group={groupContractOf} onClose={() => { setGroupContractOf(null); void refreshContracts(); }} />
      )}

      {profileOf && (
        <TenantProfileModal
          tenant={profileOf}
          onClose={() => setProfileOf(null)}
          onSaved={(t) => { applyTenant(t); setProfileOf(null); }}
        />
      )}

      {usersOf && <TenantUsersModal tenant={usersOf} onClose={() => { setUsersOf(null); void refresh(); }} />}
      {onboardingOf && <OnboardingModal tenant={onboardingOf} onClose={() => setOnboardingOf(null)} />}
    </div>
  );
}

/** Tabela "Contratos desta empresa": os próprios e o do grupo. */
function ContratosDaEmpresa({
  linhas,
  podeCriar,
  onAbrir,
}: {
  linhas: { c: ContractListItem; grupo: boolean }[];
  podeCriar: boolean;
  onAbrir: (grupo: boolean) => void;
}) {
  return (
    <div className="ge-subtable">
      <table className="data-table" style={{ margin: 0 }}>
        <thead>
          <tr><th>Contrato</th><th>Vigência</th><th>Status</th><th style={{ textAlign: "right" }}>Ir para</th></tr>
        </thead>
        <tbody>
          {linhas.map(({ c, grupo }) => (
            <tr key={c.id}>
              <td><strong>{c.shortId}</strong>{grupo && <span className="cell-mute"> (grupo)</span>}</td>
              <td className="cell-mute" style={{ fontSize: 12 }}>{dataBr(c.startDate)} → {dataBr(c.endDate)}</td>
              <td>
                <Chip tone={c.status === "ATIVO" ? "ok" : c.status === "RASCUNHO" ? "mute" : "alert"}>{CONTRACT_STATUS[c.status] ?? c.status}</Chip>
              </td>
              <td style={{ textAlign: "right" }}>
                <button type="button" className="ge-link" onClick={() => onAbrir(grupo)}>Ver contrato →</button>
              </td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={4} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>
                Nenhum contrato.{" "}
                {podeCriar && <button type="button" className="linklike" onClick={() => onAbrir(false)}>Criar contrato</button>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActionLink({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`row-action${danger ? " row-action--danger" : ""}`}
    >
      {children}
    </button>
  );
}

function NewTenantForm({
  provision,
  onCreated,
  onError,
}: {
  provision: ReturnType<typeof useTenants>["provision"];
  onCreated: (r: ProvisionResult) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan: "BASE" as Plan,
    adminName: "",
    adminEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await provision({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        plan: form.plan,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
      });
      onCreated(r);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha ao provisionar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 grid grid-cols-1 gap-4 rounded-[6px] border border-line bg-white p-6 sm:grid-cols-2"
    >
      <p className="sm:col-span-2 text-[12px] uppercase tracking-[0.1em] text-text-sec">
        Provisionar nova empresa
      </p>
      <Input label="Nome da empresa" value={form.name} onChange={set("name")} required />
      <Input label="Slug (subdomínio) — opcional" value={form.slug} onChange={set("slug")} placeholder="derivado do nome" />
      <label className="block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">Plano</span>
        <select
          value={form.plan}
          onChange={(e) => set("plan")(e.target.value)}
          className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none focus:border-terra"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden sm:block" />
      <Input label="Nome do admin" value={form.adminName} onChange={set("adminName")} required />
      <Input label="E-mail do admin" type="email" value={form.adminEmail} onChange={set("adminEmail")} required />
      <div className="sm:col-span-2">
        <Button
          type="submit"
          variant="terra"
          size="sm"
          disabled={loading || !form.name || !form.adminName || !form.adminEmail}
        >
          {loading ? "Provisionando…" : "Criar empresa"}
        </Button>
        <span className="ml-3 text-[12px] text-text-sec">
          A senha do admin será gerada e exibida uma única vez.
        </span>
      </div>
    </form>
  );
}

function ProvisionedNotice({ result, onClose }: { result: ProvisionResult; onClose: () => void }) {
  return (
    <div className="mb-6 rounded-[6px] border border-[rgba(46,120,80,0.35)] bg-[rgba(46,120,80,0.08)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-azul-profundo">
            Empresa “{result.tenant.name}” provisionada ✓
          </p>
          <p className="mt-2 text-[13px] text-text-sec">
            Admin: <strong>{result.adminEmail}</strong>
            {result.tempPassword && (
              <>
                {" · "}senha temporária:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-terra-escura">
                  {result.tempPassword}
                </code>
              </>
            )}
          </p>
          {result.tempPassword && (
            <p className="mt-2 text-[12px] text-terra-escura">
              Copie agora — esta senha não será exibida novamente.
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-[12px] text-text-sec hover:underline">
          Dispensar
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none transition-colors focus:border-terra"
      />
    </label>
  );
}

/** Cadastro do CNPJ (Tela 06): CNPJ, matriz/filial e responsável interno da empresa. */
function TenantProfileModal({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: TenantSummary;
  onClose: () => void;
  onSaved: (t: TenantSummary) => void;
}) {
  const [cnpj, setCnpj] = useState(tenant.cnpj ?? "");
  const [hq, setHq] = useState(tenant.headquarterType ?? "");
  const [resp, setResp] = useState(tenant.internalResponsible ?? "");
  const [consent, setConsent] = useState({
    consentAnonymized: tenant.consentAnonymized,
    consentBenchmark: tenant.consentBenchmark,
    consentCase: tenant.consentCase,
    consentLogo: tenant.consentLogo,
    consentTestimonial: tenant.consentTestimonial,
  });
  const [minResp, setMinResp] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const updated = await setTenantProfile(tenant.id, {
        cnpj: cnpj.trim() || null,
        headquarterType: hq || null,
        internalResponsible: resp.trim() || null,
        minRespondents: minResp.trim() ? Number(minResp) : null,
        ...consent,
      });
      onSaved(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
    {/* Clique fora NAO fecha: modal com formulario — fechar por engano apagava o que ja tinha sido digitado. Sai pelo X ou pelo Cancelar. */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Dados da empresa — {tenant.name}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>
        <div className="modal__body" style={{ display: "grid", gap: 14 }}>
          <Input label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0000-00" />
          {/* Microempresa: com o padrão 5, uma empresa de 3 funcionários nunca
              veria resultado. O piso de anonimato continua sendo aplicado. */}
          <Input
            label="Mínimo de respondentes para liberar resultados"
            value={minResp}
            onChange={setMinResp}
            placeholder="vazio = padrão da plataforma (5)"
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">Matriz / Filial</span>
            <select
              value={hq}
              onChange={(e) => setHq(e.target.value)}
              className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none focus:border-terra"
            >
              <option value="">— não informado —</option>
              <option value="MATRIZ">Matriz</option>
              <option value="FILIAL">Filial</option>
            </select>
          </label>
          <Input label="Responsável interno" value={resp} onChange={setResp} placeholder="Quem responde pela conta" />

          <div style={{ borderTop: "1px dashed var(--line, #E3DDD3)", paddingTop: 12 }}>
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">
              Autorizações de uso (Base CRIVO / prova social · §11)
            </span>
            <p className="dash-state" style={{ margin: "0 0 8px", fontSize: 12 }}>
              Opt-in por empresa. Sem autorização, os dados <strong>não</strong> entram no benchmark nem em cases/vitrine.
            </p>
            {([
              ["consentBenchmark", "Participar do benchmark agregado (anônimo)"],
              ["consentAnonymized", "Uso de dados anonimizados em estudos"],
              ["consentCase", "Virar case (autorizado)"],
              ["consentLogo", "Uso do logo em vitrine"],
              ["consentTestimonial", "Depoimento público"],
            ] as const).map(([key, label]) => (
              <label key={key} className="prod-check" style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={consent[key]}
                  onChange={(e) => setConsent((c) => ({ ...c, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>

          {err && <p className="dash-state dash-state--error" style={{ margin: 0 }}>{err}</p>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn--terra btn--sm" disabled={saving} onClick={save}>
            {saving ? "Salvando…" : "Salvar dados"}
          </button>
        </div>
      </div>
    </div>
  );
}
