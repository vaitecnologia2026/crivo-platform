"use client";

import { useEffect, useState } from "react";
import {
  ADDON_RECURRENCE_LABEL,
  ADDON_RECURRENCES,
  ADDON_STATUS_LABEL,
  ADDON_STATUSES,
  type AddonRecurrence,
  type AddonStatus,
  type AddonSummary,
  type AddonUpsertRequest,
} from "@crivo/types";
import { deleteAddon, listAddons, upsertAddon } from "@/lib/admin-api";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Preço exibido na tabela: rótulo livre ou derivado do valor + recorrência. */
function priceText(a: AddonSummary): string {
  if (a.priceLabel) return a.priceLabel;
  const base = a.monthlyPriceCents > 0 ? a.monthlyPriceCents : a.setupPriceCents;
  if (base <= 0) return "—";
  switch (a.recurrence) {
    case "MENSAL": return `${brl(base)} / mês`;
    case "POR_CICLO": return `${brl(base)} / ciclo`;
    case "POR_SESSAO": return `${brl(base)} / sessão`;
    default: return brl(base);
  }
}

const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Catálogo de ADICIONAIS (upsells) — tabela no padrão do cliente (mockup 14/07). */
export function AddonsSection() {
  const [addons, setAddons] = useState<AddonSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [editing, setEditing] = useState<AddonSummary | "new" | null>(null);

  async function refresh() {
    try {
      setAddons(await listAddons());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void refresh(); }, []);

  // A tabela do catálogo mostra só os adicionais CONFIGURADOS; os módulos do
  // catálogo fixo sem preço continuam no painel de preços de Contratos e Liberações.
  const rows = (addons ?? []).filter((a) => a.configured);

  async function remove(a: AddonSummary) {
    if (!confirm(`Excluir o adicional "${a.label}" do catálogo?`)) return;
    try { await deleteAddon(a.moduleCode); await refresh(); } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Adicionais</h1>
          <p className="page-sub">
            Catálogo de upsells. Ativação por cliente vive em Contratos e Liberações.
          </p>
        </div>
        <button className="btn btn--sm sol-newbtn" onClick={() => setEditing("new")}>
          Novo adicional
        </button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando adicionais…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os adicionais.</div>
      )}

      {status === "ok" && (
        <>
          <div className="addx-wrap">
            <table className="addx-table">
              <thead>
                <tr>
                  <th>Adicional</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Recorrência</th>
                  <th>Soluções compatíveis</th>
                  <th>Módulos ativados</th>
                  <th>Limites</th>
                  <th>Dependências</th>
                  <th>Regra de liberação</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.moduleCode}>
                    <td className="addx-name">
                      <strong>{a.label}</strong>
                      {a.description && <p>{a.description}</p>}
                    </td>
                    <td>{a.category || "—"}</td>
                    <td className="addx-price">{priceText(a)}</td>
                    <td>{ADDON_RECURRENCE_LABEL[a.recurrence]}</td>
                    <td>
                      {a.compatibleSolutions.length > 0 ? (
                        <div className="sol-chips">
                          {a.compatibleSolutions.map((s) => <span key={s} className="sol-chip">{s}</span>)}
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      {a.activatedModules.length > 0 ? (
                        <div className="sol-chips">
                          {a.activatedModules.map((m) => <span key={m} className="addx-code">{m}</span>)}
                        </div>
                      ) : "—"}
                    </td>
                    <td>{a.limitsNote || "—"}</td>
                    <td>{a.dependenciesNote || "—"}</td>
                    <td>{a.releaseRule || "—"}</td>
                    <td>
                      <span className={`addx-status addx-status--${a.statusEx}`}>
                        {ADDON_STATUS_LABEL[a.statusEx]}
                      </span>
                    </td>
                    <td className="addx-actions">
                      <button type="button" onClick={() => setEditing(a)}>Editar</button>
                      <button type="button" className="is-danger" onClick={() => remove(a)}>Excluir</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="addx-empty">
                      Nenhum adicional cadastrado. Crie o primeiro em “Novo adicional”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              Adicionais são <strong>upsells</strong> — não são produtos principais nem soluções da LP. Ativação e
              cobrança vivem no <strong>Contrato</strong>.
            </p>
          </div>
        </>
      )}

      {editing && (
        <AddonForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </>
  );
}

const splitChips = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

function AddonForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: AddonSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [valor, setValor] = useState(
    initial ? String((initial.monthlyPriceCents > 0 ? initial.monthlyPriceCents : initial.setupPriceCents) / 100 || "") : "",
  );
  const [recurrence, setRecurrence] = useState<AddonRecurrence>(initial?.recurrence ?? "MENSAL");
  const [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? "");
  const [solucoesText, setSolucoesText] = useState((initial?.compatibleSolutions ?? []).join(", "));
  const [modulosText, setModulosText] = useState((initial?.activatedModules ?? []).join(", "));
  const [limits, setLimits] = useState(initial?.limitsNote ?? "");
  const [deps, setDeps] = useState(initial?.dependenciesNote ?? "");
  const [rule, setRule] = useState(initial?.releaseRule ?? "");
  const [statusEx, setStatusEx] = useState<AddonStatus>(initial?.statusEx ?? "ATIVO");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = initial?.moduleCode ?? slugify(label);
    if (!code) { alert("Informe o nome do adicional."); return; }
    setSaving(true);
    try {
      const cents = Math.max(0, Math.round(Number(valor || 0) * 100));
      const payload: AddonUpsertRequest = {
        label: label.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        // Preço vai para o campo coerente com a recorrência (mensal entra no MRR).
        monthlyPriceCents: recurrence === "MENSAL" ? cents : 0,
        setupPriceCents: recurrence === "MENSAL" ? 0 : cents,
        recurrence,
        priceLabel: priceLabel.trim() || null,
        compatibleSolutions: splitChips(solucoesText),
        activatedModules: splitChips(modulosText),
        limitsNote: limits.trim() || null,
        dependenciesNote: deps.trim() || null,
        releaseRule: rule.trim() || null,
        statusEx,
      };
      await upsertAddon(code, payload);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar o adicional");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{initial ? `Editar — ${initial.label}` : "Novo adicional"}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <form onSubmit={onSubmit} className="modal__body prod-form">
          <div className="prod-form__grid">
            <Field label="Nome do adicional" full>
              <input value={label} onChange={(e) => setLabel(e.target.value)} required />
            </Field>
            <Field label="Descrição (linha de apoio na tabela)" full>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Categoria (ex.: Pacote transversal, Serviço)">
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Status">
              <select value={statusEx} onChange={(e) => setStatusEx(e.target.value as AddonStatus)}>
                {ADDON_STATUSES.map((s) => (
                  <option key={s} value={s}>{ADDON_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Field label="Recorrência">
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as AddonRecurrence)}>
                {ADDON_RECURRENCES.map((r) => (
                  <option key={r} value={r}>{ADDON_RECURRENCE_LABEL[r]}</option>
                ))}
              </select>
            </Field>
            <Field label="Rótulo de preço (opcional — ex.: R$ 900 / dossiê)" full>
              <input
                value={priceLabel}
                placeholder="Se vazio, a tabela deriva do valor + recorrência"
                onChange={(e) => setPriceLabel(e.target.value)}
              />
            </Field>
            <Field label="Soluções compatíveis (separe por vírgula)" full>
              <input
                value={solucoesText}
                placeholder="Diagnóstico CRIVO, Evolução, Enterprise"
                onChange={(e) => setSolucoesText(e.target.value)}
              />
            </Field>
            <Field label="Módulos ativados (códigos — separe por vírgula)" full>
              <input
                value={modulosText}
                placeholder="mod-ia, mod-people, mod-dossie"
                onChange={(e) => setModulosText(e.target.value)}
              />
            </Field>
            <Field label="Limites (ex.: 500 chamadas / mês)">
              <input value={limits} onChange={(e) => setLimits(e.target.value)} />
            </Field>
            <Field label="Dependências (ex.: Contrato ativo)">
              <input value={deps} onChange={(e) => setDeps(e.target.value)} />
            </Field>
            <Field label="Regra de liberação" full>
              <input
                value={rule}
                placeholder="Ex.: Requer contrato ativo + consentimento LGPD."
                onChange={(e) => setRule(e.target.value)}
              />
            </Field>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !label.trim()}>
              {saving ? "Salvando…" : initial ? "Salvar alterações" : "Criar adicional"}
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
