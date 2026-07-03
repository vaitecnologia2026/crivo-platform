"use client";

import { useEffect, useState } from "react";
import {
  DIAGNOSTIC_METHOD_LABEL,
  DIAGNOSTIC_METHODS,
  MODULES,
  PLANS,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUSES,
  TECHNICAL_OUTPUT_LABEL,
  TECHNICAL_OUTPUTS,
  type DiagnosticMethod,
  type Plan,
  type ProductAiConfig,
  type ProductDiagnostic,
  type ProductDetail,
  type ProductStatus,
  type ProductSummary,
  type TechnicalOutput,
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

function slugifyKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "dim";
}

/** Instrumento padrão (escala 1–5 de maturidade) para um produto novo. */
function defaultDiagnostic(): ProductDiagnostic {
  return {
    dimensions: [],
    scales: [{
      key: "maturidade",
      label: "Maturidade (1–5)",
      options: [
        { value: 1, label: "Muito baixo / inexistente" },
        { value: 2, label: "Baixo" },
        { value: 3, label: "Parcial" },
        { value: 4, label: "Bom" },
        { value: 5, label: "Muito bom / estruturado" },
      ],
    }],
    blocks: [],
    questions: [],
  };
}

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
    diagnostic: initial?.diagnostic ?? defaultDiagnostic(),
    aiConfig: initial?.aiConfig ?? {},
    isLeadCapture: initial?.isLeadCapture ?? false,
    appearsOnLp: initial?.appearsOnLp ?? false,
    sellableStandalone: initial?.sellableStandalone ?? true,
    canBeAddon: initial?.canBeAddon ?? false,
    allowsAi: initial?.allowsAi ?? false,
    allowsCustomAi: initial?.allowsCustomAi ?? false,
    allowedAddons: initial?.allowedAddons ?? [],
    method: initial?.method ?? null,
    supportedOutputs: initial?.supportedOutputs ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof UpsertProductRequest>(k: K, v: UpsertProductRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const ai = (form.aiConfig ?? {}) as ProductAiConfig;
  const setAi = (k: keyof ProductAiConfig, v: string) =>
    set("aiConfig", { ...ai, [k]: v });
  const diag = (form.diagnostic ?? defaultDiagnostic()) as ProductDiagnostic;
  const setDiag = (d: ProductDiagnostic) => set("diagnostic", d);

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

          {/* Configuração TÉCNICA — separada do comercial (Caderno Tela 03: diagnóstico,
              saída técnica, método e prompt de IA "saem desta tela"). Fica recolhida;
              a edição definitiva migra para Metodologia. */}
          <details className="prod-fs" style={{ padding: 0, border: "1px dashed var(--line, #E3DDD3)", borderRadius: 10 }}>
            <summary style={{ cursor: "pointer", padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>
              ⚙ Configuração técnica (avançado) — método, saída técnica, diagnóstico e IA
            </summary>
            <div style={{ padding: "0 14px 14px" }}>
              <p className="prod-note" style={{ marginTop: 4 }}>
                Estes itens são técnicos (não comerciais) e serão gerenciados em <strong>Metodologia</strong>.
                Mantidos aqui só para não perder configurações existentes.
              </p>
              <div className="prod-form__grid">
                <Field label="Tipo de diagnóstico (Método)">
                  <select
                    value={form.method ?? ""}
                    onChange={(e) => set("method", (e.target.value || null) as DiagnosticMethod | null)}
                  >
                    <option value="">— não definido —</option>
                    {DIAGNOSTIC_METHODS.map((m) => (
                      <option key={m} value={m}>{DIAGNOSTIC_METHOD_LABEL[m]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Saída técnica (documento gerado)" full>
                  <div className="prod-outputs">
                    {TECHNICAL_OUTPUTS.map((o) => (
                      <label key={o} className="prod-check">
                        <input
                          type="checkbox"
                          checked={(form.supportedOutputs ?? []).includes(o)}
                          onChange={(e) =>
                            set(
                              "supportedOutputs",
                              e.target.checked
                                ? [...(form.supportedOutputs ?? []), o]
                                : (form.supportedOutputs ?? []).filter((x) => x !== o),
                            )
                          }
                        />
                        {TECHNICAL_OUTPUT_LABEL[o]}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>

              <fieldset className="prod-fs">
                <legend>Diagnóstico — perguntas editáveis</legend>
                <DiagnosticEditor value={diag} onChange={setDiag} />
              </fieldset>

              <fieldset className="prod-fs">
                <legend>IA dos líderes</legend>
                <div className="prod-form__grid">
                  <Field label="Objetivo da IA" full>
                    <input value={ai.objective ?? ""} onChange={(e) => setAi("objective", e.target.value)} />
                  </Field>
                  <Field label="Prompt da IA" full>
                    <textarea rows={3} value={ai.prompt ?? ""} onChange={(e) => setAi("prompt", e.target.value)} />
                  </Field>
                  <Field label="Base de conhecimento" full>
                    <textarea rows={2} value={ai.knowledgeBase ?? ""} onChange={(e) => setAi("knowledgeBase", e.target.value)} />
                  </Field>
                  <Field label="Regras da IA" full>
                    <textarea rows={2} value={ai.rules ?? ""} onChange={(e) => setAi("rules", e.target.value)} />
                  </Field>
                  <Field label="Limitações" full>
                    <textarea rows={2} value={ai.limitations ?? ""} onChange={(e) => setAi("limitations", e.target.value)} />
                  </Field>
                </div>
              </fieldset>
            </div>
          </details>

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

/** Editor do instrumento de diagnóstico: dimensões, escala e perguntas (não-fixas). */
function DiagnosticEditor({
  value,
  onChange,
}: {
  value: ProductDiagnostic;
  onChange: (d: ProductDiagnostic) => void;
}) {
  const dimensions = value.dimensions ?? [];
  const scale = value.scales?.[0];
  const questions = value.questions ?? [];
  const scaleKey = scale?.key ?? "maturidade";

  // ── Dimensões ──
  function addDimension() {
    const key = `dim_${dimensions.length + 1}`;
    onChange({ ...value, dimensions: [...dimensions, { key, label: "" }] });
  }
  function updateDimension(i: number, label: string) {
    const next = dimensions.map((d, j) => (j === i ? { ...d, label } : d));
    onChange({ ...value, dimensions: next });
  }
  function removeDimension(i: number) {
    onChange({ ...value, dimensions: dimensions.filter((_, j) => j !== i) });
  }

  // ── Escala ──
  function updateOption(i: number, label: string) {
    if (!scale) return;
    const opts = scale.options.map((o, j) => (j === i ? { ...o, label } : o));
    onChange({ ...value, scales: [{ ...scale, options: opts }] });
  }

  // ── Perguntas ──
  function addQuestion() {
    const id = questions.reduce((m, q) => Math.max(m, q.id), 0) + 1;
    const dim = dimensions[0]?.key ?? "";
    onChange({
      ...value,
      questions: [...questions, { id, text: "", dimension: dim, block: dim, scale: scaleKey, weight: 1, inverse: false }],
    });
  }
  function updateQuestion(i: number, patch: Partial<NonNullable<ProductDiagnostic["questions"]>[number]>) {
    const next = questions.map((q, j) => (j === i ? { ...q, ...patch } : q));
    onChange({ ...value, questions: next });
  }
  function removeQuestion(i: number) {
    onChange({ ...value, questions: questions.filter((_, j) => j !== i) });
  }

  return (
    <div className="diag-editor">
      {/* Dimensões */}
      <div className="diag-editor__block">
        <div className="diag-editor__head">
          <strong>Dimensões / categorias</strong>
          <button type="button" className="diag-editor__add" onClick={addDimension}>+ dimensão</button>
        </div>
        {dimensions.length === 0 && <p className="prod-note">Nenhuma dimensão. Adicione ao menos uma.</p>}
        {dimensions.map((d, i) => (
          <div key={d.key} className="diag-editor__row">
            <input
              value={d.label}
              placeholder="Nome da dimensão"
              onChange={(e) => updateDimension(i, e.target.value)}
            />
            <button type="button" className="diag-editor__del" onClick={() => removeDimension(i)} title="Remover">✕</button>
          </div>
        ))}
      </div>

      {/* Escala */}
      {scale && (
        <div className="diag-editor__block">
          <div className="diag-editor__head"><strong>Escala de resposta — {scale.label}</strong></div>
          {scale.options.map((o, i) => (
            <div key={o.value} className="diag-editor__row">
              <span className="diag-editor__optval">{o.value}</span>
              <input value={o.label} onChange={(e) => updateOption(i, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {/* Perguntas */}
      <div className="diag-editor__block">
        <div className="diag-editor__head">
          <strong>Perguntas ({questions.length})</strong>
          <button type="button" className="diag-editor__add" onClick={addQuestion}>+ pergunta</button>
        </div>
        {questions.length === 0 && <p className="prod-note">Nenhuma pergunta cadastrada.</p>}
        {questions.map((q, i) => (
          <div key={q.id} className="diag-editor__q">
            <div className="diag-editor__q-top">
              <span className="diag-editor__qn">{i + 1}</span>
              <textarea
                rows={2}
                value={q.text}
                placeholder="Texto da pergunta"
                onChange={(e) => updateQuestion(i, { text: e.target.value })}
              />
              <button type="button" className="diag-editor__del" onClick={() => removeQuestion(i)} title="Remover">✕</button>
            </div>
            <div className="diag-editor__q-meta">
              <label>
                Dimensão
                <select
                  value={q.dimension ?? ""}
                  onChange={(e) => updateQuestion(i, { dimension: e.target.value, block: e.target.value })}
                >
                  <option value="">—</option>
                  {dimensions.map((d) => (<option key={d.key} value={d.key}>{d.label || d.key}</option>))}
                </select>
              </label>
              <label>
                Peso
                <input
                  type="number" min={0} step="0.5"
                  value={q.weight ?? 1}
                  onChange={(e) => updateQuestion(i, { weight: Number(e.target.value) })}
                />
              </label>
              <label className="diag-editor__inv">
                <input
                  type="checkbox"
                  checked={q.inverse ?? false}
                  onChange={(e) => updateQuestion(i, { inverse: e.target.checked })}
                />
                Invertida
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
