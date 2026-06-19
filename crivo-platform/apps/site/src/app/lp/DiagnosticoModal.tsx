"use client";

import { useState, useEffect, useCallback } from "react";
import { DiagnosticoInicialQuiz } from "./DiagnosticoInicialQuiz";

/**
 * Modal global do Diagnóstico Inicial.
 * Qualquer link que aponte para "#diagnostico" (botões "Fazer Diagnóstico
 * Inicial" no menu, hero, CTAs das seções e páginas) abre ESTE modal — uma
 * "tela sobre a tela" — em vez de rolar a página. O cliente preenche os dados,
 * responde e recebe o diagnóstico ali mesmo. O quiz vive só aqui (sem duplicar).
 */
export function DiagnosticoModal() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Intercepta cliques em links de diagnóstico (captura, antes do Next Link).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.endsWith("#diagnostico")) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // ESC fecha + trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="diag-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Diagnóstico Inicial CRIVO"
      onClick={close}
    >
      <div className="diag-modal__card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="diag-modal__close" onClick={close} aria-label="Fechar diagnóstico">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <DiagnosticoInicialQuiz />
      </div>
    </div>
  );
}
