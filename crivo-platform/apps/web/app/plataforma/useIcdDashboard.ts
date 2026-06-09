"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// Shape real de GET /api/icd/dashboard (verificado contra a API).
export interface RankingRow {
  leaderId: string;
  nome: string;
  score: number;
  padraoDominante: string;
  dimensoes: Record<string, number>;
}
export interface DashboardData {
  icdMedio: number | null;
  totalAvaliacoes: number;
  totalLideres?: number;
  ranking: RankingRow[];
  distribuicaoPadrao: Record<string, number>;
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

export const PATTERN_LABEL: Record<string, string> = {
  EQUILIBRADO: "Equilibrado",
  PRESSAO: "Pressão",
  AUTOIMAGEM: "Autoimagem",
  CONFORMIDADE: "Conformidade",
  AMEACA: "Ameaça",
};

export const DIMENSION_LABEL: Record<string, string> = {
  clareza: "Clareza",
  pressao: "Pressão",
  confianca: "Confiança",
  influencia: "Influência",
  risco: "Risco/Ação",
};
