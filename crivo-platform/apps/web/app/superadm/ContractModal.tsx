"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_MODELS,
  CONTRACT_MODEL_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  DIAGNOSTIC_METHOD_LABEL,
  MODULES,
  TECHNICAL_OUTPUTS,
  TECHNICAL_OUTPUT_LABEL,
  type AddonSummary,
  type ContractModel,
  type ContractStatus,
  type ProductSummary,
  type TechnicalOutput,
  type TenantSummary,
  type UpsertContractRequest,
} from "@crivo/types";
import {
  getContract,
  getGroupContract,
  listAddons,
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
  // null = catálogo de Adicionais INDISPONÍVEL (falha de rede) — diferente de
  // catálogo carregado porém vazio (nenhum adicional precificado/ativo).
  const [addons, setAddons] = useState<AddonSummary[] | null>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, prods, adds] = await Promise.all([
          isGroup ? getGroupContract(targetId) : getContract(targetId),
          listProducts(),
          // C4: opcionais vêm do catálogo de Adicionais — mesmos nomes da tela
          // Adicionais. Falha aqui não derruba o modal: cai na lista fixa.
          listAddons().catch(() => null),
        ]);
        if (!alive) return;
        setProducts(prods.filter((p) => !p.isLeadCapture));
        setAddons(adds);
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
      // C3 (decisão da call 14/07): o MÉTODO vem da SOLUÇÃO — o contrato não o
      // define mais. O override legado só é limpo quando a solução principal
      // DEFINE método (aí a limpeza é inócua); sem solução ou com solução sem
      // método, o valor legado do contrato é o ÚNICO método efetivo — apagá-lo
      // deixaria portal e documentos sem contexto, silenciosamente.
      const primary = products.find((p) => p.id === (form.solutionIds ?? [])[0]);
      const payload = primary?.method ? { ...form, method: null } : form;
      await (isGroup ? upsertGroupContract(targetId, payload) : upsertContract(targetId, payload));
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
                  <span>Método CRIVO (herdado da solução)</span>
                  {/* C3: o método NÃO é editável no contrato — quem o define é a
                      solução contratada (Soluções CRIVO). Sem solução com método,
                      o valor LEGADO do contrato segue valendo e aparece aqui. */}
                  {(() => {
                    const primary = products.find((p) => p.id === (form.solutionIds ?? [])[0]);
                    const legacy = !primary?.method && form.method ? form.method : null;
                    const value = primary?.method
                      ? DIAGNOSTIC_METHOD_LABEL[primary.method]
                      : legacy
                        ? `${DIAGNOSTIC_METHOD_LABEL[legacy]} (legado, do contrato)`
                        : "—";
                    const text = primary?.method
                      ? `Herdado de “${primary.name}”.`
                      : legacy
                        ? `Este contrato ainda usa o método definido no próprio contrato — cadastre o método na solução (Soluções CRIVO) para padronizar.`
                        : primary
                          ? `“${primary.name}” ainda não define método — cadastre na tela Soluções CRIVO.`
                          : "Escolha a solução principal acima — é ela que define o método.";
                    return (
                      <>
                        <input value={value} readOnly disabled />
                        <span className="prod-note" style={{ margin: "6px 0 0" }}>{text}</span>
                      </>
                    );
                  })()}
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
                O <strong>prazo</strong> (fim/dias) de um contrato <strong>ATIVO</strong> já vale no acesso:
                expirado, o login da empresa é bloqueado. Os <strong>limites</strong> (respondentes/líderes)
                seguem informativos — o bloqueio por teto entra na próxima fatia.
              </p>
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Adicionais do contrato (catálogo de Adicionais)</legend>
              {(() => {
                // C4: a lista vem do CATÁLOGO (só configurados e ativos) — os
                // mesmos nomes da tela Adicionais. addons === null significa
                // FALHA ao carregar (aí a lista fixa evita travar o contrato);
                // catálogo carregado porém vazio NÃO cai na lista fixa — senão
                // precificar o 1º adicional "sumiria" com todos os outros.
                const failed = addons === null;
                const catalog = (addons ?? []).filter((a) => a.configured && a.active);
                const options = failed
                  ? MODULES.map((m) => ({ code: m.code, name: m.name }))
                  : catalog.map((a) => ({ code: a.moduleCode, name: a.label }));
                // Retrocompatibilidade: códigos JÁ selecionados fora das opções
                // continuam visíveis (com o nome do catálogo, quando existir).
                const known = new Set(options.map((o) => o.code));
                const legacy = (form.optionalModules ?? []).filter((c) => !known.has(c));
                const all = [
                  ...options,
                  ...legacy.map((code) => {
                    const row = (addons ?? []).find((a) => a.moduleCode === code);
                    return { code, name: row ? `${row.label} (indisponível p/ novos contratos)` : `${code} (fora do catálogo)` };
                  }),
                ];
                return (
                  <>
                    {all.length > 0 ? (
                      <div className="prod-modules">
                        {all.map((m) => (
                          <label key={m.code} className="prod-check">
                            <input
                              type="checkbox"
                              checked={(form.optionalModules ?? []).includes(m.code)}
                              onChange={() => toggleModule(m.code)}
                            />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="prod-note">Nenhum adicional ativo e precificado no catálogo ainda.</p>
                    )}
                    <p className="prod-note" style={{ margin: "6px 0 0" }}>
                      {failed
                        ? "Catálogo de Adicionais indisponível agora — exibindo a lista padrão de módulos."
                        : "Os nomes e preços vivem na tela Adicionais — adicionais sem preço configurado não aparecem aqui até serem precificados."}
                    </p>
                  </>
                );
              })()}
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
