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
