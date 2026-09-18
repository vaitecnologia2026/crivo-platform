"use client";

import { useEffect, useState } from "react";
import { getMyModules, getMyOnboardingStatus, type OnboardingStatus } from "@/lib/api";
import { IconCheck, IconCircle } from "./Icons";

interface ChecklistItem {
  key: keyof Omit<OnboardingStatus, "allDone">;
  label: string;
  hint: string;
  /** data-route a navegar (clica no item). null = sem ação inline. */
  route: string | null;
  /** Módulo que precisa estar contratado para o marco existir (undefined = sempre). */
  module?: string;
}

const ITEMS: ChecklistItem[] = [
  {
    key: "termsAccepted",
    label: "Aceitar Termos & Política (LGPD)",
    hint: "Você confirma o uso seguro dos dados.",
    route: null, // o gate aparece no 1º acesso
  },
  {
    key: "firstDecisionRegistered",
    label: "Registrar a primeira decisão",
    hint: "Anexo ICD §5 — base operacional do índice.",
    route: "lider",
    module: "icd",
  },
  {
    key: "firstPocketCompleted",
    label: "Concluir uma sessão Pocket",
    hint: "10 perguntas reflexivas nas 5 dimensões CRIVO.",
    route: "pocket",
    module: "pocket",
  },
  {
    key: "firstCampaignCreated",
    label: "Criar a primeira campanha",
    hint: "Campanhas estruturam o diagnóstico organizacional.",
    route: "campanhas",
  },
  {
    key: "firstPlanValidated",
    label: "Validar um Plano de Ação",
    hint: "Briefing §8 — responsáveis, prazos e evidências.",
    route: "relatorios",
  },
];

/**
 * #65 — Checklist de onboarding no Dashboard. Mostra os 5 marcos do
 * primeiro uso e guia o cliente. Some quando `allDone === true` (não polui
 * o Dashboard de quem já está usando). Sem modal/tour bloqueante.
 */
export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  // Marcos de ICD/Pocket só para quem contratou o módulo (homologação 17/09:
  // a empresa do Essencial via "Registrar a primeira decisão · Anexo ICD").
  // null = ainda não carregou → esconde os marcos condicionados.
  const [modules, setModules] = useState<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    getMyOnboardingStatus()
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => { if (alive) setStatus(null); }); // falha silenciosa
    getMyModules()
      .then((m) => { if (alive) setModules(new Set(m)); })
      .catch(() => { if (alive) setModules(new Set()); });
    return () => { alive = false; };
  }, []);

  if (!status || hidden) return null;
  const itens = ITEMS.filter((it) => !it.module || (modules?.has(it.module) ?? false));
  // "Tudo feito" é sobre os marcos que EXISTEM para esta empresa — o allDone
  // da API exige decisão ICD e sessão Pocket de quem não tem os módulos.
  if (itens.every((it) => status[it.key])) return null;

  function navigate(route: string) {
    // Dispara click no nav item existente — reaproveita o roteador SPA.
    const el = document.querySelector<HTMLElement>(`[data-route="${route}"]`);
    if (el) el.click();
  }

  const completed = itens.filter((i) => status[i.key]).length;

  return (
    <div className="card onboarding" style={{ marginBottom: 16 }}>
      <div className="card__head">
        <div>
          <h3>Primeiros passos no CRIVO</h3>
          <span className="card__sub">
            {completed} de {itens.length} concluídos · marque os marcos do primeiro uso.
          </span>
        </div>
        <button
          className="lib-act"
          onClick={() => setHidden(true)}
          title="Esconder até o próximo carregamento"
        >
          esconder
        </button>
      </div>

      <ul className="onboarding-list">
        {itens.map((it) => {
          const done = status[it.key];
          return (
            <li key={it.key} className={`onboarding-item ${done ? "is-done" : ""}`}>
              <span className="onboarding-check" aria-hidden="true">{done ? <IconCheck size={14} /> : <IconCircle size={14} />}</span>
              <div className="onboarding-text">
                <strong>{it.label}</strong>
                <span>{it.hint}</span>
              </div>
              {!done && it.route && (
                <button
                  className="btn btn--outline-dark btn--sm"
                  onClick={() => navigate(it.route!)}
                >
                  Ir
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
