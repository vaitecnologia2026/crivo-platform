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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,31,51,0.45)] p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-[560px] overflow-hidden rounded-[8px] border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg text-azul-profundo">Módulos · {tenant.name}</h2>
            <p className="mt-0.5 text-[12px] text-text-sec">
              Módulos acima do plano ficam indisponíveis.
            </p>
          </div>
          <button onClick={onClose} className="text-[13px] text-text-sec hover:underline">
            Fechar
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-4">
          {load === "loading" && <p className="py-8 text-center text-[13px] text-text-sec">Carregando…</p>}
          {load === "error" && (
            <p className="py-8 text-center text-[13px] text-text-sec">
              Não foi possível carregar os módulos.
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-[4px] border border-[rgba(196,137,74,0.4)] bg-[rgba(196,137,74,0.1)] px-3 py-2 text-[12px] text-terra-escura">
              {error}
            </div>
          )}

          {load === "ok" && (
            <>
              {/* Plano + uso */}
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4 rounded-[6px] border border-line bg-paper-dim px-4 py-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">
                    Plano
                  </span>
                  <select
                    value={plan}
                    disabled={busy === "__plan__"}
                    onChange={(e) => changePlan(e.target.value as Plan)}
                    className="rounded-[3px] border border-line bg-white px-3 py-2 text-[14px] text-text outline-none focus:border-terra disabled:opacity-50"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {usage && (
                  <div className="text-[12px] text-text-sec">
                    <span className="block text-[11px] uppercase tracking-[0.1em]">Uso · {usage.period}</span>
                    {usage.metrics.map((mt) => (
                      <span key={mt.metric} className="mr-3 inline-block">
                        {mt.metric}: <strong className="text-azul-profundo">{mt.value}</strong>
                        {mt.limit !== null ? ` / ${mt.limit}` : " / ∞"}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ul className="divide-y divide-line">
                {modules.map((m) => (
                  <li key={m.code} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium text-azul-profundo">{m.name}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-text-sec">
                        {m.category}
                        {!m.availableForPlan && (
                          <span className="ml-2 normal-case tracking-normal text-terra-escura">
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? "bg-[#2e7850]" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
