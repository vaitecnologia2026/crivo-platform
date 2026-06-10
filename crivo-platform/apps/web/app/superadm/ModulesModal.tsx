"use client";

import { useEffect, useState } from "react";
import { PLAN_LABELS, type TenantModuleSummary, type TenantSummary } from "@crivo/types";
import { listTenantModules, setTenantModule } from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";

/** Painel de módulos de uma empresa (F4): liga/desliga módulos respeitando o
 *  plano. Módulo indisponível no plano fica travado, com a dica do plano mínimo. */
export function ModulesModal({
  tenant,
  onClose,
}: {
  tenant: TenantSummary;
  onClose: () => void;
}) {
  const [modules, setModules] = useState<TenantModuleSummary[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listTenantModules(tenant.id);
        if (alive) {
          setModules(rows);
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
              Plano <strong>{PLAN_LABELS[tenant.plan]}</strong> — módulos acima dele ficam
              indisponíveis.
            </p>
          </div>
          <button onClick={onClose} className="text-[13px] text-text-sec hover:underline">
            Fechar
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
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
                    disabled={!m.availableForPlan || busy === m.code}
                    onChange={() => toggle(m)}
                  />
                </li>
              ))}
            </ul>
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
