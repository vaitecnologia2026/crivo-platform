"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PLANS,
  PLAN_LABELS,
  type Plan,
  type TenantModuleSummary,
  type TenantSummary,
  type UsageSummary,
} from "@crivo/types";
import {
  getTenantUsage,
  listTenantModules,
  setTenantModule,
  setTenantPlan,
} from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";

/** Painel de módulos + plano + uso de uma empresa (F4): troca de plano,
 *  liga/desliga módulos respeitando o plano, e mostra uso vs. limites. */
export function ModulesModal({
  tenant,
  onClose,
  onTenantUpdated,
}: {
  tenant: TenantSummary;
  onClose: () => void;
  onTenantUpdated?: (t: TenantSummary) => void;
}) {
  const [plan, setPlan] = useState<Plan>(tenant.plan);
  const [modules, setModules] = useState<TenantModuleSummary[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [mods, use] = await Promise.all([
      listTenantModules(tenant.id),
      getTenantUsage(tenant.id),
    ]);
    setModules(mods);
    setUsage(use);
  }, [tenant.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reload();
        if (alive) setLoad("ok");
      } catch {
        if (alive) setLoad("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  async function changePlan(next: Plan) {
    if (next === plan) return;
    setBusy("__plan__");
    setError(null);
    try {
      const updated = await setTenantPlan(tenant.id, next);
      setPlan(updated.plan);
      onTenantUpdated?.(updated);
      await reload(); // módulos foram re-sincronizados; uso/limites mudaram
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar o plano");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(m: TenantModuleSummary) {
    if (!m.availableForPlan) return;
    setBusy(m.code);
    setError(null);
    try {
      setModules(await setTenantModule(tenant.id, m.code, !m.enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar o módulo");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>Módulos · {tenant.name}</h2>
            <p className="mt-0.5 text-[12px] text-text-sec">
              Módulos acima do plano ficam indisponíveis.
            </p>
          </div>
          <button onClick={onClose} className="btn btn--outline-dark btn--sm">
            Fechar
          </button>
        </div>

        <div className="modal__body">
          {load === "loading" && <p className="adm-empty">Carregando módulos…</p>}
          {load === "error" && (
            <p className="adm-empty">Não foi possível carregar os módulos.</p>
          )}

          {error && (
            <div className="dash-state dash-state--error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {load === "ok" && (
            <>
              {/* Plano + uso */}
              <div className="mod-planbar">
                <label className="mod-planbar__plan">
                  <span className="mod-planbar__label">Plano</span>
                  <select
                    value={plan}
                    disabled={busy === "__plan__"}
                    onChange={(e) => changePlan(e.target.value as Plan)}
                    className="mod-select"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {usage && (
                  <div className="mod-planbar__usage">
                    <span className="mod-planbar__label">Uso · {usage.period}</span>
                    <div>
                      {usage.metrics.map((mt) => (
                        <span key={mt.metric} className="mod-usage__metric">
                          {mt.metric}: <strong>{mt.value}</strong>
                          {mt.limit !== null ? ` / ${mt.limit}` : " / ∞"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <ul className="mod-list">
                {modules.map((m) => (
                  <li key={m.code} className="mod-item">
                    <div>
                      <p className="mod-item__name">{m.name}</p>
                      <p className="mod-item__cat">
                        {m.category}
                        {!m.availableForPlan && (
                          <span className="mod-item__req">
                            requer plano {PLAN_LABELS[m.minPlan]}
                          </span>
                        )}
                      </p>
                    </div>
                    <Toggle
                      on={m.enabled}
                      disabled={!m.availableForPlan || busy === m.code || busy === "__plan__"}
                      onChange={() => toggle(m)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`sw${on ? " is-on" : ""}`}
    >
      <span className="sw__dot" />
    </button>
  );
}
