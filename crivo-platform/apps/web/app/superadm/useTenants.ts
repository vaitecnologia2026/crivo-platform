"use client";

import { useCallback, useEffect, useState } from "react";
import {
  activateTenant,
  createTenant,
  deleteTenant,
  listTenants,
  suspendTenant,
} from "@/lib/admin-api";
import type { CreateTenantRequest, ProvisionResult, TenantSummary } from "@crivo/types";

export type LoadStatus = "loading" | "error" | "ok";

/** Estado e mutações da lista de empresas-cliente (control plane). */
export function useTenants() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      setTenants(await listTenants());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listTenants();
        if (alive) {
          setTenants(rows);
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Mutações: aplicam a atualização e refletem na lista sem recarregar tudo.
  const provision = useCallback(async (dto: CreateTenantRequest): Promise<ProvisionResult> => {
    const result = await createTenant(dto);
    setTenants((prev) => [result.tenant, ...prev]);
    return result;
  }, []);

  const setStatusOf = useCallback(
    async (id: string, action: "suspend" | "activate" | "delete") => {
      const fn =
        action === "suspend" ? suspendTenant : action === "activate" ? activateTenant : deleteTenant;
      const updated = await fn(id);
      setTenants((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    [],
  );

  /** Reflete na lista uma empresa atualizada por fora (ex.: troca de plano). */
  const applyTenant = useCallback((updated: TenantSummary) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  return { tenants, status, refresh, provision, setStatusOf, applyTenant };
}
