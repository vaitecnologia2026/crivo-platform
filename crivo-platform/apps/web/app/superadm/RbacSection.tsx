"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PermissionCode,
  type Role,
} from "@crivo/types";
import {
  createPlatformUser,
  listPlatformUsers,
  updatePlatformUser,
  type PlatformUserData,
} from "../../lib/admin-api";

/** Funções organizacionais da equipe CRIVO (espelha PLATFORM_USER_ROLES da API). */
const CRIVO_ROLES = ["Super Admin", "Comercial", "Financeiro", "Operações", "Consultor"];

/**
 * Super Admin · RBAC view (#55) — leitura: catálogo de papéis + permissões.
 * Edição dinâmica de papéis customizados por tenant fica para próxima fatia
 * (precisa de model TenantRole + UI de criação). Aqui o operador pode auditar
 * exatamente o que cada papel pode ver.
 */
export function RbacSection() {
  const [activeRole, setActiveRole] = useState<Role>("CEO");

  const grid = useMemo(() => buildGrid(), []);
  const activePerms = new Set<PermissionCode>(ROLE_PERMISSIONS[activeRole] as PermissionCode[]);

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Papéis & Permissões</h1>
          <p className="page-sub">
            Catálogo RBAC do sistema, separado por módulo. Cada papel abaixo tem um conjunto
            de permissões — o acesso nunca é irrestrito por padrão.
          </p>
        </div>
        <span className="adm-readonly" title="Catálogo de referência — sem edição nesta tela">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Somente leitura
        </span>
      </div>

      <div className="adm-callout">
        <strong>Papel × escopo.</strong> Este catálogo define <em>o que</em> cada papel pode fazer.
        O <em>onde</em> — escopo por <strong>grupo, CNPJ, contrato, módulo e ciclo</strong> — é
        aplicado no backend por empresa (isolamento multi-tenant RLS: um RH do CNPJ 01 não enxerga
        dados do CNPJ 02, salvo permissão de grupo autorizada) e a edição visual desses recortes,
        papéis customizados (Admin Empresa/Grupo, RH Grupo/CNPJ, Mentor/Facilitador) e o log de
        alteração de permissões entram na próxima fatia (TenantRole). Dados individuais de
        colaboradores, Pocket e ICD nunca são expostos como ranking.
      </div>

      <PlatformUsersPanel />

      <div className="adm-chips">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`adm-chip${activeRole === r ? " is-active" : ""}`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h3>
              Permissões do papel: <strong>{ROLE_LABELS[activeRole]}</strong>
            </h3>
            <span className="card__sub">
              {activePerms.size} de {PERMISSIONS.length} permissões do catálogo liberadas para este papel.
            </span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Permissão</th>
              <th>Liberada?</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((g) => (
              <tr key={g.code}>
                <td><code className="cell-code">{g.module}</code></td>
                <td>{g.label}</td>
                <td>
                  {activePerms.has(g.code) ? (
                    <span className="pattern-tag">✓ Liberada</span>
                  ) : (
                    <span className="cell-na">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildGrid(): Array<{ code: PermissionCode; module: string; action: string; label: string }> {
  return [...PERMISSIONS]
    .sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action))
    .map((p) => ({ code: p.code as PermissionCode, module: p.module, action: p.action, label: p.label }));
}

/**
 * Usuários CRIVO — equipe interna do painel (pedido do cliente 09/07: criar
 * usuários da CRIVO com função — Comercial, Financeiro etc.). Hoje a função é
 * um rótulo organizacional (todo usuário criado aqui tem acesso de administrador
 * do painel); permissões diferenciadas por função entram em fase posterior.
 */
function PlatformUsersPanel() {
  const [users, setUsers] = useState<PlatformUserData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(CRIVO_ROLES[1]); // Comercial como padrão
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<{ email: string; password: string; reset: boolean } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function load() {
    try {
      setUsers(await listPlatformUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar usuários.");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createPlatformUser({ name: name.trim(), email: email.trim(), role });
      setTemp({ email: res.user.email, password: res.tempPassword, reset: false });
      setName("");
      setEmail("");
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(u: PlatformUserData, input: { role?: string | null; active?: boolean; resetPassword?: boolean }) {
    setRowBusy(u.id);
    setError(null);
    try {
      const res = await updatePlatformUser(u.id, input);
      if (res.tempPassword) setTemp({ email: u.email, password: res.tempPassword, reset: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuário.");
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card__head">
        <div>
          <h3>Usuários CRIVO</h3>
          <span className="card__sub">
            Equipe interna do painel com função organizacional (Comercial, Financeiro…).
            A função é um rótulo de organização — todo usuário abaixo acessa o painel como
            administrador; permissões diferenciadas por função entram em fase posterior.
          </span>
        </div>
        <button className="btn btn--primary" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? "Cancelar" : "Novo usuário"}
        </button>
      </div>

      {temp && (
        <div className="pu-temp">
          Senha temporária de <strong>{temp.email}</strong>{temp.reset ? " (redefinida)" : ""}:{" "}
          <code>{temp.password}</code> — anote e repasse agora; ela não será exibida novamente.{" "}
          <button className="row-action" onClick={() => setTemp(null)}>Ocultar</button>
        </div>
      )}

      {formOpen && (
        <form onSubmit={submit} className="ct-filters" style={{ marginTop: 4 }}>
          <input
            className="ct-search"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
          <input
            className="ct-search"
            type="email"
            placeholder="E-mail de acesso"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {CRIVO_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? "Criando…" : "Criar usuário"}
          </button>
        </form>
      )}

      {error && <div className="dash-state dash-state--error">{error}</div>}
      {users === null && !error && <p className="dash-state">Carregando usuários…</p>}
      {users !== null && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Função</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td className="cell-mute">{u.email}</td>
                <td>
                  <select
                    value={u.role && CRIVO_ROLES.includes(u.role) ? u.role : u.role ?? ""}
                    disabled={rowBusy === u.id}
                    onChange={(e) => void patch(u, { role: e.target.value || null })}
                  >
                    <option value="">Sem função</option>
                    {CRIVO_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {u.role && !CRIVO_ROLES.includes(u.role) && (
                      <option value={u.role}>{u.role}</option>
                    )}
                  </select>
                </td>
                <td>
                  <span className={`ct-pill ${u.active ? "ct-pill--ativo" : "ct-pill--suspenso"}`}>
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <span className="row-actions">
                    <button
                      className="row-action"
                      disabled={rowBusy === u.id}
                      onClick={() => void patch(u, { resetPassword: true })}
                    >
                      Redefinir senha
                    </button>
                    <button
                      className={`row-action${u.active ? " row-action--danger" : ""}`}
                      disabled={rowBusy === u.id}
                      onClick={() => void patch(u, { active: !u.active })}
                    >
                      {u.active ? "Desativar" : "Reativar"}
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
