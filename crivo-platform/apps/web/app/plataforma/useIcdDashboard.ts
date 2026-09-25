"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { CompanyQuarterlyIcdData, IcdCycleData } from "@crivo/types";

// /icd e /icd-cycles passaram a exigir o módulo "icd" (ModuleGuard). O
// Dashboard é do módulo "dashboard" e continua visível sem ele — então o 403
// do gate NÃO é falha: é "módulo não contratado", e a tela mostra o estado
// vazio em vez de "não foi possível carregar".
const moduloDesligado = (err: unknown) => err instanceof ApiError && err.status === 403;

export type LoadStatus = "loading" | "error" | "ok";

// O ICD é só os 4 Eixos (decisão do cliente). O hook do modelo anterior
// (GET /icd/dashboard) saiu: nenhuma tela o consome mais. A rota da API e os
// dados no banco continuam — apenas não são exibidos.

// ── 4 EIXOS (modelo OFICIAL) — GET /api/icd-cycles/current ────────────────
// O ICD oficial usa os 4 Eixos (Clareza/Critério/Alinhamento/Sustentação),
// agregados pelo ciclo trimestral ABERTO (peso por impacto + supressão <5,
// tudo computado server-side). `cycle` é null quando não há ciclo aberto.
export interface IcdAxesData {
  cycle: IcdCycleData | null;
  company: CompanyQuarterlyIcdData | null;
}

export function useIcdAxes() {
  const [data, setData] = useState<IcdAxesData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Refetch acionado por botão (Atualizar / Tentar novamente).
  async function refresh() {
    setStatus("loading");
    try {
      const d = await apiFetch<IcdAxesData>("/icd-cycles/current");
      setData(d);
      setStatus("ok");
    } catch (err) {
      if (moduloDesligado(err)) { setData(null); setStatus("ok"); return; }
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<IcdAxesData>("/icd-cycles/current");
        if (alive) {
          setData(d);
          setStatus("ok");
        }
      } catch (err) {
        if (!alive) return;
        // Sem módulo "icd": status ok e data null → a tela explica, sem alarme.
        if (moduloDesligado(err)) { setData(null); setStatus("ok"); return; }
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { data, status, refresh };
}
