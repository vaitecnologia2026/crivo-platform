"use client";

import { useEffect } from "react";
import { createLogger } from "@crivo/ui/logger";
import { PLATFORM_MARKUP } from "./markup";

// Porte fiel do protótipo CRIVO-PLATAFORMA: o markup original é renderizado e a
// interatividade do app.js (login, router SPA, likert, quiz, chat, animações de
// barras) é portada para este efeito. Telas serão progressivamente ligadas à API.
const routeMeta: Record<string, { path: string; current: string }> = {
  crm: { path: "Comercial", current: "Pipeline de Leads" },
  dashboard: { path: "Dashboard", current: "Visão Executiva" },
  icd: { path: "Indicadores", current: "Índice de Coerência (ICD)" },
  campanhas: { path: "Diagnóstico", current: "Campanhas NR-1" },
  parecer: { path: "Diagnóstico", current: "Parecer Consultivo CRIVO" },
  questionario: { path: "Aplicação", current: "Questionário NR-1" },
  lider: { path: "Desenvolvimento", current: "Área do Líder" },
  biblioteca: { path: "Desenvolvimento", current: "Biblioteca & Formação" },
  relatorios: { path: "Documentos", current: "Relatórios & Comunicações" },
};

export function Plataforma() {
  useEffect(() => {
    const log = createLogger("crivo:plataforma");
    const authLog = log.child("auth");
    const routerLog = log.child("router");
    const quizLog = log.child("quiz");
    const chatLog = log.child("chat");
    const cleanups: Array<() => void> = [];
    const on = (el: Element | Window | null, ev: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      if (!el) return;
      el.addEventListener(ev, fn, opts);
      cleanups.push(() => el.removeEventListener(ev, fn, opts));
    };

    const login = document.getElementById("login");
    const app = document.getElementById("app");
    const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
    const logoutBtn = document.getElementById("logoutBtn");
    if (!login || !app || !loginForm || !logoutBtn) {
      log.error("estrutura da plataforma incompleta");
      return;
    }

    // ---------- BAR ANIMATIONS ----------
    function animateBars() {
      document
        .querySelectorAll<HTMLElement>(
          ".route.is-active .kpi__bar > div, .route.is-active .bar__fill, .route.is-active .quiz__bar-fill",
        )
        .forEach((el) => {
          const target = el.style.width;
          el.style.width = "0%";
          requestAnimationFrame(() => setTimeout(() => (el.style.width = target), 50));
        });
    }

    // ---------- ROUTER ----------
    const routes = document.querySelectorAll<HTMLElement>(".route");
    const navItems = document.querySelectorAll<HTMLElement>(".nav-item[data-route]");
    const bcPath = document.getElementById("bcPath");
    const bcCurrent = document.getElementById("bcCurrent");

    function setRoute(name: string) {
      routes.forEach((r) => r.classList.toggle("is-active", r.dataset.route === name));
      navItems.forEach((n) => n.classList.toggle("is-active", n.dataset.route === name));
      const meta = routeMeta[name];
      if (meta) {
        if (bcPath) bcPath.textContent = meta.path;
        if (bcCurrent) bcCurrent.textContent = meta.current;
        routerLog.info(`navegou → ${meta.path} / ${meta.current}`);
      } else {
        routerLog.warn(`rota desconhecida: ${name}`);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      animateBars();
    }

    // ---------- LOGIN FLOW ----------
    on(loginForm, "submit", (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      const original = btn.textContent;
      btn.textContent = "Autenticando...";
      btn.disabled = true;
      authLog.info("autenticação iniciada (stub)");
      setTimeout(() => {
        login.classList.remove("is-active");
        app.classList.add("is-active");
        btn.textContent = original;
        btn.disabled = false;
        authLog.info("sessão aberta · rota inicial=dashboard");
        animateBars();
      }, 700);
    });

    on(logoutBtn, "click", () => {
      app.classList.remove("is-active");
      login.classList.add("is-active");
      authLog.info("sessão encerrada");
      setRoute("dashboard");
    });

    navItems.forEach((item) =>
      on(item, "click", (e) => {
        e.preventDefault();
        if (item.dataset.route) setRoute(item.dataset.route);
      }),
    );
    document.querySelectorAll<HTMLElement>("[data-route-link]").forEach((link) =>
      on(link, "click", (e) => {
        e.preventDefault();
        if (link.dataset.routeLink) setRoute(link.dataset.routeLink);
      }),
    );

    // ---------- LIKERT ----------
    document.querySelectorAll<HTMLElement>(".likert__opt").forEach((opt) =>
      on(opt, "click", () => {
        const group = opt.parentElement;
        group?.querySelectorAll(".likert__opt").forEach((o) => o.classList.remove("is-selected"));
        opt.classList.add("is-selected");
        const radio = opt.querySelector('input[type="radio"]') as HTMLInputElement | null;
        if (radio) radio.checked = true;
      }),
    );

    // ---------- QUIZ NAV ----------
    let step = 7;
    const totalSteps = 25;
    const quizBar = document.querySelector<HTMLElement>(".quiz__bar-fill");
    const quizNum = document.querySelector(".quiz__num");
    const quizIndicator = document.querySelector(".quiz__indicator");
    const quizPrev = document.querySelector(".quiz__nav .btn--outline-dark");
    const quizNext = document.querySelector(".quiz__nav .btn--gold");
    function updateQuiz() {
      if (!quizBar) return;
      quizBar.style.width = `${(step / totalSteps) * 100}%`;
      if (quizNum) quizNum.textContent = String(step).padStart(2, "0");
      if (quizIndicator) quizIndicator.textContent = `${step} / ${totalSteps}`;
      quizLog.debug(`questionário NR-1 · passo ${step}/${totalSteps}`);
    }
    on(quizPrev, "click", () => {
      if (step > 1) {
        step--;
        updateQuiz();
      }
    });
    on(quizNext, "click", () => {
      if (step < totalSteps) {
        step++;
        updateQuiz();
      } else {
        quizLog.info(`questionário NR-1 concluído (${totalSteps} itens)`);
      }
    });

    // ---------- CHAT ----------
    const chatInput = document.querySelector<HTMLInputElement>(".chat__input input");
    const chatBtn = document.querySelector(".chat__input .btn");
    const chat = document.querySelector(".chat");
    function addUserMsg(text: string) {
      if (!chat) return;
      const m = document.createElement("div");
      m.className = "chat__msg chat__msg--user";
      const bubble = document.createElement("div");
      bubble.className = "chat__bubble";
      bubble.textContent = text;
      m.appendChild(bubble);
      const typing = chat.querySelector(".chat__msg--typing");
      if (typing) chat.insertBefore(m, typing);
      else chat.appendChild(m);
      chat.scrollTop = chat.scrollHeight;
      chatLog.debug(`mensagem do usuário enviada ao Copiloto (${text.length} chars)`);
    }
    if (chatBtn && chatInput) {
      const send = () => {
        const v = chatInput.value.trim();
        if (!v) return;
        addUserMsg(v);
        chatInput.value = "";
      };
      on(chatBtn, "click", () => send());
      on(chatInput, "keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") {
          e.preventDefault();
          send();
        }
      });
    }

    const t = setTimeout(animateBars, 300);
    cleanups.push(() => clearTimeout(t));
    log.info(`plataforma inicializada · ${routes.length} rotas registradas`);

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: PLATFORM_MARKUP }} />;
}
