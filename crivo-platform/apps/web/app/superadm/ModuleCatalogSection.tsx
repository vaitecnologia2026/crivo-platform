"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MODULE_CATALOG_STATUS_LABEL,
  MODULE_CATALOG_STATUSES,
  PLAN_LABELS,
  type ModuleCatalogEntry,
  type ModuleCatalogStatus,
  type ModuleCatalogUpdateRequest,
  type Plan,
} from "@crivo/types";
import { getModuleCatalog, updateModuleCatalogEntry } from "@/lib/admin-api";

/**
 * Módulos Técnicos — Super Admin › Catálogo Comercial (protótipo Lovable /modulos).
 * Registro INTERNO das capacidades reutilizáveis que compõem soluções e
 * adicionais: não são vendidos nem têm preço. A lista vem de MODULES
 * (@crivo/types) via GET /admin/module-catalog, que junta os campos editoriais
 * de module_catalog, as soluções/adicionais que usam cada código e quantas
 * empresas têm o módulo ativo. Não há "Novo módulo": código, nome, categoria e
 * plano mínimo só mudam por deploy (é o TS que manda). O que se edita aqui é
 * texto informativo, auditado ('module.catalog.update').
 */
export function ModuleCatalogSection() {
  const [rows, setRows] = useState<ModuleCatalogEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [categoria, setCategoria] = useState("");
  const [plano, setPlano] = useState("");
  const [editing, setEditing] = useState<ModuleCatalogEntry | null>(null);

  async function refresh() {
    try {
      setRows(await getModuleCatalog());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void refresh(); }, []);

  const categorias = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.category))).sort(),
    [rows],
  );
  const visiveis = (rows ?? []).filter(
    (r) => (!categoria || r.category === categoria) && (!plano || r.minPlan === plano),
  );

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Módulos Técnicos</h1>
          <p className="page-sub">
            Registro interno das capacidades funcionais reutilizáveis que compõem o core das soluções e dos
            adicionais CRIVO. Não são vendidos diretamente e não recebem preço comercial.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando o catálogo de módulos…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar o catálogo de módulos.</div>
      )}

      {status === "ok" && rows && (
        <>
          <div className="ct-filters">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={plano} onChange={(e) => setPlano(e.target.value)} aria-label="Plano mínimo">
              <option value="">Todos os planos</option>
              {(Object.keys(PLAN_LABELS) as Plan[]).map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
            <span className="card__sub">
              {visiveis.length} de {rows.length} módulos · o código e o plano mínimo vêm do catálogo do sistema (deploy)
            </span>
          </div>

          <div className="addx-wrap">
            <table className="addx-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Módulo</th>
                  <th>Descrição funcional</th>
                  <th>Soluções que usam</th>
                  <th>Adicionais que usam</th>
                  <th>Dependências</th>
                  <th>Permissões</th>
                  <th>Regra de ativação técnica</th>
                  <th>Empresas ativas</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((m) => (
                  <tr key={m.code}>
                    <td><span className="addx-code">{m.code}</span></td>
                    <td className="addx-name">
                      <strong>{m.name}</strong>
                      <p>{m.category} · mín. {PLAN_LABELS[m.minPlan]}</p>
                    </td>
                    <td>{m.description || <span className="sol-empty">—</span>}</td>
                    <td>
                      {m.productsUsing.length > 0 ? (
                        <div className="sol-chips">
                          {m.productsUsing.map((s) => <span key={s} className="sol-chip">{s}</span>)}
                        </div>
                      ) : <span className="sol-empty">—</span>}
                    </td>
                    <td>
                      {m.addonsUsing.length > 0 ? (
                        <div className="sol-chips">
                          {m.addonsUsing.map((a) => <span key={a} className="sol-chip sol-chip--terra">{a}</span>)}
                        </div>
                      ) : <span className="sol-empty">—</span>}
                    </td>
                    <td>{m.dependenciesNote || <span className="sol-empty">—</span>}</td>
                    <td>{m.permissionsNote || <span className="sol-empty">—</span>}</td>
                    <td>{m.releaseRule || <span className="sol-empty">—</span>}</td>
                    <td>
                      {/* Contagem real de tenant_modules.enabled — 0 é 0, não é falha. */}
                      <strong>{m.tenantsEnabled}</strong>
                    </td>
                    <td>
                      <span className={`addx-status addx-status--${m.status === "ATIVO" ? "ATIVO" : m.status === "BETA" ? "EM_REVISAO" : "AGUARDANDO_DADOS"}`}>
                        {MODULE_CATALOG_STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="addx-actions">
                      <button type="button" onClick={() => setEditing(m)}>Editar</button>
                    </td>
                  </tr>
                ))}
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={11} className="addx-empty">Nenhum módulo com esse filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              Registro <strong>interno</strong>: não vendável, sem preço próprio. A liberação para a empresa
              acontece em <strong>Soluções / Adicionais → Contrato</strong> — quando um contrato fica ATIVO, os módulos
              das soluções (CORE + técnicos) e dos adicionais viram <strong>liberações técnicas calculadas</strong>,
              sem cobrança própria. Descrição, dependências, permissões e regra de ativação são{" "}
              <strong>informativos</strong> (não viram regra executável) e toda alteração gera evento em Auditoria.
              Código, nome, categoria e plano mínimo só mudam por deploy.
            </p>
          </div>
        </>
      )}

      {editing && (
        <ModuleCatalogForm
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </>
  );
}

function ModuleCatalogForm({
  entry,
  onClose,
  onSaved,
}: {
  entry: ModuleCatalogEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(entry.description ?? "");
  const [deps, setDeps] = useState(entry.dependenciesNote ?? "");
  const [perms, setPerms] = useState(entry.permissionsNote ?? "");
  const [rule, setRule] = useState(entry.releaseRule ?? "");
  const [statusEx, setStatusEx] = useState<ModuleCatalogStatus>(entry.status);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: ModuleCatalogUpdateRequest = {
        description: description.trim() || null,
        dependenciesNote: deps.trim() || null,
        permissionsNote: perms.trim() || null,
        releaseRule: rule.trim() || null,
        status: statusEx,
      };
      await updateModuleCatalogEntry(entry.code, payload);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar o módulo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      {/* Clique fora NÃO fecha: formulário — sai pelo X ou pelo Cancelar (padrão AddonsSection). */}
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Editar — {entry.name} <span className="addx-code">{entry.code}</span></h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <form onSubmit={onSubmit} className="modal__body prod-form">
          <p className="card__sub" style={{ marginTop: 0 }}>
            Categoria <strong>{entry.category}</strong> · plano mínimo <strong>{PLAN_LABELS[entry.minPlan]}</strong> —
            fixos no catálogo do sistema. Os campos abaixo são informativos e auditados.
          </p>
          <div className="prod-form__grid">
            <Field label="Descrição funcional" full>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Dependências (ex.: Diagnóstico + Plano)">
              <input value={deps} onChange={(e) => setDeps(e.target.value)} />
            </Field>
            <Field label="Permissões (ex.: Consultor CRIVO / Admin)">
              <input value={perms} onChange={(e) => setPerms(e.target.value)} />
            </Field>
            <Field label="Regra de ativação técnica" full>
              <input
                value={rule}
                placeholder="Ex.: Sempre ativo em contratos ativos da solução X."
                onChange={(e) => setRule(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select value={statusEx} onChange={(e) => setStatusEx(e.target.value as ModuleCatalogStatus)}>
                {MODULE_CATALOG_STATUSES.map((s) => (
                  <option key={s} value={s}>{MODULE_CATALOG_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
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
      <span>{label}</span>
      {children}
    </label>
  );
}
