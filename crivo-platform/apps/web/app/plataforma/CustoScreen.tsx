"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeInvisibleCosts,
  COST_CONFIDENCE_LABEL,
  DEFAULT_COST_SCENARIOS,
  INVISIBLE_COST_NATURE_LABEL,
  INVISIBLE_COST_NATURES,
  INVISIBLE_COST_PRESETS,
  type CostConfidence,
  type InvisibleCostItem,
  type InvisibleCostNature,
  type InvisibleCostScenarios,
  type InvisibleCostSnapshotData,
} from "@crivo/types";
import {
  createCostSnapshot,
  getInvisibleCosts,
  listCostSnapshots,
  saveInvisibleCosts,
} from "../../lib/api";
import { exportPDF, exportXLSX, useExportContext } from "@/lib/exports";
import { IconClose, IconDownload, IconEye, IconFileText, IconShield } from "./Icons";

/**
 * Custo Invisível (Fase 2 — §10/§14). Estimativa gerencial do custo oculto:
 * por item, custo = variação × volume × custo unitário. Mostra uma FAIXA
 * (otimista–conservador) + nível de confiança. Persistido por empresa (RLS).
 * É ESTIMATIVA de apoio à decisão — não afirma economia garantida.
 *
 * Fatia 6: layout do protótipo (Radar de Custos Invisíveis) — abas Composição/
 * Detalhamento/Cenários/Histórico + metadados de governança por item + snapshots
 * ("Congelar como ciclo"). O cálculo (computeInvisibleCosts) não muda.
 */
const BRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const CONFIDENCES: CostConfidence[] = ["ALTA", "MEDIA", "BAIXA"];
type Tab = "composicao" | "detalhamento" | "cenarios" | "historico";
const TABS: [Tab, string][] = [
  ["composicao", "Composição"],
  ["detalhamento", "Detalhamento"],
  ["cenarios", "Cenários"],
  ["historico", "Histórico"],
];

/** Cor por natureza — tema monocromático azul/laranja (sem verde/amarelo). */
function natureBarClass(n: InvisibleCostNature | undefined): string {
  if (n === "OBSERVADO") return "bar__fill--observado";
  if (n === "HIPOTESE") return "bar__fill--hipotese";
  return "bar__fill--estimado"; // ESTIMADO ou sem natureza informada
}

export function CustoScreen() {
  const [items, setItems] = useState<InvisibleCostItem[]>([]);
  const [scenarios, setScenarios] = useState<InvisibleCostScenarios>(DEFAULT_COST_SCENARIOS);
  const [confidence, setConfidence] = useState<CostConfidence>("MEDIA");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [save, setSave] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [tab, setTab] = useState<Tab>("composicao");
  const [detail, setDetail] = useState<{ item: InvisibleCostItem; index: number } | null>(null);
  const exportCtx = useExportContext();

  useEffect(() => {
    getInvisibleCosts()
      .then((d) => {
        setItems(Array.isArray(d.items) ? (d.items as InvisibleCostItem[]) : INVISIBLE_COST_PRESETS);
        setScenarios((d.scenarios as InvisibleCostScenarios) ?? DEFAULT_COST_SCENARIOS);
        setConfidence((d.confidence as CostConfidence) ?? "MEDIA");
        setUpdatedAt(d.updatedAt);
        setIsDefault(d.isDefault);
        setStatus("ok");
      })
      .catch(() => {
        setItems(INVISIBLE_COST_PRESETS);
        setStatus("error");
      });
  }, []);

  const result = useMemo(() => computeInvisibleCosts(items, scenarios), [items, scenarios]);

  const setItem = (i: number, patch: Partial<InvisibleCostItem>) =>
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((arr) => arr.filter((_, j) => j !== i));
  const addItem = () =>
    setItems((arr) => [
      ...arr,
      { key: `item-${Date.now()}`, label: "Novo item", indicator: "", variation: 0, volume: 0, unitCost: 0 },
    ]);
  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  async function onSave() {
    setSave("saving");
    try {
      const d = await saveInvisibleCosts({ items, scenarios, confidence });
      setUpdatedAt(d.updatedAt);
      setIsDefault(false);
      setSave("done");
      setTimeout(() => setSave("idle"), 2500);
    } catch {
      setSave("error");
    }
  }

  function exportRows() {
    return items.map((it, i) => ({
      Item: it.label, Indicador: it.indicator ?? "—",
      Natureza: it.nature ? INVISIBLE_COST_NATURE_LABEL[it.nature] : "—",
      Fonte: it.source ?? "—", "Custo base": Math.round(result.items[i]?.base ?? 0),
      Conservador: Math.round(result.items[i]?.conservador ?? 0),
      Otimista: Math.round(result.items[i]?.otimista ?? 0),
      Confiança: it.confidence ? COST_CONFIDENCE_LABEL[it.confidence] : "—",
      "Última validação": it.validatedAt ?? "—",
    }));
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Radar de Custos Invisíveis</h1>
          <p className="page-sub">
            Estimativa gerencial do custo oculto do risco psicossocial — por item: variação × volume × custo
            unitário. Premium · módulo de sensibilização e priorização.
          </p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill pill--outline pill--sm" title="Isolamento por tenant (RLS) — sem cruzamento entre clientes">
            <IconShield size={12} style={{ marginRight: 4 }} /> Dados segregados por cliente/CNPJ
          </span>
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx}
            onClick={() => exportCtx && exportXLSX("crivo-custos-invisiveis", [{ name: "Composição", rows: exportRows() }], exportCtx)}
          >
            <IconDownload size={14} /> XLSX
          </button>
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx}
            onClick={() => exportCtx && exportPDF("crivo-custos-invisiveis", "Radar de Custos Invisíveis", [{ heading: "Composição", rows: exportRows() }], exportCtx)}
          >
            <IconFileText size={14} /> PDF
          </button>
          {updatedAt && !isDefault && (
            <span className="card__sub" style={{ fontSize: 12 }}>
              Salvo em {new Date(updatedAt).toLocaleDateString("pt-BR")}
            </span>
          )}
          {isDefault && <span className="card__sub" style={{ fontSize: 12 }}>Modelo padrão (não salvo)</span>}
          <button className="btn btn--gold btn--sm" onClick={onSave} disabled={save === "saving"}>
            {save === "saving" ? "Salvando…" : save === "done" ? "Salvo ✓" : "Salvar estimativa"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}

      {/* Resultado — faixa estimada (sempre visível, independente da aba) */}
      <div className="kpi-grid">
        <div className="kpi" style={{ gridColumn: "span 2" }}>
          <span className="kpi__label">Custo invisível anual estimado (cenário moderado)</span>
          <strong className="kpi__value" style={{ color: "var(--gold-deep)" }}>{BRL(result.total.moderado)}</strong>
          <span className="kpi__delta">
            Faixa: {BRL(result.total.otimista)} (otimista) — {BRL(result.total.conservador)} (conservador)
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Otimista (mín.)</span>
          <strong className="kpi__value" style={{ fontSize: 26 }}>{BRL(result.total.otimista)}</strong>
          <span className="kpi__delta">×{scenarios.otimista}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Conservador (máx.)</span>
          <strong className="kpi__value" style={{ fontSize: 26 }}>{BRL(result.total.conservador)}</strong>
          <span className="kpi__delta">×{scenarios.conservador}</span>
        </div>
      </div>

      <div className="scr-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`scr-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "composicao" && (
        <ComposicaoTab items={items} result={result} onOpen={(i) => setDetail({ item: items[i], index: i })} />
      )}

      {tab === "detalhamento" && (
        <DetalhamentoTab
          items={items} result={result} num={num} setItem={setItem} removeItem={removeItem} addItem={addItem}
          onOpen={(i) => setDetail({ item: items[i], index: i })}
          onUsePresets={() => setItems(INVISIBLE_COST_PRESETS)}
        />
      )}

      {tab === "cenarios" && (
        <CenariosTab items={items} result={result} scenarios={scenarios} setScenarios={setScenarios} confidence={confidence} setConfidence={setConfidence} num={num} />
      )}

      {tab === "historico" && <HistoricoTab hasSavedEstimate={!isDefault} />}

      {detail && (
        <ItemDetailModal
          item={detail.item}
          onClose={() => setDetail(null)}
          onSave={(patch) => { setItem(detail.index, patch); setDetail(null); }}
        />
      )}
    </>
  );
}

// ── Aba Composição: barras horizontais coloridas por natureza + legenda ──

function ComposicaoTab({
  items, result, onOpen,
}: { items: InvisibleCostItem[]; result: ReturnType<typeof computeInvisibleCosts>; onOpen: (i: number) => void }) {
  const max = Math.max(...result.items.map((r) => r.base), 1);
  return (
    <>
      <div className="card">
        <div className="card__head">
          <div>
            <h3>Composição do custo invisível</h3>
            <span className="card__sub">Custo base por item · clique para ver o detalhamento</span>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="dash-state" style={{ margin: 0 }}>Sem itens — use o modelo padrão ou adicione um item na aba Detalhamento.</p>
        ) : (
          <ul className="camp-sectors camp-sectors--cost" style={{ margin: 0 }}>
            {items.map((it, i) => (
              <li key={it.key ?? i} style={{ cursor: "pointer" }} onClick={() => onOpen(i)}>
                <span>{it.label}</span>
                <div className="bar">
                  <div
                    className={`bar__fill ${natureBarClass(it.nature)}`}
                    style={{ width: `${Math.round(((result.items[i]?.base ?? 0) / max) * 100)}%` }}
                  />
                </div>
                <em>{BRL(result.items[i]?.base ?? 0)}</em>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head"><div><h3>Legenda de natureza dos valores</h3></div></div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5 }}>
          {INVISIBLE_COST_NATURES.map((n) => (
            <span key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`bar__fill ${natureBarClass(n)}`} style={{ width: 28, height: 10, borderRadius: 4, display: "inline-block" }} />
              <strong>{INVISIBLE_COST_NATURE_LABEL[n]}</strong>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Aba Detalhamento: tabela editável + colunas de governança ──

function DetalhamentoTab({
  items, result, num, setItem, removeItem, addItem, onOpen, onUsePresets,
}: {
  items: InvisibleCostItem[];
  result: ReturnType<typeof computeInvisibleCosts>;
  num: (v: string) => number;
  setItem: (i: number, patch: Partial<InvisibleCostItem>) => void;
  removeItem: (i: number) => void;
  addItem: () => void;
  onOpen: (i: number) => void;
  onUsePresets: () => void;
}) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Itens de custo</h3>
          <span className="card__sub">custo base = variação × volume × custo unitário</span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={addItem}>+ item</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table cost-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Indicador</th>
              <th>Variação</th>
              <th>Volume</th>
              <th>Custo unit. (R$)</th>
              <th>Custo base</th>
              <th>Natureza</th>
              <th>Confiança</th>
              <th aria-label="detalhe/remover" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.key ?? i}>
                <td><input className="cost-in" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} /></td>
                <td><input className="cost-in" value={it.indicator ?? ""} placeholder="—" onChange={(e) => setItem(i, { indicator: e.target.value })} /></td>
                <td><input className="cost-in cost-in--num" inputMode="decimal" value={it.variation} onChange={(e) => setItem(i, { variation: num(e.target.value) })} /></td>
                <td><input className="cost-in cost-in--num" inputMode="decimal" value={it.volume} onChange={(e) => setItem(i, { volume: num(e.target.value) })} /></td>
                <td><input className="cost-in cost-in--num" inputMode="decimal" value={it.unitCost} onChange={(e) => setItem(i, { unitCost: num(e.target.value) })} /></td>
                <td><strong>{BRL(result.items[i]?.base ?? 0)}</strong></td>
                <td>
                  <select className="cost-in" value={it.nature ?? ""} onChange={(e) => setItem(i, { nature: (e.target.value || undefined) as InvisibleCostNature | undefined })}>
                    <option value="">—</option>
                    {INVISIBLE_COST_NATURES.map((n) => (<option key={n} value={n}>{INVISIBLE_COST_NATURE_LABEL[n]}</option>))}
                  </select>
                </td>
                <td>
                  <select className="cost-in" value={it.confidence ?? ""} onChange={(e) => setItem(i, { confidence: (e.target.value || undefined) as CostConfidence | undefined })}>
                    <option value="">—</option>
                    {CONFIDENCES.map((c) => (<option key={c} value={c}>{COST_CONFIDENCE_LABEL[c]}</option>))}
                  </select>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="lib-act" title="Ficha completa" onClick={() => onOpen(i)}><IconEye size={14} /></button>
                  <button className="cost-del" title="Remover" onClick={() => removeItem(i)}>✕</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ color: "var(--ink-soft, #888)" }}>Sem itens — adicione um ou use o modelo padrão.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={onUsePresets}>
          Usar modelo padrão (turnover · absenteísmo · presenteísmo)
        </button>
      )}
    </div>
  );
}

// ── Aba Cenários: multiplicadores + comparação por item + disclaimer ──

function CenariosTab({
  items, result, scenarios, setScenarios, confidence, setConfidence, num,
}: {
  items: InvisibleCostItem[];
  result: ReturnType<typeof computeInvisibleCosts>;
  scenarios: InvisibleCostScenarios;
  setScenarios: (fn: (s: InvisibleCostScenarios) => InvisibleCostScenarios) => void;
  confidence: CostConfidence;
  setConfidence: (c: CostConfidence) => void;
  num: (v: string) => number;
}) {
  const max = Math.max(...result.items.map((r) => r.conservador), 1);
  return (
    <div className="grid grid--2">
      <div className="card">
        <div className="card__head"><div><h3>Cenários &amp; confiança</h3><span className="card__sub">Multiplicadores da faixa</span></div></div>
        <div className="prod-form__grid">
          <label className="prod-field"><span>Conservador (máx.)</span>
            <input type="number" min={0} step="0.05" value={scenarios.conservador} onChange={(e) => setScenarios((s) => ({ ...s, conservador: num(e.target.value) }))} />
          </label>
          <label className="prod-field"><span>Moderado (base)</span>
            <input type="number" min={0} step="0.05" value={scenarios.moderado} onChange={(e) => setScenarios((s) => ({ ...s, moderado: num(e.target.value) }))} />
          </label>
          <label className="prod-field"><span>Otimista (mín.)</span>
            <input type="number" min={0} step="0.05" value={scenarios.otimista} onChange={(e) => setScenarios((s) => ({ ...s, otimista: num(e.target.value) }))} />
          </label>
          <label className="prod-field"><span>Nível de confiança</span>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value as CostConfidence)}>
              {CONFIDENCES.map((c) => <option key={c} value={c}>{COST_CONFIDENCE_LABEL[c]}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div><h3>Como ler</h3><span className="card__sub">Estimativa, não número contábil</span></div></div>
        <p className="card__sub" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Cada item estima um custo oculto por <strong>variação do indicador × volume afetado × custo unitário</strong>.
          Os três cenários formam uma <strong>faixa</strong> — use o moderado como referência e a faixa como margem de
          incerteza. O nível de confiança reflete a qualidade dos dados de origem.
        </p>
        <p className="card__sub" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10 }}>
          Estimativa gerencial de apoio à decisão — não substitui análise contábil/atuarial e <strong>não representa
          economia garantida</strong>. Reduzir o risco psicossocial atua sobre esses vetores, mas o resultado depende de
          execução e contexto.
        </p>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="card__head">
          <div><h3>Base × Conservador × Otimista, por item</h3><span className="card__sub">Faixa por componente (R$/ano)</span></div>
        </div>
        {items.length === 0 ? (
          <p className="dash-state" style={{ margin: 0 }}>Sem itens.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((it, i) => {
              const r = result.items[i];
              return (
                <div key={it.key ?? i}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{it.label}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    {([["otimista", r?.otimista ?? 0, "bar__fill--observado"], ["moderado", r?.moderado ?? 0, "bar__fill--estimado"], ["conservador", r?.conservador ?? 0, "bar__fill--hipotese"]] as const).map(([k, v, cls]) => (
                      <div key={k} style={{ display: "grid", gridTemplateColumns: "84px 1fr 90px", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-sec)", textTransform: "capitalize" }}>{k}</span>
                        <div className="bar"><div className={`bar__fill ${cls}`} style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
                        <em style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, textAlign: "right" }}>{BRL(v)}</em>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba Histórico: snapshots congelados ("Congelar como ciclo") ──

function HistoricoTab({ hasSavedEstimate }: { hasSavedEstimate: boolean }) {
  const [snapshots, setSnapshots] = useState<InvisibleCostSnapshotData[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setSnapshots(await listCostSnapshots()); } catch { setSnapshots([]); }
  }
  useEffect(() => { load(); }, []);

  async function freeze() {
    setErr(null);
    if (!label.trim()) { setErr("Informe o rótulo do ciclo (ex.: 2026.1)."); return; }
    setBusy(true);
    try {
      await createCostSnapshot(label.trim());
      setLabel("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao congelar o ciclo.");
    } finally {
      setBusy(false);
    }
  }

  const max = Math.max(...(snapshots ?? []).map((s) => s.totals.moderado), 1);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div>
            <h3>Congelar como ciclo</h3>
            <span className="card__sub">Grava a estimativa salva (itens + cenários + totais) como um ponto do histórico</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="prod-field" style={{ maxWidth: 220 }}>
            <span>Rótulo do ciclo</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex.: 2026.1" maxLength={60} disabled={!hasSavedEstimate} />
          </label>
          <button className="btn btn--gold btn--sm" onClick={freeze} disabled={busy || !hasSavedEstimate}>
            {busy ? "Congelando…" : "Congelar ciclo"}
          </button>
        </div>
        {!hasSavedEstimate && <p className="card__sub" style={{ fontSize: 11.5, marginTop: 8 }}>Salve a estimativa (aba Detalhamento) antes de congelar um ciclo.</p>}
        {err && <p className="dash-state dash-state--error" style={{ marginTop: 10 }}>{err}</p>}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h3>Evolução do total</h3>
            <span className="card__sub">Cenário moderado, por ciclo congelado</span>
          </div>
        </div>
        {snapshots === null && <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>}
        {snapshots && snapshots.length === 0 && (
          <p className="dash-state" style={{ margin: 0 }}>Nenhum histórico ainda — congele o primeiro ciclo acima.</p>
        )}
        {snapshots && snapshots.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 130, padding: "8px 0" }}>
              {snapshots.map((s, i) => {
                const h = Math.max(6, (s.totals.moderado / max) * 100);
                const isLatest = i === snapshots.length - 1;
                return (
                  <div key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div title={`${s.label}: ${BRL(s.totals.moderado)}`} style={{
                      width: "100%", height: `${h}%`,
                      background: isLatest ? "var(--gold-deep)" : "var(--gold)",
                      borderRadius: "3px 3px 0 0", transition: "height .3s ease",
                    }} />
                    <span style={{ fontSize: 10, color: "var(--text-sec)" }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Ciclo</th><th>Total (moderado)</th><th>Itens</th><th>Congelado por</th><th>Quando</th></tr></thead>
              <tbody>
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.label}</strong></td>
                    <td>{BRL(s.totals.moderado)}</td>
                    <td>{s.itemsCount}</td>
                    <td>{s.createdByName ?? "—"}</td>
                    <td>{new Date(s.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

// ── Drawer/modal de detalhe (governança completa) — ver e editar um item ──

function ItemDetailModal({
  item, onClose, onSave,
}: { item: InvisibleCostItem; onClose: () => void; onSave: (patch: Partial<InvisibleCostItem>) => void }) {
  const [source, setSource] = useState(item.source ?? "");
  const [formula, setFormula] = useState(item.formula ?? "");
  const [period, setPeriod] = useState(item.period ?? "");
  const [owner, setOwner] = useState(item.owner ?? "");
  const [version, setVersion] = useState(item.version ?? "");
  const [validatedAt, setValidatedAt] = useState(item.validatedAt ?? "");
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <span className="card__eyebrow">{item.nature ? INVISIBLE_COST_NATURE_LABEL[item.nature] : "Natureza não informada"}</span>
            <h2 style={{ marginTop: 4 }}>{item.label}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field"><span>Fonte</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ex.: Folha · RH" />
            </label>
            <label className="prod-field"><span>Período de referência</span>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="ex.: 12m móveis" />
            </label>
            <label className="prod-field"><span>Responsável</span>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ex.: RH · Ana" />
            </label>
            <label className="prod-field"><span>Versão</span>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex.: v1.2" />
            </label>
            <label className="prod-field"><span>Última validação</span>
              <input type="date" value={validatedAt} onChange={(e) => setValidatedAt(e.target.value)} />
            </label>
            <label className="prod-field prod-field--full"><span>Fórmula/premissa</span>
              <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="ex.: saídas × custo de reposição" />
            </label>
            <label className="prod-field prod-field--full"><span>Nota</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn--terra btn--sm"
            onClick={() => onSave({
              source: source.trim() || undefined,
              formula: formula.trim() || undefined,
              period: period.trim() || undefined,
              owner: owner.trim() || undefined,
              version: version.trim() || undefined,
              validatedAt: validatedAt || undefined,
              note: note.trim() || undefined,
            })}
          >
            Salvar ficha
          </button>
        </div>
      </div>
    </div>
  );
}
