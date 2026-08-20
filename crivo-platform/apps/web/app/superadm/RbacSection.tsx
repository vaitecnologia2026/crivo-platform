"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  PERMISSIONS,
  PLATFORM_LEAD_STAGE_LABEL,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  platformLeadOriginLabel,
  type LeadUserSummary,
  type PermissionCode,
  type Role,
} from "@crivo/types";
import {
  createPlatformUser,
  listLeadUsers,
  listPlatformUsers,
  setLeadUserPassword,
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
  const [tab, setTab] = useState<"papeis" | "usuarios">("papeis");
  const [activeRole, setActiveRole] = useState<Role>("CEO");

  const grid = useMemo(() => buildGrid(), []);
  const activePerms = new Set<PermissionCode>(ROLE_PERMISSIONS[activeRole] as PermissionCode[]);

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Papéis & Permissões</h1>
          {tab === "papeis" ? (
            <p className="page-sub">
              Catálogo RBAC do sistema, separado por módulo. Cada papel abaixo tem um conjunto
              de permissões — o acesso nunca é irrestrito por padrão.
            </p>
          ) : (
            <p className="page-sub">
              Cadastro dos leads que responderam o MAPA Executivo CRIVO™ e a conta de acesso
              criada quando o lead virou cliente — inclusive a edição da senha desse acesso.
            </p>
          )}
        </div>
        {/* O selo vale para o catálogo RBAC; a aba Usuários edita senha, então não se aplica. */}
        {tab === "papeis" && (
          <span className="adm-readonly" title="Catálogo de referência — sem edição nesta tela">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Somente leitura
          </span>
        )}
      </div>

      <div className="adm-tabs">
        {([
          ["papeis", "Papéis & Permissões"],
          ["usuarios", "Usuários"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`adm-tab${tab === key ? " is-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "usuarios" && <LeadUsersTab />}

      {tab === "papeis" && (
        <>
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
        </>
      )}
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

// ── Aba "Usuários" — leads do MAPA Executivo + conta de acesso ─────

/** Data curta pt-BR (mesmo formato usado nas demais telas do painel). */
function fmtLeadDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

/** CNPJ com máscara; devolve o valor cru se não tiver 14 dígitos. */
function fmtLeadCnpj(cnpj: string | null): string {
  const d = (cnpj ?? "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Cadastro dos leads que responderam o MAPA Executivo CRIVO™ e, quando o lead
 * já virou cliente, a conta de acesso criada na conversão — com edição da senha.
 *
 * Lead ainda NÃO convertido aparece na lista (é cadastro), mas sem conta: não
 * existe usuário e portanto não há senha para editar.
 */
function LeadUsersTab() {
  const [rows, setRows] = useState<LeadUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await listLeadUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os usuários.");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!rows) return [];
    if (!term) return rows;
    const digits = term.replace(/\D/g, "");
    return rows.filter(
      (r) =>
        [r.name, r.company, r.email, r.phone].some((v) => (v ?? "").toLowerCase().includes(term)) ||
        (digits.length >= 3 && (r.cnpj ?? "").includes(digits)),
    );
  }, [rows, q]);

  function openForm(leadId: string) {
    setOpenId(leadId);
    setPwd("");
    setPwd2("");
    setReveal(false);
    setError(null);
    setOkMsg(null);
  }

  function closeForm() {
    setOpenId(null);
    setPwd("");
    setPwd2("");
    setReveal(false);
  }

  async function save(row: LeadUserSummary) {
    if (pwd.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (pwd !== pwd2) {
      setError("As duas senhas não conferem.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await setLeadUserPassword(row.leadId, pwd);
      setOkMsg(
        `Senha de ${res.email} atualizada. As sessões abertas desse usuário foram encerradas — ` +
          `ele entra com a senha nova no próximo acesso.`,
      );
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Usuários dos leads do MAPA Executivo</h3>
          <span className="card__sub">
            Quem respondeu o MAPA Executivo CRIVO™ entra aqui como cadastro. Depois que o lead
            é convertido em cliente, a conta de acesso aparece na coluna Acesso e a senha pode
            ser editada. {rows ? `${filtered.length} de ${rows.length} registros.` : ""}
          </span>
        </div>
        <input
          className="ct-search"
          placeholder="Buscar por nome, empresa, e-mail ou CNPJ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {okMsg && <div className="pu-temp">{okMsg}</div>}
      {error && <div className="dash-state dash-state--error">{error}</div>}
      {rows === null && !error && <p className="dash-state">Carregando usuários…</p>}

      {rows !== null && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Empresa</th>
              <th>Contato</th>
              <th>MAPA</th>
              <th>Etapa</th>
              <th>Acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Fragment key={r.leadId}>
                <tr>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="cell-mute" style={{ fontSize: 12 }}>
                      {platformLeadOriginLabel(r.origin)} · {fmtLeadDate(r.createdAt)}
                    </div>
                  </td>
                  <td>
                    {r.company || "—"}
                    <div className="cell-mute" style={{ fontSize: 12 }}>
                      {fmtLeadCnpj(r.cnpj)}
                    </div>
                  </td>
                  <td className="cell-mute">
                    {r.email || "—"}
                    {r.phone && <div style={{ fontSize: 12 }}>{r.phone}</div>}
                  </td>
                  <td>{r.diagnosticScore ?? "—"}</td>
                  <td className="cell-mute">{PLATFORM_LEAD_STAGE_LABEL[r.stage] ?? r.stage}</td>
                  <td>
                    {r.account ? (
                      <>
                        <span
                          className={`ct-pill ${r.account.active ? "ct-pill--ativo" : "ct-pill--suspenso"}`}
                        >
                          {r.account.active ? "Ativo" : "Inativo"}
                        </span>
                        <div className="cell-mute" style={{ fontSize: 12 }}>
                          {r.account.email}
                        </div>
                      </>
                    ) : (
                      <span className="cell-na" title="Lead ainda não convertido em cliente">
                        sem acesso
                      </span>
                    )}
                  </td>
                  <td>
                    {r.account ? (
                      <span className="row-actions">
                        <button
                          className="row-action"
                          disabled={busy}
                          onClick={() => (openId === r.leadId ? closeForm() : openForm(r.leadId))}
                        >
                          {openId === r.leadId ? "Cancelar" : "Editar senha"}
                        </button>
                      </span>
                    ) : (
                      <span className="cell-na">—</span>
                    )}
                  </td>
                </tr>
                {openId === r.leadId && r.account && (
                  <tr>
                    <td colSpan={7}>
                      <div className="ct-filters" style={{ marginTop: 0 }}>
                        <input
                          className="ct-search"
                          type={reveal ? "text" : "password"}
                          placeholder="Nova senha (mínimo 8 caracteres)"
                          value={pwd}
                          autoComplete="new-password"
                          onChange={(e) => setPwd(e.target.value)}
                        />
                        <input
                          className="ct-search"
                          type={reveal ? "text" : "password"}
                          placeholder="Repita a nova senha"
                          value={pwd2}
                          autoComplete="new-password"
                          onChange={(e) => setPwd2(e.target.value)}
                        />
                        <button
                          className="row-action"
                          type="button"
                          onClick={() => setReveal((v) => !v)}
                        >
                          {reveal ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          className="btn btn--primary"
                          type="button"
                          disabled={busy}
                          onClick={() => void save(r)}
                        >
                          {busy ? "Salvando…" : "Salvar senha"}
                        </button>
                      </div>
                      <div className="cell-mute" style={{ fontSize: 12, marginTop: 6 }}>
                        A senha vale para <strong>{r.account.email}</strong> no portal do cliente.
                        Salvar encerra as sessões abertas desse usuário.
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="cell-mute">
                  Nenhum lead do MAPA Executivo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
