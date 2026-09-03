"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
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
  listPlatformUsers,
  listProducts,
  upsertContract,
  upsertGroupContract,
  type PlatformUserData,
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
  // Equipe CRIVO cadastrada em Papéis e Permissões — alimenta o "Responsável CRIVO".
  // Falha de rede aqui não derruba o modal: a lista fica vazia e o campo avisa.
  const [crivoUsers, setCrivoUsers] = useState<PlatformUserData[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, prods, adds, users] = await Promise.all([
          isGroup ? getGroupContract(targetId) : getContract(targetId),
          listProducts(),
          // C4: opcionais vêm do catálogo de Adicionais — mesmos nomes da tela
          // Adicionais. Falha aqui não derruba o modal: cai na lista fixa.
          listAddons().catch(() => null),
          // Usuários CRIVO (Papéis e Permissões) p/ o seletor de responsável.
          // Mesmo tratamento: falhar aqui não pode impedir de editar o contrato.
          listPlatformUsers().catch(() => [] as PlatformUserData[]),
        ]);
        if (!alive) return;
        setProducts(prods.filter((p) => !p.isLeadCapture));
        setAddons(adds);
        setCrivoUsers(users);
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
    <div className="modal-backdrop">
    {/* Clique fora NAO fecha: modal com formulario — fechar por engano apagava o que ja tinha sido digitado. Sai pelo X ou pelo Cancelar. */}
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
                // C4: a lista vem do CATÁLOGO — espelha a tela Adicionais item a
                // item, sem filtrar por precificação nem por status. addons === null
                // significa FALHA ao carregar (aí a lista fixa evita travar o
                // contrato); catálogo carregado porém vazio NÃO cai na lista fixa —
                // senão precificar o 1º adicional "sumiria" com todos os outros.
                const failed = addons === null;
                const catalog = addons ?? [];
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
                        : "Os nomes e preços vivem na tela Adicionais — a lista aqui espelha o catálogo completo."}
                    </p>
                  </>
                );
              })()}
            </fieldset>

            <fieldset className="prod-fs">
              <legend>Responsável e observações</legend>
              <div className="prod-form__grid">
                {/* Era um campo de texto livre: cada contrato ganhava o nome escrito
                    de um jeito ("Ana", "ana souza", "Ana S."), e nada garantia que a
                    pessoa ainda estivesse na equipe. Agora escolhe-se de quem já está
                    em Papéis e Permissões. O que é GRAVADO continua sendo o nome
                    (string), igual a antes — nenhum contrato antigo precisou mudar. */}
                <ResponsibleSelect
                  value={form.responsible ?? ""}
                  users={crivoUsers}
                  onChange={(v) => set("responsible", v)}
                />
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

/**
 * "Responsável CRIVO" — dropdown com busca sobre os usuários cadastrados em
 * Papéis e Permissões (`GET /admin/platform-users`, a mesma lista do painel
 * "Usuários CRIVO").
 *
 * O que é GRAVADO continua sendo o NOME, string, exatamente como o campo de texto
 * gravava: `Contract.responsible` não mudou de tipo e nenhum contrato antigo
 * precisou ser tocado. O seletor troca só COMO se escolhe.
 *
 * Três cuidados que o campo de texto não tinha e que aqui não podem faltar:
 *  • um responsável já gravado que NÃO está na lista (pessoa que saiu da equipe,
 *    ou nome digitado antes desta tela existir) continua aparecendo e continua
 *    salvo — some só se alguém escolher outro de propósito;
 *  • só usuários ATIVOS entram nas opções novas: desativar alguém em Papéis e
 *    Permissões tira a pessoa das escolhas futuras sem mexer no que já foi feito;
 *  • se a lista não carregar, o campo diz isso em vez de fingir que não há ninguém.
 */
function ResponsibleSelect({
  value,
  users,
  onChange,
}: {
  value: string;
  users: PlatformUserData[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  // O combobox precisa apontar para a lista que ele controla (aria-controls).
  const listId = useId();

  // Fecha ao clicar fora. `mousedown` e não `click`: o clique numa opção só
  // termina depois, e com `click` o documento fecharia a lista antes da escolha.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const ativos = users.filter((u) => u.active);
  const q = query.trim().toLowerCase();
  // Busca por nome, e-mail ou função — quem procura "comercial" acha o time todo.
  const filtrados = q
    ? ativos.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.role ?? "").toLowerCase().includes(q),
      )
    : ativos;

  const foraDaLista = value.trim() !== "" && !ativos.some((u) => u.name === value);

  function escolher(nome: string) {
    onChange(nome);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="prod-field prod-field--full">
      <span>Responsável CRIVO</span>
      <div ref={boxRef} style={{ position: "relative" }}>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Responsável CRIVO"
          autoComplete="off"
          style={{ width: "100%" }}
          placeholder={ativos.length ? "Buscar usuário CRIVO…" : "Nenhum usuário disponível"}
          /* Fechado mostra quem está escolhido; aberto mostra o que se digita. */
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onClick={() => { setOpen(true); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
          }}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Usuários CRIVO"
            style={{
              position: "absolute",
              zIndex: 5,
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              margin: 0,
              padding: 4,
              listStyle: "none",
              maxHeight: 220,
              overflowY: "auto",
              background: "var(--bg-elev)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
              boxShadow: "var(--shadow-2)",
            }}
          >
            {/* Limpar o campo é uma escolha legítima: contrato sem responsável
                definido ainda é rascunho válido, e era possível antes (texto vazio). */}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => escolher("")}
                style={optionStyle(value === "")}
              >
                — nenhum —
              </button>
            </li>
            {filtrados.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={u.name === value}
                  onClick={() => escolher(u.name)}
                  style={optionStyle(u.name === value)}
                >
                  <strong style={{ fontSize: 13 }}>{u.name}</strong>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-sec)" }}>
                    {u.role ? `${u.role} · ` : ""}{u.email}
                  </span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && (
              <li style={{ padding: "10px 8px", fontSize: 12, color: "var(--text-sec)" }}>
                {ativos.length === 0
                  ? "Nenhum usuário ativo em Papéis e Permissões."
                  : "Nenhum usuário encontrado."}
              </li>
            )}
          </ul>
        )}
      </div>
      {foraDaLista && (
        <p className="prod-note" style={{ margin: "6px 0 0" }}>
          <strong>{value}</strong> não está entre os usuários ativos de Papéis e Permissões.
          O nome segue gravado no contrato — escolha outro só se for para trocar.
        </p>
      )}
    </div>
  );
}

/** Estilo de uma opção da lista — a selecionada fica marcada. */
function optionStyle(selecionada: boolean): CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "7px 8px",
    border: 0,
    borderRadius: "var(--r-sm)",
    background: selecionada ? "var(--line-soft)" : "transparent",
    font: "inherit",
    fontSize: 13,
    color: "var(--text)",
    cursor: "pointer",
  };
}
