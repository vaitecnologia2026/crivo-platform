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

const STATUS_STYLE: Record<TenantStatus, string> = {
  ACTIVE: "bg-[rgba(46,120,80,0.14)] text-[#2e7850] border-[rgba(46,120,80,0.3)]",
  SUSPENDED: "bg-[rgba(196,137,74,0.14)] text-terra border-[rgba(196,137,74,0.35)]",
  DELETED: "bg-[rgba(120,120,120,0.12)] text-text-sec border-line",
};
const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Bloqueada",
  DELETED: "Excluída",
};

export function TenantsManager({
  admin,
  onLogout,
}: {
  admin: PlatformAdmin;
  onLogout: () => void;
}) {
  const { tenants, status, refresh, provision, setStatusOf } = useTenants();
  const [showForm, setShowForm] = useState(false);
  const [provisioned, setProvisioned] = useState<ProvisionResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modulesOf, setModulesOf] = useState<TenantSummary | null>(null);

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
    <main className="min-h-screen bg-off-white font-body text-text">
      {/* Topo */}
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

      <div className="mx-auto max-w-[1040px] px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-azul-profundo">Empresas-cliente</h1>
            <p className="mt-1 text-[13px] text-text-sec">
              {status === "ok" ? `${tenants.length} empresa(s)` : "Carregando…"}
            </p>
          </div>
          <Button variant="terra" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Fechar" : "Nova empresa"}
          </Button>
        </div>

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

        {status === "error" && (
          <div className="rounded-[4px] border border-line bg-white p-8 text-center">
            <p className="text-[14px] text-text-sec">Não foi possível carregar as empresas.</p>
            <button onClick={refresh} className="mt-3 text-[13px] text-terra underline-offset-4 hover:underline">
              Tentar novamente
            </button>
          </div>
        )}

        {status === "ok" && (
          <div className="overflow-hidden rounded-[6px] border border-line bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line bg-paper-dim text-[11px] uppercase tracking-[0.08em] text-text-sec">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Criada</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-azul-profundo">{t.name}</td>
                    <td className="px-4 py-3 text-text-sec">{t.slug}</td>
                    <td className="px-4 py-3 text-text-sec">{PLAN_LABELS[t.plan]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_STYLE[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-sec">
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-[12px]">
                        {t.status !== "DELETED" && (
                          <ActionLink onClick={() => setModulesOf(t)}>Módulos</ActionLink>
                        )}
                        {t.status === "ACTIVE" ? (
                          <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "suspend")}>
                            Bloquear
                          </ActionLink>
                        ) : (
                          <ActionLink disabled={busyId === t.id} onClick={() => act(t.id, "activate")}>
                            Reativar
                          </ActionLink>
                        )}
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
                    <td colSpan={6} className="px-4 py-10 text-center text-text-sec">
                      Nenhuma empresa ainda. Crie a primeira em “Nova empresa”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modulesOf && <ModulesModal tenant={modulesOf} onClose={() => setModulesOf(null)} />}
    </main>
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
      className={`underline-offset-4 hover:underline disabled:opacity-40 ${danger ? "text-terra-escura" : "text-azul-cobalto"}`}
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
