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
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const moduleName = (code: string) => MODULES.find((m) => m.code === code)?.name ?? code;

/** Rótulo de preço do card: livre (priceLabel) ou derivado dos valores. */
function priceText(p: ProductSummary): string {
  if (p.priceLabel) return p.priceLabel;
  if (p.isLeadCapture) return "Gratuito (entrada de funil)";
  if (p.monthlyPriceCents > 0) return `${brl(p.monthlyPriceCents)} / mês`;
  if (p.setupPriceCents > 0) return brl(p.setupPriceCents);
  return "—";
}

/** Catálogo de Soluções CRIVO — cards no padrão do mockup do cliente (14/07). */
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
          <h1 className="page-title">Soluções CRIVO</h1>
          <p className="page-sub">
            Catálogo comercial global da CRIVO. A habilitação para cada cliente é realizada exclusivamente em
            Contratos e Liberações.
          </p>
        </div>
        <button className="btn btn--sm sol-newbtn" onClick={() => setEditing("new")}>
          Nova solução
        </button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando catálogo…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar as soluções.</div>
      )}

      {status === "ok" && products && (
        <div className="sol-list">
          {products.map((p) => {
            // Subtítulo: campo livre da vitrine; sem ele, cai no plano-base.
            const subtitle =
              p.category ?? (p.plan ? `Plano: ${p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}` : "");
            const compat = p.compatiblePackages.length > 0 ? p.compatiblePackages : p.allowedAddons.map(moduleName);
            const modChips = p.suggestedModules.length > 0 ? p.suggestedModules : p.modules.map(moduleName);
            return (
              <article key={p.id} className="sol-card">
                <div className="sol-card__head">
                  <div>
                    <h2 className="sol-card__name">{p.name}</h2>
                    {subtitle && <span className="sol-card__sub">{subtitle}</span>}
                  </div>
                  <div className="sol-card__actions">
                    <span className={`sol-status sol-status--${p.status}`}>{PRODUCT_STATUS_LABEL[p.status]}</span>
                    <button type="button" onClick={() => openEdit(p.id)}>Editar</button>
                    <button type="button" className="is-danger" onClick={() => remove(p)}>Excluir</button>
                  </div>
                </div>

                {p.coreDelivery && (
                  <div className="sol-core">
                    <span className="sol-label">Core da entrega</span>
                    <p>{p.coreDelivery}</p>
                  </div>
                )}
                {p.description && <p className="sol-desc">{p.description}</p>}

                {p.modalities.length > 0 && (
                  <div className="sol-block">
                    <span className="sol-label">Modalidades</span>
                    <div className="sol-chips">
                      {p.modalities.map((m) => <span key={m} className="sol-chip">{m}</span>)}
                    </div>
                  </div>
                )}

                <div className="sol-facts">
                  <div><span className="sol-label">Preço</span><b>{priceText(p)}</b></div>
                  <div><span className="sol-label">Implantação</span><b>{p.implementation ?? "—"}</b></div>
                  <div><span className="sol-label">Venda isolada</span><b>{p.sellableStandalone ? "Sim" : "Não"}</b></div>
                  <div><span className="sol-label">Aparece na LP</span><b>{p.appearsOnLp ? "Sim" : "Não"}</b></div>
                  <div><span className="sol-label">Permite IA</span><b>{p.allowsAi || p.allowsCustomAi ? "Sim" : "Não"}</b></div>
                  <div><span className="sol-label">Limite usuários</span><b>{p.maxUsers === 0 ? "Ilimitado" : p.maxUsers}</b></div>
                </div>

                <div className="sol-two">
                  <div className="sol-block">
                    <span className="sol-label">Módulos técnicos sugeridos</span>
                    {modChips.length > 0 ? (
                      <div className="sol-chips">
                        {modChips.map((c) => <span key={c} className="sol-chip">{c}</span>)}
                      </div>
                    ) : (
                      <span className="sol-empty">—</span>
                    )}
                  </div>
                  <div className="sol-block">
                    <span className="sol-label">Adicionais sugeridos</span>
                    {p.suggestedAddons.length > 0 ? (
                      <div className="sol-chips">
                        {p.suggestedAddons.map((a) => <span key={a} className="sol-chip sol-chip--terra">{a}</span>)}
                      </div>
                    ) : (
                      <span className="sol-empty">—</span>
                    )}
                  </div>
                </div>

                <div className="sol-block">
                  <span className="sol-label">Adicionais / pacotes compatíveis</span>
                  {compat.length > 0 ? (
                    <div className="sol-chips">
                      {compat.map((a) => <span key={a} className="sol-chip">{a}</span>)}
                    </div>
                  ) : (
                    <span className="sol-empty">—</span>
                  )}
                </div>
              </article>
            );
          })}
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

/** Converte "a, b, c" em ["a","b","c"] (chips por vírgula). */
const splitChips = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

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
    category: initial?.category ?? "",
    coreDelivery: initial?.coreDelivery ?? "",
    implementation: initial?.implementation ?? "",
    priceLabel: initial?.priceLabel ?? "",
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
  // Chips livres editados como texto separado por vírgula.
  const [modalidadesText, setModalidadesText] = useState((initial?.modalities ?? []).join(", "));
  const [modSugeridosText, setModSugeridosText] = useState((initial?.suggestedModules ?? []).join(", "));
  const [sugeridosText, setSugeridosText] = useState((initial?.suggestedAddons ?? []).join(", "));
  const [pacotesText, setPacotesText] = useState((initial?.compatiblePackages ?? []).join(", "));
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
      const payload: UpsertProductRequest = {
        ...form,
        name: form.name.trim(),
        modalities: splitChips(modalidadesText),
        suggestedModules: splitChips(modSugeridosText),
        suggestedAddons: splitChips(sugeridosText),
        compatiblePackages: splitChips(pacotesText),
      };
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
              <Field label="Categoria / subtítulo (ex.: Diagnóstico organizacional)">
                <input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
                  {PRODUCT_STATUSES.map((s) => (
                    <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Core da entrega (resumo destacado no card)" full>
                <textarea
                  rows={2}
                  value={form.coreDelivery ?? ""}
                  onChange={(e) => set("coreDelivery", e.target.value)}
                />
              </Field>
              <Field label="Descrição" full>
                <textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
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
              <Field label="Implantação (ex.: Imediata · Padrão · 30 dias)">
                <input value={form.implementation ?? ""} onChange={(e) => set("implementation", e.target.value)} />
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
              <Field label="Rótulo de preço no card (opcional — ex.: R$ 5.900)" full>
                <input
                  value={form.priceLabel ?? ""}
                  placeholder="Se vazio, o card deriva dos valores acima"
                  onChange={(e) => set("priceLabel", e.target.value)}
                />
              </Field>
              <Field label="Máx. usuários (0 = ilimitado)">
                <input type="number" min={0} value={form.maxUsers ?? 0}
                  onChange={(e) => set("maxUsers", Number(e.target.value))} />
              </Field>
              <Field label="Máx. líderes (0 = ilimitado)">
                <input type="number" min={0} value={form.maxLeaders ?? 0}
                  onChange={(e) => set("maxLeaders", Number(e.target.value))} />
              </Field>
              <Field label="Modalidades (separe por vírgula)" full>
                <input
                  value={modalidadesText}
                  placeholder="Diagnóstico Organizacional, Diagnóstico Inicial, Diagnóstico NR-1"
                  onChange={(e) => setModalidadesText(e.target.value)}
                />
              </Field>
              <Field label="Módulos técnicos sugeridos (chips do card — separe por vírgula)" full>
                <input
                  value={modSugeridosText}
                  placeholder="Diagnóstico, Plano de Evolução, Evidências, Dossiês"
                  onChange={(e) => setModSugeridosText(e.target.value)}
                />
              </Field>
              <Field label="Adicionais sugeridos (separe por vírgula)" full>
                <input
                  value={sugeridosText}
                  placeholder="IA personalizada, Pocket CRIVO, ICD adicional"
                  onChange={(e) => setSugeridosText(e.target.value)}
                />
              </Field>
              <Field label="Adicionais / pacotes compatíveis (separe por vírgula)" full>
                <input
                  value={pacotesText}
                  placeholder="CRIVO Plus · pacote, Dossiê adicional"
                  onChange={(e) => setPacotesText(e.target.value)}
                />
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
            <legend>Módulos técnicos sugeridos (liberados)</legend>
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
            escala e faixas) é definido no <strong>Motor de Diagnósticos</strong>; o método e a saída técnica de
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
