"use client";

import { useEffect, useState } from "react";
import {
  getMyOrganization,
  updateMyOrganization,
  getMyBranding,
  updateMyBranding,
  getUserSeats,
  getMyModules,
} from "@/lib/api";
import type { OrganizationData, TenantBrandingData, UserSeats } from "@crivo/types";
import { IconCheck } from "./Icons";

/**
 * Organização (autoatendimento do admin da empresa): dados cadastrais, identidade
 * visual (white-label) e visão do plano/uso. Gateado por branding:edit (nav).
 */
const PLAN_LABEL: Record<string, string> = {
  BASE: "Base",
  PRO: "Professional",
  ENTERPRISE: "Enterprise",
};

export function OrganizacaoScreen() {
  const [org, setOrg] = useState<OrganizationData | null>(null);
  const [branding, setBranding] = useState<TenantBrandingData | null>(null);
  const [seats, setSeats] = useState<UserSeats | null>(null);
  const [modules, setModules] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    Promise.all([getMyOrganization(), getMyBranding(), getUserSeats().catch(() => null), getMyModules().catch(() => [])])
      .then(([o, b, s, m]) => {
        setOrg(o);
        setBranding(b);
        setSeats(s);
        setModules(Array.isArray(m) ? m.length : null);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="dash-state">Carregando organização…</p>;
  if (status === "error" || !org || !branding)
    return <div className="dash-state dash-state--error">Não foi possível carregar a organização.</div>;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Organização</h1>
          <p className="page-sub">Dados da empresa, identidade visual e seu plano — autoatendimento.</p>
        </div>
      </div>

      {/* Plano & uso */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <span className="kpi__label">Plano</span>
          <strong className="kpi__value" style={{ fontSize: 26, color: "var(--gold-deep)" }}>
            {PLAN_LABEL[org.plan] ?? org.plan}
          </strong>
        </div>
        <div className="kpi">
          <span className="kpi__label">Usuários</span>
          <strong className="kpi__value" style={{ fontSize: 26 }}>
            {seats ? `${seats.active} / ${seats.max == null ? "∞" : seats.max}` : "—"}
          </strong>
          <span className="kpi__delta">ativos / limite</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Módulos ativos</span>
          <strong className="kpi__value" style={{ fontSize: 26 }}>{modules ?? "—"}</strong>
        </div>
      </div>

      <div className="grid grid--2">
        <DadosCard org={org} onSaved={setOrg} />
        <BrandingCard branding={branding} onSaved={setBranding} />
      </div>
    </>
  );
}

// ───────────────────────── Dados cadastrais ─────────────────────────
function DadosCard({ org, onSaved }: { org: OrganizationData; onSaved: (o: OrganizationData) => void }) {
  const [f, setF] = useState({
    name: org.name,
    legalName: org.legalName ?? "",
    taxId: org.taxId ?? "",
    website: org.website ?? "",
    phone: org.phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setDone(false);
  };

  async function save() {
    setErr(null);
    if (!f.name.trim()) return setErr("O nome da empresa é obrigatório.");
    setSaving(true);
    try {
      const o = await updateMyOrganization({
        name: f.name.trim(),
        legalName: f.legalName.trim() || null,
        taxId: f.taxId.trim() || null,
        website: f.website.trim() || null,
        phone: f.phone.trim() || null,
      });
      onSaved(o);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card__head"><div><h3>Dados da empresa</h3><span className="card__sub">Razão social, CNPJ e contato</span></div></div>
      <div className="prod-form__grid">
        <Field label="Nome (exibição)" value={f.name} onChange={set("name")} full />
        <Field label="Razão social" value={f.legalName} onChange={set("legalName")} full />
        <Field label="CNPJ" value={f.taxId} onChange={set("taxId")} />
        <Field label="Telefone" value={f.phone} onChange={set("phone")} />
        <Field label="Site" value={f.website} onChange={set("website")} full />
      </div>
      {err && <p className="dash-state--error" style={{ marginTop: 8 }}>{err}</p>}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn--gold btn--sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar dados"}
        </button>
        {done && <span className="card__sub" style={{ color: "var(--green,#2f9e64)" }}><IconCheck size={13} /> Salvo</span>}
      </div>
    </div>
  );
}

// ───────────────────────── Identidade visual ─────────────────────────
function BrandingCard({
  branding,
  onSaved,
}: {
  branding: TenantBrandingData;
  onSaved: (b: TenantBrandingData) => void;
}) {
  const [f, setF] = useState({
    logoUrl: branding.logoUrl ?? "",
    faviconUrl: branding.faviconUrl ?? "",
    primaryColor: branding.primaryColor ?? "#1f3b73",
    accentColor: branding.accentColor ?? "#c4894a",
    emailFrom: branding.emailFrom ?? "",
    whatsapp: branding.whatsapp ?? "",
    footerText: branding.footerText ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setDone(false);
  };

  async function save() {
    setErr(null);
    setSaving(true);
    // Só envia campos preenchidos (logo/favicon são validados como URL no servidor).
    const payload: Partial<TenantBrandingData> = {
      primaryColor: f.primaryColor,
      accentColor: f.accentColor,
    };
    if (f.logoUrl.trim()) payload.logoUrl = f.logoUrl.trim();
    if (f.faviconUrl.trim()) payload.faviconUrl = f.faviconUrl.trim();
    if (f.emailFrom.trim()) payload.emailFrom = f.emailFrom.trim();
    if (f.whatsapp.trim()) payload.whatsapp = f.whatsapp.trim();
    if (f.footerText.trim()) payload.footerText = f.footerText.trim();
    try {
      const b = await updateMyBranding(payload);
      onSaved(b);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar. Confira se logo/favicon são URLs válidas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card__head"><div><h3>Identidade visual</h3><span className="card__sub">Logo, cores e rodapé (white-label)</span></div></div>
      <div className="prod-form__grid">
        <Field label="URL do logo" value={f.logoUrl} onChange={set("logoUrl")} full />
        <Field label="URL do favicon" value={f.faviconUrl} onChange={set("faviconUrl")} full />
        <ColorField label="Cor primária" value={f.primaryColor} onChange={set("primaryColor")} />
        <ColorField label="Cor de destaque" value={f.accentColor} onChange={set("accentColor")} />
        <Field label="E-mail remetente" value={f.emailFrom} onChange={set("emailFrom")} />
        <Field label="WhatsApp" value={f.whatsapp} onChange={set("whatsapp")} />
        <Field label="Texto do rodapé" value={f.footerText} onChange={set("footerText")} full />
      </div>
      {err && <p className="dash-state--error" style={{ marginTop: 8 }}>{err}</p>}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn--gold btn--sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar identidade"}
        </button>
        {done && <span className="card__sub" style={{ color: "var(--green,#2f9e64)" }}><IconCheck size={13} /> Salvo — recarregue para ver o tema</span>}
      </div>
    </div>
  );
}

// ───────────────────────── inputs ─────────────────────────
function Field({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`prod-field ${full ? "prod-field--full" : ""}`}>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="prod-field">
      <span>{label}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--line)", borderRadius: 8 }} />
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
      </div>
    </label>
  );
}
