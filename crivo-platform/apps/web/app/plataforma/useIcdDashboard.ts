"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// Shape real de GET /api/icd/dashboard (verificado contra a API). Leitura
// AGREGADA: sem ranking nem dados individuais de líderes (confidencialidade).
export interface DashboardData {
  icdMedio: number | null;
  totalAvaliacoes: number;
  totalLideres: number;
  distribuicaoPadrao: Record<string, number>;
  dimensionAverages: Record<string, number>;
}

export type LoadStatus = "loading" | "error" | "ok";

/** Hook compartilhado pelas telas que consomem o dashboard de ICD. */
export function useIcdDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Refetch acionado por botão (Atualizar / Tentar novamente).
  async function refresh() {
    setStatus("loading");
    try {
      const d = await apiFetch<DashboardData>("/icd/dashboard");
      setData(d);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  // Fetch inicial: estado só muda APÓS o await (sem setState síncrono no effect).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<DashboardData>("/icd/dashboard");
        if (alive) {
          setData(d);
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

  return { data, status, refresh };
}

// Tensão dominante (4 Rs). Substitui o antigo "padrão dominante".
export const PATTERN_LABEL: Record<string, string> = {
  EQUILIBRADO: "Equilibrado",
  REATIVIDADE: "Reatividade",
  RIGIDEZ: "Rigidez",
  REPERCUSSAO: "Repercussão",
  RISCO: "Risco",
};

// As 4 dimensões do ICD — os 4 Rs.
export const DIMENSION_LABEL: Record<string, string> = {
  reatividade: "Reatividade",
  rigidez: "Rigidez",
  repercussao: "Repercussão",
  risco: "Risco",
};
