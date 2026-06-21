"use client";

import { useEffect, useState } from "react";
import { Button } from "@crivo/ui";
import type { TenantBrandingData, TenantDomainData, TenantSummary } from "@crivo/types";
import {
  addTenantDomain,
  getTenantBranding,
  listTenantDomains,
  removeTenantDomain,
  setPrimaryTenantDomain,
  verifyTenantDomain,
  updateTenantBranding,
} from "@/lib/admin-api";
import { IconCheck } from "../plataforma/Icons";

type Load = "loading" | "error" | "ok";

const EMPTY: TenantBrandingData = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  accentColor: null,
  emailFrom: null,
  whatsapp: null,
  footerText: null,
};

/** Painel de white-label (F5): identidade visual + domínios próprios da empresa. */
export function BrandingModal({ tenant, onClose }: { tenant: TenantSummary; onClose: () => void }) {
  const [branding, setBranding] = useState<TenantBrandingData>(EMPTY);
  const [domains, setDomains] = useState<TenantDomainData[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [saving, setSaving] = useState(false);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [b, d] = await Promise.all([
          getTenantBranding(tenant.id),
          listTenantDomains(tenant.id),
        ]);
        if (alive) {
          setBranding(b);
          setDomains(d);
          setLoad("ok");
        }
      } catch {
        if (alive) setLoad("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenant.id]);

  const set = (k: keyof TenantBrandingData) => (v: string) =>
    setBranding((b) => ({ ...b, [k]: v === "" ? null : v }));

  async function saveBranding() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Envia só o que tem valor; campos vazios viram null (limpa) via string vazia tratada acima.
      setBranding(await updateTenantBranding(tenant.id, branding));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar a identidade");
    } finally {
      setSaving(false);
    }
  }

  async function addDomain() {
    const d = newDomain.trim();
    if (!d) return;
    setBusyDomain("__add__");
    setError(null);
    try {
      setDomains(await addTenantDomain(tenant.id, d));
      setNewDomain("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao adicionar o domínio");
    } finally {
      setBusyDomain(null);
    }
  }

  async function domainAction(id: string, action: "primary" | "remove" | "verify") {
    setBusyDomain(id);
    setError(null);
    try {
      const fn =
        action === "primary"
          ? setPrimaryTenantDomain
          : action === "verify"
            ? verifyTenantDomain
            : removeTenantDomain;
      setDomains(await fn(tenant.id, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      setBusyDomain(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>Marca · {tenant.name}</h2>
            <p className="mt-0.5 text-[12px] text-text-sec">Identidade visual e domínios próprios (white-label).</p>
          </div>
          <button onClick={onClose} className="btn btn--outline-dark btn--sm">
            Fechar
          </button>
        </div>

        <div className="modal__body">
          {load === "loading" && <p className="adm-empty">Carregando marca…</p>}
          {load === "error" && <p className="adm-empty">Não foi possível carregar.</p>}

          {error && (
            <div className="dash-state dash-state--error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {load === "ok" && (
            <>
              {/* Identidade visual */}
              <p className="mb-3 text-[12px] uppercase tracking-[0.1em] text-text-sec">Identidade visual</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ColorField label="Cor primária" value={branding.primaryColor} onChange={set("primaryColor")} />
                <ColorField label="Cor de acento" value={branding.accentColor} onChange={set("accentColor")} />
                <Field label="Logo (URL)" value={branding.logoUrl} onChange={set("logoUrl")} placeholder="https://…" />
                <Field label="Favicon (URL)" value={branding.faviconUrl} onChange={set("faviconUrl")} placeholder="https://…" />
                <Field label="E-mail remetente" value={branding.emailFrom} onChange={set("emailFrom")} placeholder="contato@empresa.com" />
                <Field label="WhatsApp" value={branding.whatsapp} onChange={set("whatsapp")} placeholder="(11) 90000-0000" />
                <div className="sm:col-span-2">
                  <Field label="Rodapé" value={branding.footerText} onChange={set("footerText")} placeholder="Empresa · powered by CRIVO" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button variant="terra" size="sm" onClick={saveBranding} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar identidade"}
                </Button>
                {saved && <span className="text-[12px] text-[#2e7850]">Salvo <IconCheck size={13} /></span>}
              </div>

              {/* Domínios */}
              <p className="mb-3 mt-8 text-[12px] uppercase tracking-[0.1em] text-text-sec">Domínios próprios</p>
              <ul className="divide-y divide-line rounded-[6px] border border-line">
                {domains.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-azul-profundo">
                        {d.domain}
                        {d.primary && (
                          <span className="pattern-tag" style={{ marginLeft: 8 }}>canônico</span>
                        )}
                        <span
                          className={`pattern-tag${d.verified ? "" : " pattern-tag--alert"}`}
                          style={{ marginLeft: 8 }}
                        >
                          {d.verified ? "verificado" : "pendente"}
                        </span>
                      </span>
                      <span className="flex gap-3 text-[12px]">
                        <button
                          disabled={busyDomain === d.id}
                          onClick={() => domainAction(d.id, "verify")}
                          className="text-azul-cobalto underline-offset-4 hover:underline disabled:opacity-40"
                          title="Verificar DNS (TXT em _crivo.<domínio>)"
                        >
                          {busyDomain === d.id ? "Verificando…" : "Verificar DNS"}
                        </button>
                        {!d.primary && (
                          <button
                            disabled={busyDomain === d.id}
                            onClick={() => domainAction(d.id, "primary")}
                            className="text-azul-cobalto underline-offset-4 hover:underline disabled:opacity-40"
                          >
                            Tornar canônico
                          </button>
                        )}
                        <button
                          disabled={busyDomain === d.id}
                          onClick={() => domainAction(d.id, "remove")}
                          className="text-terra-escura underline-offset-4 hover:underline disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </span>
                    </div>
                    {d.verificationToken && (
                      <div className="rounded-[3px] border border-line bg-[#fafaf7] p-2 text-[11px] text-text-sec">
                        <span className="block">
                          Publique este TXT em <code className="font-mono text-azul-profundo">_crivo.{d.domain}</code>:
                        </span>
                        <code className="mt-1 inline-block break-all rounded-[2px] bg-white px-1.5 py-0.5 font-mono text-text">
                          {d.verificationToken}
                        </code>
                        {d.lastVerifyError && (
                          <p className="mt-1 text-[#9c4c46]">↳ {d.lastVerifyError}</p>
                        )}
                        {d.verifiedAt && (
                          <p className="mt-1 text-[#2e7850]">
                            <IconCheck size={13} /> Verificado em {new Date(d.verifiedAt).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {domains.length === 0 && (
                  <li className="px-3 py-4 text-center text-[12px] text-text-sec">Nenhum domínio ainda.</li>
                )}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="app.empresa.com.br"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                  className="flex-1 rounded-[3px] border border-line bg-white px-3 py-2 text-[14px] text-text outline-none focus:border-terra"
                />
                <Button variant="outlineDark" size="sm" onClick={addDomain} disabled={busyDomain === "__add__" || !newDomain.trim()}>
                  Adicionar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">{label}</span>
      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none transition-colors focus:border-terra"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? "#0d1f3c"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-[3px] border border-line bg-white"
          aria-label={label}
        />
        <input
          value={value ?? ""}
          placeholder="#0d1f3c"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 font-mono text-[13px] text-text outline-none transition-colors focus:border-terra"
        />
      </div>
    </label>
  );
}
