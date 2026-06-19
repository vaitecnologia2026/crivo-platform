"use client";

import { useEffect } from "react";
import { createLogger } from "@crivo/ui/logger";

// Efeitos visuais da LP: nav muda no scroll e reveal-on-scroll com stagger.
// Os formulários da LP são React (DiagnosticoInicialQuiz, no modal) — não há
// captação de lead aqui. (Removido: máscara/validação e forms estáticos legados.)
export function LpEffects() {
  useEffect(() => {
    // Acesso é protegido no servidor pelo middleware (cookie httpOnly assinado).
    const log = createLogger("crivo:lp");
    const navlog = log.child("nav");
    const revlog = log.child("reveal");
    const cleanups: Array<() => void> = [];

    // ---------- Nav: muda fundo no scroll ----------
    const nav = document.getElementById("nav");
    if (nav) {
      const onScroll = () => {
        if (window.scrollY > 40) {
          nav.style.background = "rgba(11, 26, 51, 0.97)";
          nav.style.boxShadow = "0 10px 30px rgba(5, 14, 30, 0.34)";
        } else {
          nav.style.background = "rgba(13, 31, 60, 0.92)";
          nav.style.boxShadow = "none";
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    } else {
      navlog.warn("elemento #nav ausente — efeito de scroll desativado");
    }

    // ---------- Reveal-on-scroll com stagger ----------
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const revealSel = [
      ".pain-card", ".metodo-card", ".product-card", ".deliver-card", ".icd-step",
      ".frente", ".ladder__step", ".nr1-col", ".feature", ".faq details",
      ".compare", ".trilha", ".data-wall",
      ".mvv-card", ".journey-step", ".portal-feature", ".dash-card", ".app-feature", ".diag-card",
      // Seções novas (notebook, celular, ecossistema, KPIs, preview):
      ".eco-tile", ".dash-kpi", ".strategic-tag", ".laptop", ".phone",
      ".preview-report", ".app-chips li",
      // Briefing final: diagrama radial do ICD:
      ".icd-radial",
      // Print Pág. 07: portfólio de soluções + diferenciais:
      ".sol-card", ".dif-col",
    ].join(",");

    if (!reduce) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
      );
      const revealEls = document.querySelectorAll(revealSel);
      revealEls.forEach((el) => {
        el.classList.add("reveal");
        observer.observe(el);
      });
      document
        .querySelectorAll(
          ".pain-grid, .metodo-grid, .product-grid, .icd-how, .icd-delivers, .ladder, .feature-grid, .mvv, .journey, .portal-features, .dash-grid, .app-features, .diag-compare, .eco-cards, .dash-kpis, .strategic-tags__list, .app-chips, .sol-grid, .dif-grid",
        )
        .forEach((grid) => {
          Array.from(grid.children).forEach((child, i) => {
            if (child.classList.contains("reveal")) {
              (child as HTMLElement).style.transitionDelay = `${i * 0.08}s`;
            }
          });
        });
      revlog.debug(`reveal-on-scroll ativo · ${revealEls.length} elementos observados`);
      cleanups.push(() => observer.disconnect());
    } else {
      revlog.info("prefers-reduced-motion ativo — animações de reveal desativadas");
    }

    log.info("landing page inicializada");
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
