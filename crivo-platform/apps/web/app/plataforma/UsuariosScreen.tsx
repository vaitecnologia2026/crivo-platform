"use client";

import { useEffect, useState } from "react";
import { listUsers, getUserSeats, createUser, updateUser } from "@/lib/api";
import { ROLE_LABELS, type Role, type UserSummary, type UserSeats } from "@crivo/types";
import { SCREEN_OPTIONS } from "./nav.config";

/**
 * Usuários & Equipe (gestão do time da empresa). Admin adiciona usuários,
 * define o papel e, via checklist, EXATAMENTE quais telas cada um acessa
 * (User.screenAccess → filtra a nav). O limite de usuários vem do Produto da
 * empresa (Super Admin) — exibido como "X de Y".
 */
const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as Role[];

// Telas agrupadas (para a checklist), na ordem do menu.
const GROUPS = SCREEN_OPTIONS.reduce<Record<string, { route: string; label: string }[]>>(
  (acc, s) => {
    (acc[s.group] ??= []).push({ route: s.route, label: s.label });
    return acc;
  },
  {},
);

export function UsuariosScreen() {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [seats, setSeats] = useState<UserSeats | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [editing, setEditing] = useState<UserSummary | "new" | null>(null);
  const [tempPwd, setTempPwd] = useState<{ email: string; pwd: string } | null>(null);

  async function reload() {
    try {
      const [u, s] = await Promise.all([listUsers(), getUserSeats()]);
      setUsers(u);
      setSeats(s);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const full = seats?.max != null && seats.active >= seats.max;

  if (status === "loading") return <p className="dash-state">Carregando equipe…</p>;
  if (status === "error")
    return <div className="dash-state dash-state--error">Não foi possível carregar os usuários.</div>;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Usuários & Equipe</h1>
          <p className="page-sub">
            Adicione pessoas, defina o papel e escolha as telas que cada uma acessa.{" "}
            {seats && (
              <strong style={{ color: full ? "var(--danger,#c0392b)" : "var(--gold-deep)" }}>
                {seats.active} de {seats.max == null ? "∞" : seats.max} usuários
              </strong>
            )}
          </p>
        </div>
        <div className="route__actions">
          <button
            className="btn btn--gold btn--sm"
            onClick={() => setEditing("new")}
            disabled={full}
            title={full ? "Limite de usuários atingido (ajuste no produto, no Super Admin)" : ""}
          >
            + Adicionar usuário
          </button>
        </div>
      </div>

      {full && (
        <div className="dash-state" style={{ marginBottom: 16 }}>
          Limite de usuários do plano/produto atingido ({seats?.max}). Desative alguém ou aumente o
          limite no produto da empresa (Super Admin).
        </div>
      )}

      {tempPwd && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--gold)" }}>
          <div className="card__head">
            <div>
              <h3>Senha temporária gerada</h3>
              <span className="card__sub">
                Anote e envie para <strong>{tempPwd.email}</strong> — só aparece agora.
              </span>
            </div>
          </div>
          <code
            style={{
              display: "inline-block",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 1,
              padding: "8px 14px",
              background: "var(--line-soft)",
              borderRadius: 8,
            }}
          >
            {tempPwd.pwd}
          </code>{" "}
          <button className="btn btn--ghost btn--sm" onClick={() => setTempPwd(null)}>
            Ok, anotei
          </button>
        </div>
      )}

      {editing && (
        <UserForm
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(temp) => {
            setEditing(null);
            if (temp) setTempPwd(temp);
            reload();
          }}
        />
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Telas</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                <td>
                  {u.screenAccess == null
                    ? "Todas"
                    : `${u.screenAccess.length} tela${u.screenAccess.length === 1 ? "" : "s"}`}
                </td>
                <td>
                  <span
                    className="pill"
                    style={{ color: u.active ? "var(--green,#2f9e64)" : "var(--ink-soft,#888)" }}
                  >
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(u)}>
                    Editar
                  </button>{" "}
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      await updateUser(u.id, { active: !u.active });
                      reload();
                    }}
                  >
                    {u.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={6} className="card__sub" style={{ padding: 18 }}>
                  Nenhum usuário ainda. Clique em “Adicionar usuário”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────── Formulário (criar / editar) ───────────────────────
function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: UserSummary | null;
  onClose: () => void;
  onSaved: (temp: { email: string; pwd: string } | null) => void;
}) {
  const isNew = user == null;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? ("COLABORADOR" as Role));
  const [password, setPassword] = useState("");
  const [allScreens, setAllScreens] = useState(user ? user.screenAccess == null : true);
  const [screens, setScreens] = useState<Set<string>>(new Set(user?.screenAccess ?? []));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(route: string) {
    setScreens((s) => {
      const n = new Set(s);
      n.has(route) ? n.delete(route) : n.add(route);
      return n;
    });
  }

  async function save() {
    setErr(null);
    if (isNew && (!name.trim() || !email.trim())) {
      setErr("Informe nome e e-mail.");
      return;
    }
    const screenAccess = allScreens ? null : Array.from(screens);
    if (!allScreens && screenAccess!.length === 0) {
      setErr("Selecione ao menos uma tela ou marque “Acesso a todas”.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createUser({
          name: name.trim(),
          email: email.trim(),
          role,
          password: password.trim() || undefined,
          screenAccess,
        });
        onSaved(res.tempPassword ? { email: res.user.email, pwd: res.tempPassword } : null);
      } else {
        await updateUser(user!.id, { role, screenAccess });
        onSaved(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderTop: "3px solid var(--gold)" }}>
      <div className="card__head">
        <div>
          <h3>{isNew ? "Novo usuário" : `Editar ${user!.name}`}</h3>
          <span className="card__sub">Papel define a capacidade; as telas definem o que ele vê.</span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Fechar</button>
      </div>

      <div className="prod-form__grid" style={{ marginBottom: 14 }}>
        <label className="prod-field">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isNew} />
        </label>
        <label className="prod-field">
          <span>E-mail corporativo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isNew} />
        </label>
        <label className="prod-field">
          <span>Papel</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </label>
        {isNew && (
          <label className="prod-field">
            <span>Senha (vazio = gerar temporária)</span>
            <input
              type="text"
              value={password}
              placeholder="deixe vazio para gerar"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="card__sub" style={{ marginBottom: 8, fontWeight: 600 }}>Telas que pode acessar</div>
      <label className="check" style={{ display: "inline-flex", gap: 8, marginBottom: 10 }}>
        <input type="checkbox" checked={allScreens} onChange={(e) => setAllScreens(e.target.checked)} />
        Acesso a <strong>todas</strong> as telas (sem restrição)
      </label>

      {!allScreens && (
        <div className="grid grid--2" style={{ gap: 8 }}>
          {Object.entries(GROUPS).map(([group, items]) => (
            <div key={group} className="card" style={{ padding: 12 }}>
              <div className="card__sub" style={{ fontWeight: 700, marginBottom: 6 }}>{group}</div>
              {items.map((it) => (
                <label
                  key={it.route}
                  className="check"
                  style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: 13 }}
                >
                  <input type="checkbox" checked={screens.has(it.route)} onChange={() => toggle(it.route)} />
                  {it.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {err && <p className="dash-state--error" style={{ marginTop: 10 }}>{err}</p>}
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn btn--gold btn--sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : isNew ? "Criar usuário" : "Salvar alterações"}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
