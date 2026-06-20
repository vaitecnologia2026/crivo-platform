"use client";

import { useEffect, useState } from "react";
import { Button } from "@crivo/ui";
import { ROLES, ROLE_LABELS, type Role, type TenantSummary, type UserSummary } from "@crivo/types";
import { createTenantUser, listTenantUsers, updateTenantUser } from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";

const INPUT =
  "w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none transition-colors focus:border-terra";

/** Gestão de usuários de uma empresa pelo Super Admin (control plane). */
export function TenantUsersModal({ tenant, onClose }: { tenant: TenantSummary; onClose: () => void }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: "COLABORADOR",
  });
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await listTenantUsers(tenant.id);
        if (alive) {
          setUsers(u);
          setLoad("ok");
        }
      } catch {
        if (alive) setLoad("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenant.id]);

  async function create() {
    if (!form.name.trim() || !form.email.trim()) return;
    setCreating(true);
    setError(null);
    setTempPassword(null);
    try {
      const res = await createTenantUser(tenant.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      });
      setUsers((prev) => [...prev, res.user]);
      setForm({ name: "", email: "", role: "COLABORADOR" });
      if (res.tempPassword) setTempPassword(res.tempPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  async function patch(u: UserSummary, body: { role?: Role; active?: boolean }) {
    setBusyId(u.id);
    setError(null);
    try {
      const updated = await updateTenantUser(tenant.id, u.id, body);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar usuário");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>Usuários · {tenant.name}</h2>
            <p className="mt-0.5 text-[12px] text-text-sec">
              Gerencie a equipe desta empresa. Os dados ficam isolados por empresa.
            </p>
          </div>
          <button onClick={onClose} className="btn btn--outline-dark btn--sm">
            Fechar
          </button>
        </div>

        <div className="modal__body">
          {load === "loading" && <p className="adm-empty">Carregando usuários…</p>}
          {load === "error" && <p className="adm-empty">Não foi possível carregar.</p>}

          {error && (
            <div className="dash-state dash-state--error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {load === "ok" && (
            <>
              {/* Criar usuário */}
              <p className="mb-3 text-[12px] uppercase tracking-[0.1em] text-text-sec">Novo usuário</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome"
                  className={INPUT}
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@empresa.com"
                  className={INPUT}
                />
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className={INPUT}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="terra"
                  size="sm"
                  onClick={create}
                  disabled={creating || !form.name.trim() || !form.email.trim()}
                >
                  {creating ? "Criando…" : "Criar"}
                </Button>
              </div>
              {tempPassword && (
                <div className="mt-2 rounded-[3px] border border-line bg-[#fafaf7] p-2 text-[12px] text-text-sec">
                  Senha temporária (mostrada uma única vez):{" "}
                  <code className="font-mono text-azul-profundo">{tempPassword}</code>
                </div>
              )}

              {/* Equipe */}
              <p className="mb-3 mt-8 text-[12px] uppercase tracking-[0.1em] text-text-sec">
                Equipe ({users.length})
              </p>
              <ul className="divide-y divide-line rounded-[6px] border border-line">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-text">
                        {u.name}
                        {!u.active && (
                          <span className="pattern-tag pattern-tag--alert" style={{ marginLeft: 6 }}>
                            inativo
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[12px] text-text-sec">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) => patch(u, { role: e.target.value as Role })}
                        className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text outline-none focus:border-terra disabled:opacity-40"
                        aria-label={`Cargo de ${u.name}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={busyId === u.id}
                        onClick={() => patch(u, { active: !u.active })}
                        className={`underline-offset-4 hover:underline disabled:opacity-40 ${
                          u.active ? "text-terra-escura" : "text-azul-cobalto"
                        }`}
                      >
                        {u.active ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </li>
                ))}
                {users.length === 0 && (
                  <li className="px-3 py-4 text-center text-[12px] text-text-sec">Nenhum usuário ainda.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
