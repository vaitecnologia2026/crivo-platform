"use client";

import { useEffect } from "react";
import { createLogger } from "@crivo/ui/logger";

// Porte fiel do <script> do design-system.html: replay do desenho do Vértice,
// animação ao entrar na viewport e scrollspy da navegação lateral.
export function DsEffects() {
  useEffect(() => {
    // Guard de acesso (paridade com o estático).
    try {
      if (sessionStorage.getItem("vai_access") !== "granted") {
        location.replace("/");
        return;
      }
    } catch {
      /* sessionStorage indisponível */
    }

    const log = createLogger("crivo:ds");
    const motionLog = log.child("motion");
    const navLog = log.child("nav");
    const cleanups: Array<() => void> = [];

    // Replay do desenho do Vértice
    const replayBtn = document.getElementById("replayMotion");
    const onReplay = () => {
      const svg = document.querySelector(".ds-motion-vertice");
      if (!svg) return;
      svg.classList.remove("is-playing");
      void (svg as HTMLElement).offsetWidth; // reflow para reiniciar a animação
      svg.classList.add("is-playing");
      motionLog.debug("replay do Vértice acionado");
    };
    if (replayBtn) {
      replayBtn.addEventListener("click", onReplay);
      cleanups.push(() => replayBtn.removeEventListener("click", onReplay));
    }

    // Toca o desenho do Vértice ao entrar na viewport
    const mv = document.querySelector(".ds-motion-vertice");
    if (mv) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((x) => {
            if (x.isIntersecting) {
              x.target.classList.add("is-playing");
              motionLog.debug("Vértice entrou na viewport · animando");
            }
          });
        },
        { threshold: 0.4 },
      );
      obs.observe(mv);
      cleanups.push(() => obs.disconnect());
    }

    // Scrollspy: marca o link da seção visível como ativo
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".ds-nav__links a"));
    const sections = links
      .map((l) => document.querySelector(l.getAttribute("href") || ""))
      .filter((s): s is Element => Boolean(s));

    if (sections.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            const id = `#${en.target.id}`;
            links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === id));
            navLog.debug(`seção ativa: ${id}`);
          });
        },
        { rootMargin: "-30% 0px -60% 0px" },
      );
      sections.forEach((s) => spy.observe(s));
      cleanups.push(() => spy.disconnect());
    } else {
      navLog.warn("nenhuma seção encontrada para o scrollspy");
    }

    log.info(`design system showcase inicializado · ${sections.length} seções`);
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
