"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeInvisibleCosts,
  COST_CONFIDENCE_LABEL,
  DEFAULT_COST_SCENARIOS,
  INVISIBLE_COST_PRESETS,
  type CostConfidence,
  type InvisibleCostItem,
  type InvisibleCostScenarios,
} from "@crivo/types";
import { getInvisibleCosts, saveInvisibleCosts } from "../../lib/api";

/**
 * Custo Invisível (Fase 2 — §10/§14). Estimativa gerencial do custo oculto:
 * por item, custo = variação × volume × custo unitário. Mostra uma FAIXA
 * (otimista–conservador) + nível de confiança. Persistido por empresa (RLS).
 * É ESTIMATIVA de apoio à decisão — não afirma economia garantida.
 */
const BRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const CONFIDENCES: CostConfidence[] = ["ALTA", "MEDIA", "BAIXA"];

export function CustoScreen() {
  const [items, setItems] = useState<InvisibleCostItem[]>([]);
  const [scenarios, setScenarios] = useState<InvisibleCostScenarios>(DEFAULT_COST_SCENARIOS);
  const [confidence, setConfidence] = useState<CostConfidence>("MEDIA");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [save, setSave] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);

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

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Custo Invisível</h1>
          <p className="page-sub">
            Estimativa gerencial do custo oculto do risco psicossocial — por item: variação × volume × custo
            unitário. Premium · módulo de sensibilização e priorização.
          </p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
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

      {/* Resultado — faixa estimada */}
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

      {/* Itens de custo (editáveis) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card__head">
          <div>
            <h3>Itens de custo</h3>
            <span className="card__sub">custo base = variação × volume × custo unitário</span>
          </div>
          <button className="btn btn--outline-dark btn--sm" onClick={addItem}>+ item</button>
        </div>
        <table className="data-table cost-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Indicador</th>
              <th>Variação</th>
              <th>Volume</th>
              <th>Custo unit. (R$)</th>
              <th>Custo base</th>
              <th aria-label="remover" />
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
                <td><button className="cost-del" title="Remover" onClick={() => removeItem(i)}>✕</button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} style={{ color: "var(--ink-soft, #888)" }}>Sem itens — adicione um ou use o modelo padrão.</td></tr>
            )}
          </tbody>
        </table>
        {items.length === 0 && (
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setItems(INVISIBLE_COST_PRESETS)}>
            Usar modelo padrão (turnover · absenteísmo · presenteísmo)
          </button>
        )}
      </div>

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        {/* Cenários + confiança */}
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

        {/* Disclaimer */}
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
      </div>
    </>
  );
}
