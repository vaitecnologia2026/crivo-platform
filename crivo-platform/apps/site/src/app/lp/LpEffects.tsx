"use client";

import { useEffect } from "react";
import { createLogger } from "@crivo/ui/logger";

// Porte fiel do script.js da LP: máscara WhatsApp, e-mail corporativo, submit dos
// formulários (stub), nav no scroll e reveal-on-scroll com stagger.
export function LpEffects() {
  useEffect(() => {
    // Guard de acesso: sem token concedido, volta ao gate (paridade com o estático).
    try {
      if (sessionStorage.getItem("vai_access") !== "granted") {
        location.replace("/");
        return;
      }
    } catch {
      /* sessionStorage indisponível */
    }

    const log = createLogger("crivo:lp");
    const flog = log.child("form");
    const navlog = log.child("nav");
    const revlog = log.child("reveal");
    const cleanups: Array<() => void> = [];

    // ---------- WhatsApp mask ----------
    const wpp = document.getElementById("whatsapp") as HTMLInputElement | null;
    if (wpp) {
      const onInput = (e: Event) => {
        const t = e.target as HTMLInputElement;
        let v = t.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        else if (v.length > 0) v = `(${v}`;
        t.value = v;
      };
      wpp.addEventListener("input", onInput);
      cleanups.push(() => wpp.removeEventListener("input", onInput));
    }

    // ---------- Anti-Gmail/Hotmail em e-mail corporativo ----------
    const emailField = document.getElementById("email") as HTMLInputElement | null;
    if (emailField) {
      const onBlur = (e: Event) => {
        const t = e.target as HTMLInputElement;
        const v = t.value.toLowerCase();
        const blocked = ["@gmail.com", "@hotmail.com", "@outlook.com", "@yahoo.com", "@uol.com.br", "@bol.com.br"];
        const hit = blocked.find((d) => v.endsWith(d));
        if (hit) {
          flog.warn("e-mail não-corporativo bloqueado:", hit);
          t.setCustomValidity("Por favor, use um e-mail corporativo (com domínio da sua empresa).");
          t.reportValidity();
        } else {
          t.setCustomValidity("");
        }
      };
      emailField.addEventListener("blur", onBlur);
      cleanups.push(() => emailField.removeEventListener("blur", onBlur));
    }

    // ---------- Lead form (diagnóstico) ----------
    const form = document.getElementById("leadForm") as HTMLFormElement | null;
    const success = document.getElementById("formSuccess");
    if (form) {
      const onSubmit = (e: Event) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = "Enviando seu pré-diagnóstico...";
        btn.disabled = true;
        flog.info("pré-diagnóstico submetido", {
          empresa: (form.querySelector("#empresa") as HTMLInputElement | null)?.value,
        });
        // Stub — substituir por POST real para CRM/Endpoint
        setTimeout(() => {
          form.reset();
          btn.textContent = original;
          btn.disabled = false;
          if (success) {
            success.classList.add("is-visible");
            success.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          flog.info("lead registrado (stub) · pronto para POST ao CRM");
        }, 1200);
      };
      form.addEventListener("submit", onSubmit);
      cleanups.push(() => form.removeEventListener("submit", onSubmit));
    }

    // ---------- E-book lead magnet ----------
    const ebookForm = document.getElementById("ebookForm") as HTMLFormElement | null;
    const ebookOk = document.getElementById("ebookSuccess");
    if (ebookForm) {
      const elog = log.child("ebook");
      const onSubmit = (e: Event) => {
        e.preventDefault();
        const btn = ebookForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = "Enviando...";
        btn.disabled = true;
        elog.info("lead de e-book capturado (stub)");
        setTimeout(() => {
          ebookForm.reset();
          btn.textContent = original;
          btn.disabled = false;
          if (ebookOk) ebookOk.classList.add("is-visible");
        }, 1000);
      };
      ebookForm.addEventListener("submit", onSubmit);
      cleanups.push(() => ebookForm.removeEventListener("submit", onSubmit));
    }

    // ---------- Nav: muda fundo no scroll ----------
    const nav = document.getElementById("nav");
    if (nav) {
      const onScroll = () => {
        if (window.scrollY > 40) {
          nav.style.background = "rgba(10, 14, 26, 0.95)";
          nav.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.3)";
        } else {
          nav.style.background = "rgba(10, 14, 26, 0.85)";
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
          ".pain-grid, .metodo-grid, .product-grid, .icd-how, .icd-delivers, .ladder, .feature-grid, .mvv, .journey, .portal-features, .dash-grid, .app-features, .diag-compare",
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
