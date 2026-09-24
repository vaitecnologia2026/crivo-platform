"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getMyOrganization,
  updateMyOrganization,
  getMyBranding,
  updateMyBranding,
  getUserSeats,
  getMyModules,
  getDiagnosticContext,
  getOrganizationOverview,
} from "@/lib/api";
import {
  MODULES,
  type OrganizationData,
  type OrganizationOverview,
  type TenantBrandingData,
  type UserSeats,
} from "@crivo/types";
import { ChartCard } from "./Charts";
import { IconBuilding, IconCheck, IconMapPin, IconUsers } from "./Icons";

/**
 * Minha Organização — desenho do protótipo (lovable/Portal do Cliente,
 * src/routes/organizacao.tsx): 4 KPIs, perfil da empresa, distribuição
 * populacional e panorama por unidade. Lá são constantes de demonstração; aqui
 * é o cadastro da empresa e o de colaboradores (`/me/organization/overview`).
 * O que o portal não guarda (data de admissão → tempo de casa) aparece como
 * "—" dizendo o que falta, no padrão da Visão Geral.
 *
 * A edição (dados cadastrais e identidade visual) continua aqui, atrás de
 * "Editar cadastro"; abre sozinha quando falta razão social ou CNPJ, que
 * bloqueiam a emissão oficial do Dossiê. Gateado por branding:edit (nav).
 *
 * O card "Plano · Evolução" saiu (homologação 17/09: "retirar camada comercial
 * 'Plano Evolução'"): a empresa contratou uma SOLUÇÃO, e é isso que a tela mostra.
 */
export function OrganizacaoScreen() {
  const [org, setOrg] = useState<OrganizationData | null>(null);
  const [branding, setBranding] = useState<TenantBrandingData | null>(null);
  const [seats, setSeats] = useState<UserSeats | null>(null);
  const [painel, setPainel] = useState<OrganizationOverview | null>(null);
  // Códigos dos módulos liberados (tenant_modules) — a tela lista os NOMES.
  const [modules, setModules] = useState<string[] | null>(null);
  // Soluções contratadas (nome do produto por método). null = sem contrato ativo.
  const [solucoes, setSolucoes] = useState<string[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    Promise.all([
      getMyOrganization(),
      getMyBranding(),
      getUserSeats().catch(() => null),
      getMyModules().catch(() => []),
      getDiagnosticContext().catch(() => null),
      getOrganizationOverview().catch(() => null),
    ])
      .then(([o, b, s, m, d, p]) => {
        setOrg(o);
        setBranding(b);
        setSeats(s);
        setModules(Array.isArray(m) ? m : null);
        setPainel(p);
        const nomes = (d?.contracted?.length ? d.contracted.map((c) => c.productName) : d?.productName ? [d.productName] : [])
          .filter((n): n is string => !!n);
        setSolucoes(nomes.length ? Array.from(new Set(nomes)) : null);
        setEditando(!o.legalName || !o.taxId);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="dash-state">Carregando organização…</p>;
  if (status === "error" || !org || !branding)
    return <div className="dash-state dash-state--error">Não foi possível carregar a organização.</div>;

  const recursos = (modules ?? [])
    .map((code) => MODULES.find((m) => m.code === code)?.name ?? code)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const semCadastro = !painel || painel.collaborators === 0;
  const unidadesCards = painel
    ? [
        ...painel.units,
        ...(painel.units.length > 0 && painel.withoutUnit > 0
          ? [{ name: "Unidade não informada", people: painel.withoutUnit, areas: null, manager: null, managers: 0 }]
          : []),
      ]
    : [];

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Minha Organização</h1>
          <p className="page-sub">Perfil corporativo, estrutura e dados demográficos.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
            {editando ? "Fechar edição" : "Editar cadastro"}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi
          label="Colaboradores"
          value={painel ? painel.collaborators.toLocaleString("pt-BR") : "—"}
          sub={
            semCadastro
              ? "Nenhum colaborador cadastrado"
              : org.employeesCount
                ? `cadastrados · ${org.employeesCount} declarados`
                : "cadastrados"
          }
        />
        <Kpi
          label="Unidades"
          value={painel && painel.units.length > 0 ? painel.units.length : "—"}
          sub={painel && painel.units.length > 0 ? undefined : "Não informadas no cadastro"}
        />
        <Kpi
          label="Áreas mapeadas"
          value={painel && painel.areas > 0 ? painel.areas : "—"}
          sub={painel && painel.areas > 0 ? undefined : "Não informadas no cadastro"}
        />
        <Kpi label="Tempo médio de casa" value="—" sub="O cadastro não tem data de admissão" />
      </div>

      <div className="grid grid--org">
        <div className="card">
          <div className="org-card__title">
            <IconBuilding size={16} style={{ color: "var(--gold)" }} />
            <h3>{org.name || "Empresa"}</h3>
          </div>
          <p className="org-card__text">
            {solucoes ? `Programa CRIVO ativo com ${listaPtBr(solucoes)}.` : "Sem solução CRIVO contratada no momento."}
            {recursos.length > 0 && ` Recursos liberados: ${recursos.join(" · ")}.`}
          </p>
          <div className="org-info">
            <Info label="CNPJ" value={org.taxId} />
            <Info label="Razão social" value={org.legalName} />
            <Info label="Estabelecimento avaliado" value={org.establishment} />
            <Info label="Modelo de trabalho" value={org.workModel} />
            <Info label="Usuários" value={seats ? `${seats.active} ativos / ${seats.max == null ? "sem limite" : seats.max}` : null} />
            <Info label="Ciclo CRIVO ativo" value={painel?.activeCycle ?? "Nenhuma campanha aberta"} />
          </div>
        </div>

        <div className="card">
          <div className="org-card__title">
            <IconUsers size={16} style={{ color: "var(--gold)" }} />
            <h3>Distribuição populacional</h3>
          </div>
          {semCadastro || !painel ? (
            <p className="dash-state" style={{ margin: 0 }}>
              Cadastre os colaboradores com a área para ver a distribuição.
            </p>
          ) : (
            <ul className="org-dist">
              {painel.distribution.map((d) => (
                <li key={d.area} title={`${d.people} pessoa(s)`}>
                  <span>{d.area}</span>
                  <strong>{d.percent}%</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ChartCard title="Unidades" description="Panorama por unidade organizacional." source="Cadastro de colaboradores">
        {unidadesCards.length === 0 ? (
          <p className="dash-state" style={{ margin: 0 }}>
            Nenhuma unidade informada no cadastro de colaboradores. Preencha a coluna “Unidade” na importação para ver o panorama.
          </p>
        ) : (
          <div className="org-units">
            {unidadesCards.map((u) => (
              <div key={u.name} className="org-unit">
                <div className="org-unit__name">
                  <IconMapPin size={15} style={{ color: "var(--gold)" }} />
                  <span>{u.name}</span>
                </div>
                <div className="org-unit__sub">
                  {u.manager
                    ? `Gestor local: ${u.manager}`
                    : u.managers > 1
                      ? `${u.managers} gestores`
                      : "Gestor local não informado"}
                </div>
                <div className="org-unit__pills">
                  <span className="pill pill--sm pill--outline">{u.people} {u.people === 1 ? "pessoa" : "pessoas"}</span>
                  {u.areas !== null && (
                    <span className="pill pill--sm pill--outline">{u.areas} {u.areas === 1 ? "área" : "áreas"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {editando && (
        <>
          {(!org.legalName || !org.taxId) && (
            <p className="prod-note" style={{ margin: "24px 0 12px" }}>
              Falta razão social ou CNPJ: sem eles a emissão oficial do Dossiê Técnico fica bloqueada.
            </p>
          )}
          <div className="grid grid--2" style={{ marginTop: 24 }}>
            <DadosCard org={org} onSaved={setOrg} />
            <BrandingCard branding={branding} onSaved={setBranding} />
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value" style={{ fontSize: 30 }}>{value}</strong>
      {sub && <span className="kpi__delta kpi__delta--neutral">{sub}</span>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="org-info__label">{label}</div>
      <div className="org-info__value">{value || "—"}</div>
    </div>
  );
}

/** "A", "A e B", "A, B e C". */
function listaPtBr(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

// ───────────────────────── Dados cadastrais ─────────────────────────
function DadosCard({ org, onSaved }: { org: OrganizationData; onSaved: (o: OrganizationData) => void }) {
  const [f, setF] = useState({
    name: org.name,
    legalName: org.legalName ?? "",
    taxId: org.taxId ?? "",
    website: org.website ?? "",
    phone: org.phone ?? "",
    establishment: org.establishment ?? "",
    employeesCount: org.employeesCount ?? "",
    workModel: org.workModel ?? "",
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
        establishment: f.establishment.trim() || null,
        employeesCount: f.employeesCount.trim() || null,
        workModel: f.workModel.trim() || null,
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
        <Field label="Unidade/Estabelecimento avaliado" value={f.establishment} onChange={set("establishment")} full />
        <Field label="Nº de empregados" value={f.employeesCount} onChange={set("employeesCount")} />
        <label className="prod-field">
          <span>Modelo de trabalho</span>
          <select value={f.workModel} onChange={(e) => set("workModel")(e.target.value)}>
            <option value="">— selecione —</option>
            <option value="Presencial">Presencial</option>
            <option value="Híbrido">Híbrido</option>
            <option value="Remoto">Remoto</option>
            <option value="Misto">Misto</option>
          </select>
        </label>
      </div>
      <p className="prod-note" style={{ margin: "8px 0 0" }}>
        Estes dados entram no cabeçalho do Dossiê Técnico. Sem razão social e CNPJ, a emissão
        oficial do dossiê fica bloqueada (a pré-visualização continua livre).
      </p>
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
