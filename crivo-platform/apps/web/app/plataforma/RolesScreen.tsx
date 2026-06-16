"use client";

import { useEffect, useState } from "react";
import { PERMISSIONS, ROLE_LABELS, type PermissionCode, type Role } from "@crivo/types";
import {
  assignTenantRole,
  createTenantRole,
  listTenantRoles,
  listTenantUsers,
  removeTenantRole,
  unassignTenantRole,
  updateTenantRole,
  type TenantRoleData,
  type UserWithRoles,
} from "@/lib/api";

/**
 * #68 — Papéis customizados por tenant (RBAC dinâmico).
 * - Cria/edita/exclui TenantRole com permissões selecionadas do catálogo.
 * - Atribui/desatribui papéis a usuários (multi-papel: o user mantém seu
 *   papel de sistema + ganha permissões adicionais dos custom roles).
 */
export function RolesScreen() {
  const [roles, setRoles] = useState<TenantRoleData[] | null>(null);
  const [users, setUsers] = useState<UserWithRoles[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [editing, setEditing] = useState<TenantRoleData | "new" | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [r, u] = await Promise.all([listTenantRoles(), listTenantUsers()]);
      setRoles(r);
      setUsers(u);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Papéis & Permissões</h1>
          <p className="page-sub">
            Papéis customizados por empresa. O papel de sistema do usuário continua valendo —
            os custom roles <strong>adicionam</strong> permissões.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--gold btn--sm" onClick={() => setEditing("new")}>
            + Novo papel
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={load} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Falha ao carregar.</div>}

      {editing && (
        <RoleForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      {status === "ok" && roles && (
        <div className="grid grid--2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card__head">
              <div>
                <h3>Papéis customizados</h3>
                <span className="card__sub">{roles.length} cadastrado{roles.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            {roles.length === 0 ? (
              <p className="dash-state" style={{ margin: 0 }}>
                Nenhum papel customizado ainda. Use "+ Novo papel" para criar.
              </p>
            ) : (
              <ul className="role-list">
                {roles.map((r) => (
                  <li key={r.id} className={`role-item ${!r.active ? "is-inactive" : ""}`}>
                    <div className="role-item__head">
                      <strong>{r.name}</strong>
                      <span className="card__sub">{r.code}</span>
                    </div>
                    {r.description && <p className="role-item__desc">{r.description}</p>}
                    <div className="role-item__perms">
                      {r.permissions.length} permissão{r.permissions.length === 1 ? "" : "ões"}:{" "}
                      <code>{r.permissions.slice(0, 3).join(", ")}{r.permissions.length > 3 ? "…" : ""}</code>
                    </div>
                    <div className="role-item__actions">
                      <button className="lib-act" onClick={() => setEditing(r)}>editar</button>
                      <button
                        className="lib-act lib-act--danger"
                        onClick={async () => {
                          if (!confirm(`Excluir o papel "${r.name}"?\nUsuários atribuídos perdem essas permissões adicionais.`)) return;
                          try { await removeTenantRole(r.id); await load(); }
                          catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
                        }}
                      >excluir</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <h3>Usuários & atribuições</h3>
                <span className="card__sub">Multi-papel ativo</span>
              </div>
            </div>
            {!users || users.length === 0 ? (
              <p className="dash-state" style={{ margin: 0 }}>Nenhum usuário ativo.</p>
            ) : (
              <ul className="user-list">
                {users.map((u) => (
                  <li key={u.id} className="user-item">
                    <div className="user-item__head">
                      <strong>{u.name}</strong>
                      <span className="pattern-tag">{ROLE_LABELS[u.systemRole as Role] ?? u.systemRole}</span>
                    </div>
                    <span className="card__sub">{u.email}</span>
                    {roles && roles.length > 0 && (
                      <div className="user-item__roles">
                        {roles.filter((r) => r.active).map((r) => {
                          const assigned = u.customRoles.some((cr) => cr.id === r.id);
                          return (
                            <button
                              key={r.id}
                              className={`pill ${assigned ? "pill--gold" : ""}`}
                              onClick={async () => {
                                try {
                                  if (assigned) await unassignTenantRole(r.id, u.id);
                                  else await assignTenantRole(r.id, u.id);
                                  await load();
                                } catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
                              }}
                              title={assigned ? "Clique para remover" : "Clique para atribuir"}
                              style={{ cursor: "pointer", border: 0 }}
                            >
                              {assigned ? "✓ " : ""}{r.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RoleForm({
  initial, onCancel, onSaved,
}: {
  initial: TenantRoleData | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    permissions: new Set<string>(initial?.permissions ?? []),
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePerm(code: string) {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...f, permissions: next };
    });
  }

  async function submit() {
    setError(null);
    if (form.name.length < 2 || (!initial && form.code.length < 2)) {
      setError("Nome e código são obrigatórios."); return;
    }
    if (form.permissions.size === 0) {
      setError("Selecione pelo menos uma permissão."); return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateTenantRole(initial.id, {
          name: form.name,
          description: form.description || null,
          permissions: [...form.permissions],
          active: form.active,
        });
      } else {
        await createTenantRole({
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          permissions: [...form.permissions],
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally { setBusy(false); }
  }

  // Agrupa permissões por módulo para facilitar a seleção.
  const byModule = new Map<string, PermissionCode[]>();
  for (const p of PERMISSIONS) {
    const arr = byModule.get(p.module) ?? [];
    arr.push(p.code as PermissionCode);
    byModule.set(p.module, arr);
  }

  return (
    <div className="card role-form" style={{ marginTop: 16, padding: 18 }}>
      <h3 style={{ marginBottom: 12 }}>{initial ? `Editar papel "${initial.name}"` : "Novo papel customizado"}</h3>

      <div className="grid grid--2" style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="card__sub">Code (sem espaços)</span>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="ex: lider_comercial"
            disabled={!!initial}
            style={{ padding: 8, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="card__sub">Nome</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ex: Líder Comercial"
            style={{ padding: 8, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
          />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        <span className="card__sub">Descrição (opcional)</span>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ padding: 8, border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}
        />
      </label>

      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Permissões ({form.permissions.size} selecionada{form.permissions.size === 1 ? "" : "s"})</p>
        {[...byModule.entries()].map(([mod, codes]) => (
          <div key={mod} style={{ marginBottom: 12 }}>
            <strong style={{ display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 6, textTransform: "uppercase" }}>
              {mod}
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {codes.map((c) => {
                const isOn = form.permissions.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`pill ${isOn ? "pill--gold" : ""}`}
                    onClick={() => togglePerm(c)}
                    style={{ cursor: "pointer", border: 0 }}
                  >
                    {isOn ? "✓ " : ""}{c.split(":")[1]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {initial && (
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: "12px 0", fontSize: 13 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span>Ativo (usuários com este papel ganham as permissões)</span>
        </label>
      )}

      {error && <p className="dash-state dash-state--error" style={{ margin: "8px 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--outline-dark btn--sm" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn--gold btn--sm" onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : initial ? "Salvar" : "Criar papel"}
        </button>
      </div>
    </div>
  );
}
