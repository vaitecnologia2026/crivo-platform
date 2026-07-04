"use client";

import { useEffect, useState } from "react";
import {
  MODULES,
  PLANS,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUSES,
  type Plan,
  type ProductDetail,
  type ProductStatus,
  type ProductSummary,
  type UpsertProductRequest,
} from "@crivo/types";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "@/lib/admin-api";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Catálogo de PRODUTOS — núcleo product-driven (tudo nasce daqui). */
export function ProductsSection() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [editing, setEditing] = useState<ProductDetail | "new" | null>(null);

  async function refresh() {
    try {
      setProducts(await listProducts());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function openEdit(id: string) {
    try { setEditing(await getProduct(id)); } catch { alert("Não foi possível abrir a solução."); }
  }
  async function remove(p: ProductSummary) {
    if (!confirm(`Excluir a solução "${p.name}"? Esta ação é definitiva.`)) return;
    try { await deleteProduct(p.id); await refresh(); } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Catálogo de Soluções CRIVO</h1>
          <p className="page-sub">
            Tudo nasce de uma solução: preço, limites, módulos liberados, diagnóstico e IA.
          </p>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setEditing("new")}>
          Nova solução
        </button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando catálogo…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar as soluções.</div>
      )}

      {status === "ok" && products && (
        <div className="prod-grid">
          {products.map((p) => (
            <article key={p.id} className={`prod-card${p.isLeadCapture ? " prod-card--capture" : ""}`}>
              <div className="prod-card__head">
                <strong>{p.name}</strong>
                <span className={`prod-status prod-status--${p.status}`}>
                  {PRODUCT_STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="prod-card__desc">{p.description ?? "—"}</p>
              <div className="prod-price">
                {p.isLeadCapture ? (
                  <span>Captura de leads · sem cobrança</span>
                ) : (
                  <>
                    {brl(p.monthlyPriceCents)}<span>/mês</span>
                    {p.setupPriceCents > 0 && <span> · implantação {brl(p.setupPriceCents)}</span>}
                  </>
                )}
              </div>
              <div className="prod-meta">
                {p.isLeadCapture && <span className="prod-pill prod-pill--lp">Pré-Diagnóstico LP</span>}
                {p.appearsOnLp && <span className="prod-pill prod-pill--lp">Na LP</span>}
                {p.sellableStandalone && <span className="prod-pill">Vende isolada</span>}
                {p.canBeAddon && <span className="prod-pill">Adicional</span>}
                {(p.allowsAi || p.allowsCustomAi) && (
                  <span className="prod-pill">IA{p.allowsCustomAi ? " personalizada" : ""}</span>
                )}
                {p.plan && <span className="prod-pill">Plano {p.plan}</span>}
                <span className="prod-pill">{p.modules.length} módulos</span>
                {p.coreModules.length > 0 && <span className="prod-pill">{p.coreModules.length} CORE</span>}
                <span className="prod-pill">
                  {p.maxUsers === 0 ? "Usuários ∞" : `${p.maxUsers} usuários`}
                </span>
              </div>
              <div className="prod-card__foot">
                <button onClick={() => openEdit(p.id)}>Editar</button>
                <button className="is-danger" onClick={() => remove(p)}>Excluir</button>
              </div>
            </article>
          ))}
          {products.length === 0 && (
            <p className="dash-state">Nenhuma solução. Crie a primeira em “Nova solução”.</p>
          )}
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </>
  );
}

function ProductForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProductDetail | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpsertProductRequest>(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "DRAFT",
    plan: initial?.plan ?? null,
    monthlyPriceCents: initial?.monthlyPriceCents ?? 0,
    setupPriceCents: initial?.setupPriceCents ?? 0,
    maxUsers: initial?.maxUsers ?? 0,
    maxLeaders: initial?.maxLeaders ?? 0,
    companyType: initial?.companyType ?? "",
    modules: initial?.modules ?? [],
    coreModules: initial?.coreModules ?? [],
    isLeadCapture: initial?.isLeadCapture ?? false,
    appearsOnLp: initial?.appearsOnLp ?? false,
    sellableStandalone: initial?.sellableStandalone ?? true,
    canBeAddon: initial?.canBeAddon ?? false,
    allowsAi: initial?.allowsAi ?? false,
    allowsCustomAi: initial?.allowsCustomAi ?? false,
    allowedAddons: initial?.allowedAddons ?? [],
    // Config técnica (diagnóstico/método/saída/IA) NÃO é editada aqui — vive na
    // Metodologia (global) e no Contrato. Omitida do payload → o backend preserva.
  }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof UpsertProductRequest>(k: K, v: UpsertProductRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function toggleModule(code: string) {
    const cur = form.modules ?? [];
    set("modules", cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  function toggleArr(key: "coreModules" | "allowedAddons", code: string) {
    const cur = (form[key] as string[] | undefined) ?? [];
    set(key, cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: UpsertProductRequest = { ...form, name: form.name.trim() };
      if (initial) await updateProduct(initial.id, payload);
      else await createProduct(payload);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar a solução");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{initial ? `Editar — ${initial.name}` : "Nova solução"}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <form onSubmit={onSubmit} className="modal__body prod-form">
          <fieldset className="prod-fs">
            <legend>Dados gerais</legend>
            <div className="prod-form__grid">
              <Field label="Nome da solução" full>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Descrição" full>
                <textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
                  {PRODUCT_STATUSES.map((s) => (
                    <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Plano-base (opcional)">
                <select
                  value={form.plan ?? ""}
                  onChange={(e) => set("plan", (e.target.value || null) as Plan | null)}
                >
                  <option value="">— nenhum —</option>
                  {PLANS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </Field>
              <Field label="Valor mensal (R$)">
                <input
                  type="number" min={0} step="0.01"
                  value={(form.monthlyPriceCents ?? 0) / 100}
                  onChange={(e) => set("monthlyPriceCents", Math.round(Number(e.target.value) * 100))}
                />
              </Field>
              <Field label="Valor de implantação (R$)">
                <input
                  type="number" min={0} step="0.01"
                  value={(form.setupPriceCents ?? 0) / 100}
                  onChange={(e) => set("setupPriceCents", Math.round(Number(e.target.value) * 100))}
                />
              </Field>
              <Field label="Máx. usuários (0 = ∞)">
                <input type="number" min={0} value={form.maxUsers ?? 0}
                  onChange={(e) => set("maxUsers", Number(e.target.value))} />
              </Field>
              <Field label="Máx. líderes (0 = ∞)">
                <input type="number" min={0} value={form.maxLeaders ?? 0}
                  onChange={(e) => set("maxLeaders", Number(e.target.value))} />
              </Field>
              <Field label="Tipo de empresa atendida" full>
                <input value={form.companyType ?? ""} onChange={(e) => set("companyType", e.target.value)} />
              </Field>
              <Field label="" full>
                <label className="prod-check">
                  <input
                    type="checkbox"
                    checked={form.isLeadCapture ?? false}
                    onChange={(e) => set("isLeadCapture", e.target.checked)}
                  />
                  Produto de captura (pré-diagnóstico) — sem portal, app ou IA
                </label>
              </Field>
            </div>
          </fieldset>

          <fieldset className="prod-fs">
            <legend>Enquadramento comercial</legend>
            <div className="prod-modules">
              <label className="prod-check">
                <input type="checkbox" checked={form.appearsOnLp ?? false} onChange={(e) => set("appearsOnLp", e.target.checked)} />
                Aparece na LP / vitrine
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.sellableStandalone ?? true} onChange={(e) => set("sellableStandalone", e.target.checked)} />
                Pode ser vendida isolada
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.canBeAddon ?? false} onChange={(e) => set("canBeAddon", e.target.checked)} />
                Pode ser um adicional
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.allowsAi ?? false} onChange={(e) => set("allowsAi", e.target.checked)} />
                Permite IA padrão
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.allowsCustomAi ?? false} onChange={(e) => set("allowsCustomAi", e.target.checked)} />
                Permite IA personalizada
              </label>
            </div>
          </fieldset>

          <fieldset className="prod-fs">
            <legend>Componentes incluídos por padrão (CORE)</legend>
            <div className="prod-modules">
              {MODULES.map((m) => (
                <label key={m.code} className="prod-check">
                  <input
                    type="checkbox"
                    checked={(form.coreModules ?? []).includes(m.code)}
                    onChange={() => toggleArr("coreModules", m.code)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="prod-fs">
            <legend>Adicionais permitidos</legend>
            <div className="prod-modules">
              {MODULES.map((m) => (
                <label key={m.code} className="prod-check">
                  <input
                    type="checkbox"
                    checked={(form.allowedAddons ?? []).includes(m.code)}
                    onChange={() => toggleArr("allowedAddons", m.code)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="prod-fs">
            <legend>Módulos liberados</legend>
            <div className="prod-modules">
              {MODULES.map((m) => (
                <label key={m.code} className="prod-check">
                  <input
                    type="checkbox"
                    checked={(form.modules ?? []).includes(m.code)}
                    onChange={() => toggleModule(m.code)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Caderno Tela 03 [5]: diagnóstico, perguntas, método, dossiê e IA "saem desta
              tela". A solução é 100% comercial. O instrumento (dimensões/perguntas/escala/
              faixas) vive na METODOLOGIA (global e versionada); o método e a saída técnica
              por cliente ficam no CONTRATO. */}
          <p className="prod-note" style={{ margin: "4px 0 0", padding: "10px 14px", border: "1px dashed var(--line, #E3DDD3)", borderRadius: 10 }}>
            <strong>Configuração técnica não fica aqui.</strong> O diagnóstico (dimensões, perguntas,
            escala e faixas) é definido em <strong>Metodologia</strong>; o método e a saída técnica de
            cada cliente ficam no <strong>Contrato</strong>. Esta tela é só a oferta comercial.
          </p>

          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !form.name.trim()}>
              {saving ? "Salvando…" : initial ? "Salvar alterações" : "Criar solução"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`prod-field${full ? " prod-field--full" : ""}`}>
      {label && <span>{label}</span>}
      {children}
    </label>
  );
}
