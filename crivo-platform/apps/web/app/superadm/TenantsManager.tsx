"use client";

import { useState } from "react";
import { Button } from "@crivo/ui";
import {
  PLANS,
  PLAN_LABELS,
  type Plan,
  type PlatformAdmin,
  type ProvisionResult,
  type TenantStatus,
  type TenantSummary,
} from "@crivo/types";
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
  const [provisioned, setProvisioned] = useState<ProvisionResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modulesOf, setModulesOf] = useState<TenantSummary | null>(null);
  const [brandingOf, setBrandingOf] = useState<TenantSummary | null>(null);
  const [contractOf, setContractOf] = useState<TenantSummary | null>(null);
  const [usersOf, setUsersOf] = useState<TenantSummary | null>(null);
  const [onboardingOf, setOnboardingOf] = useState<TenantSummary | null>(null);

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
            <h1 className="page-title">Empresas-cliente</h1>
            <p className="page-sub">
              {status === "ok"
                ? `${tenants.length} empresa(s) na plataforma CRIVO`
                : "Carregando empresas-cliente…"}
            </p>
          </div>
          <Button variant="terra" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Fechar" : "Nova empresa"}
          </Button>
        </div>

        {status === "ok" && tenants.length > 0 && (
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Empresas</span>
              <strong className="kpi__value">{tenants.length}</strong>
              <span className="kpi__delta">total na base</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Ativas</span>
              <strong className="kpi__value">
                {tenants.filter((t) => t.status === "ACTIVE").length}
              </strong>
              <span className="kpi__delta">acesso liberado</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Bloqueadas</span>
              <strong className="kpi__value">
                {tenants.filter((t) => t.status === "SUSPENDED").length}
              </strong>
              <span className="kpi__delta">acesso suspenso</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Excluídas</span>
              <strong className="kpi__value">
                {tenants.filter((t) => t.status === "DELETED").length}
              </strong>
              <span className="kpi__delta">exclusão lógica</span>
            </div>
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

        {provisioned && (
          <ProvisionedNotice result={provisioned} onClose={() => setProvisioned(null)} />
        )}

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
          <div className="card">
            <table className="data-table data-table--tenants">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Slug</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Criada</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setOnboardingOf(t)}
                        title="Ver dados / onboarding"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          font: "inherit",
                          fontWeight: 700,
                          color: "inherit",
                          cursor: "pointer",
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                        }}
                      >
                        {t.name}
                      </button>
                    </td>
                    <td className="cell-mute">{t.slug}</td>
                    <td className="cell-mute">{PLAN_LABELS[t.plan]}</td>
                    <td>
                      <span
                        className={`pattern-tag${t.status === "ACTIVE" ? "" : " pattern-tag--alert"}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="cell-mute">
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <div className="row-actions">
                        {t.status !== "DELETED" && (
                          <ActionLink onClick={() => setContractOf(t)}>Contrato</ActionLink>
                        )}
                        {t.status !== "DELETED" && (
                          <ActionLink onClick={() => setModulesOf(t)}>Módulos</ActionLink>
                        )}
                        {t.status !== "DELETED" && (
                          <ActionLink onClick={() => setBrandingOf(t)}>Marca</ActionLink>
                        )}
                        {t.status !== "DELETED" && (
                          <ActionLink onClick={() => setUsersOf(t)}>Usuários</ActionLink>
                        )}
                        {t.status === "ACTIVE" ? (
                          <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "suspend")}>
                            Bloquear
                          </ActionLink>
                        ) : t.status === "SUSPENDED" ? (
                          <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "activate")}>
                            Reativar
                          </ActionLink>
                        ) : null}
                        {t.status !== "DELETED" && (
                          <ActionLink danger disabled={busyId === t.id} onClick={() => act(t.id, "delete")}>
                            Excluir
                          </ActionLink>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-sec)" }}>
                      Nenhuma empresa ainda. Crie a primeira em “Nova empresa”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modulesOf && (
        <ModulesModal
          tenant={modulesOf}
          onClose={() => setModulesOf(null)}
          onTenantUpdated={(t) => {
            applyTenant(t);
            setModulesOf(t);
          }}
        />
      )}

      {brandingOf && <BrandingModal tenant={brandingOf} onClose={() => setBrandingOf(null)} />}

      {contractOf && <ContractModal tenant={contractOf} onClose={() => setContractOf(null)} />}

      {usersOf && <TenantUsersModal tenant={usersOf} onClose={() => setUsersOf(null)} />}
      {onboardingOf && <OnboardingModal tenant={onboardingOf} onClose={() => setOnboardingOf(null)} />}
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
