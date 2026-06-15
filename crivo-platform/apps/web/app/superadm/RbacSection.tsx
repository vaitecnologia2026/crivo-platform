"use client";

import { useMemo, useState } from "react";
import {
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PermissionCode,
  type Role,
} from "@crivo/types";

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
            Catálogo RBAC do sistema. Estes papéis vêm do enum global; papéis customizados por
            empresa serão adicionados na próxima fatia (TenantRole).
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-[3px] border ${
              activeRole === r
                ? "border-terra bg-terra text-white"
                : "border-line bg-white text-text-sec hover:border-terra"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="rounded-[6px] border border-line bg-white">
        <div className="border-b border-line p-3">
          <h3 className="font-display text-base text-azul-profundo">
            Permissões do papel: <strong>{ROLE_LABELS[activeRole]}</strong>
          </h3>
          <p className="text-[12px] text-text-sec">
            {activePerms.size} permissão(ões) de {PERMISSIONS.length} no catálogo.
          </p>
        </div>
        <div className="p-3 overflow-x-auto">
          <table className="w-full data-table">
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
                  <td className="font-mono text-[12px] text-azul-profundo">{g.module}</td>
                  <td>{g.label}</td>
                  <td>
                    {activePerms.has(g.code) ? (
                      <span className="rounded-full bg-[rgba(46,120,80,0.14)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#2e7850]">
                        ✓ liberada
                      </span>
                    ) : (
                      <span className="text-[12px] text-text-mute">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function buildGrid(): Array<{ code: PermissionCode; module: string; action: string; label: string }> {
  return [...PERMISSIONS]
    .sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action))
    .map((p) => ({ code: p.code as PermissionCode, module: p.module, action: p.action, label: p.label }));
}
