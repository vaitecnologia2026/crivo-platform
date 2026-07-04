"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_MODELS,
  CONTRACT_MODEL_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  DIAGNOSTIC_METHODS,
  DIAGNOSTIC_METHOD_LABEL,
  MODULES,
  TECHNICAL_OUTPUTS,
  TECHNICAL_OUTPUT_LABEL,
  type ContractModel,
  type ContractStatus,
  type DiagnosticMethod,
  type ProductSummary,
  type TechnicalOutput,
  type TenantSummary,
  type UpsertContractRequest,
} from "@crivo/types";
import {
  getContract,
  getGroupContract,
  listProducts,
  upsertContract,
  upsertGroupContract,
} from "@/lib/admin-api";

/** Configura o contrato de uma empresa OU de um grupo (Tela 05) — sem programação.
 *  Passe `tenant` para contrato por CNPJ, ou `group` para contrato do grupo. */
export function ContractModal({
  tenant,
  group,
  onClose,
}: {
  tenant?: TenantSummary;
  group?: { id: string; name: string };
  onClose: () => void;
}) {
  const isGroup = !!group;
  const targetId = group?.id ?? tenant!.id;
  const targetName = group?.name ?? tenant!.name;

  const [form, setForm] = useState<UpsertContractRequest>({});
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, prods] = await Promise.all([
          isGroup ? getGroupContract(targetId) : getContract(targetId),
          listProducts(),
        ]);
        if (!alive) return;
        setProducts(prods.filter((p) => !p.isLeadCapture));
        setForm(
          c
            ? {
                productId: c.productId,
                solutionIds: c.solutionIds,
                model: c.model,
                status: c.status,
                method: c.method,
                technicalOutput: c.technicalOutput,
                startDate: c.startDate ? c.startDate.slice(0, 10) : "",
                endDate: c.endDate ? c.endDate.slice(0, 10) : "",
                accessDays: c.accessDays ?? undefined,
                rounds: c.rounds,
                maxRespondents: c.maxRespondents,
                maxLeaders: c.maxLeaders,
                optionalModules: c.optionalModules,
                responsible: c.responsible ?? "",
                notes: c.notes ?? "",
              }
            : { model: "PONTUAL", status: "RASCUNHO", technicalOutput: "SEM_INTEGRACAO", rounds: 1 },
        );
        setStatus("ok");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, [targetId, isGroup]);

  const set = <K extends keyof UpsertContractRequest>(k: K, v: UpsertContractRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function toggleModule(code: string) {
    const cur = form.optionalModules ?? [];
    set("optionalModules", cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  function toggleSolution(id: string) {
    const cur = form.solutionIds ?? [];
    set("solutionIds", cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await (isGroup ? upsertGroupContract(targetId, form) : upsertContract(targetId, form));
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar o contrato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Contrato {isGroup ? "do grupo" : "—"} {targetName}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        {status === "loading" && <div className="modal__body"><p className="dash-state">Carregando…</p></div>}
        {status === "error" && (
          <div className="modal__body"><div className="dash-state dash-state--error">Não foi possível carregar.</div></div>
        )}

        {status === "ok" && (
          <form onSubmit={save} className="modal__body prod-form">
            <fieldset className="prod-fs">
              <legend>Solução e modelo</legend>
              <div className="prod-form__grid">
                <label className="prod-field prod-field--full">
                  <span>Soluções contratadas (uma ou várias)</span>
                  <div className="prod-modules">
                    {products.map((p) => (
                      <label key={p.id} className="prod-check">
                        <input
                          type="checkbox"
                          checked={(form.solutionIds ?? []).includes(p.id)}
                          onChange={() => toggleSolution(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  <span className="prod-note" style={{ marginTop: 4 }}>
                    O contrato compõe o que o cliente comprou — não cria produto novo. Ao salvar como
                    <strong> Ativo</strong>, os módulos das soluções + adicionais são liberados na empresa.
                  </span>
                </label>
                <label className="prod-field">
                  <span>Modelo de contratação</span>
                  <select value={form.model ?? "PONTUAL"} onChange={(e) => set("model", e.target.value as ContractModel)}>
                    {CONTRACT_MODELS.map((m) => (<option key={m} value={m}>{CONTRACT_MODEL_LABEL[m]}</option>))}
                  </select>
                </label>
                <label className="prod-field">
                  <span>Status do contrato</span>
                  <select value={form.status ?? "RASCUNHO"} onChange={(e) => set("status", e.target.value as ContractStatus)}>
                    {CONTRACT_STATUSES.map((s) => (<option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>))}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Método × Saída técnica</legend>
              <div className="prod-form__grid">
                <label className="prod-field">
                  <span>Método CRIVO</span>
                  <select value={form.method ?? ""} onChange={(e) => set("method", (e.target.value || null) as DiagnosticMethod | null)}>
                    <option value="">— herdar da solução —</option>
                    {DIAGNOSTIC_METHODS.map((m) => (<option key={m} value={m}>{DIAGNOSTIC_METHOD_LABEL[m]}</option>))}
                  </select>
                </label>
                <label className="prod-field">
                  <span>Saída técnica (documentos)</span>
                  <select value={form.technicalOutput ?? "SEM_INTEGRACAO"} onChange={(e) => set("technicalOutput", e.target.value as TechnicalOutput)}>
                    {TECHNICAL_OUTPUTS.map((o) => (<option key={o} value={o}>{TECHNICAL_OUTPUT_LABEL[o]}</option>))}
                  </select>
                </label>
              </div>
              <p className="prod-note">Porte define o método; obrigação documental define a saída. PGR não obriga Organizacional.</p>
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Prazo e limites</legend>
              <div className="prod-form__grid">
                <label className="prod-field">
                  <span>Início</span>
                  <input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} />
                </label>
                <label className="prod-field">
                  <span>Fim</span>
                  <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
                </label>
                <label className="prod-field">
                  <span>Prazo de acesso (dias)</span>
                  <input type="number" min={0} value={form.accessDays ?? ""} onChange={(e) => set("accessDays", e.target.value ? Number(e.target.value) : null)} />
                </label>
                <label className="prod-field">
                  <span>Rodadas / ciclos</span>
                  <input type="number" min={0} value={form.rounds ?? 1} onChange={(e) => set("rounds", Number(e.target.value))} />
                </label>
                <label className="prod-field">
                  <span>Máx. respondentes (0 = ∞)</span>
                  <input type="number" min={0} value={form.maxRespondents ?? 0} onChange={(e) => set("maxRespondents", Number(e.target.value))} />
                </label>
                <label className="prod-field">
                  <span>Máx. líderes (0 = ∞)</span>
                  <input type="number" min={0} value={form.maxLeaders ?? 0} onChange={(e) => set("maxLeaders", Number(e.target.value))} />
                </label>
              </div>
              <p className="prod-note" style={{ marginTop: 8 }}>
                Prazo (fim/dias) e limites (respondentes/líderes) são registrados no contrato e usados
                para alertas. O <strong>bloqueio automático</strong> de acesso ao expirar o prazo ou ao
                atingir o limite entra na próxima fatia — hoje não trava sozinho.
              </p>
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Módulos opcionais (além do CORE da solução)</legend>
              <div className="prod-modules">
                {MODULES.map((m) => (
                  <label key={m.code} className="prod-check">
                    <input type="checkbox" checked={(form.optionalModules ?? []).includes(m.code)} onChange={() => toggleModule(m.code)} />
                    {m.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Responsável e observações</legend>
              <div className="prod-form__grid">
                <label className="prod-field prod-field--full">
                  <span>Responsável CRIVO</span>
                  <input value={form.responsible ?? ""} onChange={(e) => set("responsible", e.target.value)} />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Observações</span>
                  <textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </label>
              </div>
            </fieldset>

            <div className="modal__foot">
              {saved && <span className="kb-converted" style={{ marginRight: "auto" }}>✓ Contrato salvo</span>}
              <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
              <button type="submit" className="btn btn--terra btn--sm" disabled={saving}>
                {saving ? "Salvando…" : "Salvar contrato"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
