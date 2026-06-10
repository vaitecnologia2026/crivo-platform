"use client";

import { useEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createLogger } from "@crivo/ui/logger";
import type { LoginResponse } from "@crivo/types";
import { apiFetch, getMyModules, getMyPermissions, setToken, clearToken } from "@/lib/api";
import { DashboardScreen } from "./DashboardScreen";
import { IcdScreen } from "./IcdScreen";
import { CrmScreen } from "./CrmScreen";
import { QuestionarioScreen } from "./QuestionarioScreen";
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

// Nav data-driven (F6): cada rota mapeia a um módulo do catálogo (F4) e,
// quando existe, à permissão de "ver" daquela área (RBAC, F3). O menu esconde
// o que a empresa não tem no plano (módulo) E o que o papel não pode ver
// (permissão). A autorização real continua nos guards da API — menu é só UX.
// Obs.: o módulo "crm" usa permissões "leads:*"; "questionario" é aplicar ICD.
const routeAccess: Record<string, { module: string; perm?: string }> = {
  crm: { module: "crm", perm: "leads:view" },
  dashboard: { module: "dashboard" },
  icd: { module: "icd", perm: "icd:view" },
  questionario: { module: "icd", perm: "icd:submit" },
  campanhas: { module: "campanhas" },
  parecer: { module: "parecer" },
  lider: { module: "lider" },
  biblioteca: { module: "biblioteca" },
  relatorios: { module: "relatorios" },
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

    // ---------- ACESSO DO TENANT/PAPEL (nav data-driven, F6) ----------
    // null = ainda não carregado → mostra tudo (a API ainda gateia o acesso).
    let enabledModules: Set<string> | null = null;
    let permissions: Set<string> | null = null;
    const routeVisible = (route: string) => {
      const access = routeAccess[route];
      if (!access) return true; // rota sem mapeamento (ex.: links soltos)
      if (enabledModules && !enabledModules.has(access.module)) return false; // módulo/plano
      if (access.perm && permissions && !permissions.has(access.perm)) return false; // papel/RBAC
      return true;
    };

    function hideEmptyGroups() {
      const nav = document.querySelector(".sidebar__nav");
      if (!nav) return;
      const children = Array.from(nav.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        if (!children[i].classList.contains("sidebar__group")) continue;
        let anyVisible = false;
        let hasRouteItem = false;
        for (let j = i + 1; j < children.length; j++) {
          const sib = children[j];
          if (sib.classList.contains("sidebar__group")) break;
          if (!sib.classList.contains("nav-item")) continue;
          if (sib.dataset.route) {
            hasRouteItem = true;
            if (sib.style.display !== "none") anyVisible = true;
          } else {
            anyVisible = true; // item sem rota (ex.: Configurações) — sempre mantém o grupo
          }
        }
        children[i].style.display = hasRouteItem && !anyVisible ? "none" : "";
      }
    }

    function applyModuleVisibility() {
      navItems.forEach((n) => {
        const r = n.dataset.route;
        if (r) n.style.display = routeVisible(r) ? "" : "none";
      });
      hideEmptyGroups();
    }

    function setRoute(name: string) {
      if (!routeVisible(name)) name = "dashboard"; // rota sem acesso → painel
      routes.forEach((r) => r.classList.toggle("is-active", r.dataset.route === name));
      navItems.forEach((n) => n.classList.toggle("is-active", n.dataset.route === name));
      if (name === "icd") mountIsland("icd-root", <IcdScreen />); // mount lazy ao navegar
      if (name === "crm") mountIsland("crm-root", <CrmScreen />);
      if (name === "questionario") mountIsland("quiz-root", <QuestionarioScreen />);
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

    // ---------- ILHAS REACT (telas migradas para React + API) ----------
    // Cada tela migrada é um componente React montado num mount-point do shell
    // legado (#dash-root, #icd-root, …). Padrão de migração progressiva.
    const islands: Record<string, Root> = {};
    function mountIsland(id: string, node: ReactElement) {
      const host = document.getElementById(id);
      if (!host || islands[id]) return; // já montada
      islands[id] = createRoot(host);
      islands[id].render(node);
    }
    cleanups.push(() => {
      for (const id of Object.keys(islands)) {
        const r = islands[id];
        delete islands[id];
        setTimeout(() => r.unmount(), 0); // unmount diferido (evita warning em StrictMode)
      }
    });

    // ---------- LOGIN FLOW (autenticação real via API) ----------
    const loginError = document.getElementById("loginError");
    on(loginForm, "submit", async (e) => {
      e.preventDefault();
      if (!loginForm.checkValidity()) {
        loginForm.reportValidity();
        return;
      }
      const btn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      const original = btn.textContent;
      const email = (loginForm.querySelector('input[name="email"]') as HTMLInputElement | null)?.value.trim() ?? "";
      const password = (loginForm.querySelector('input[name="password"]') as HTMLInputElement | null)?.value ?? "";
      if (loginError) {
        loginError.textContent = "";
        loginError.classList.remove("is-visible");
      }
      btn.textContent = "Autenticando...";
      btn.disabled = true;
      authLog.info("autenticação iniciada");
      try {
        const r = await apiFetch<LoginResponse>(
          "/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) },
          { redirectOn401: false }, // 401 aqui = credenciais inválidas, não sessão expirada
        );
        setToken(r.token);
        login.classList.remove("is-active");
        app.classList.add("is-active");
        authLog.info(`sessão aberta · ${r.user.email} (${r.user.role})`);
        // Nav data-driven: oculta o que a empresa não tem no plano (módulo) e o
        // que o papel não pode ver (permissão). Falha-aberto se a busca falhar —
        // a API ainda gateia o acesso.
        try {
          const [mods, perms] = await Promise.all([getMyModules(), getMyPermissions()]);
          enabledModules = new Set(mods);
          permissions = new Set(perms);
          applyModuleVisibility();
          routerLog.info(`módulos: ${mods.join(", ") || "—"} · permissões: ${perms.join(", ") || "—"}`);
        } catch (err) {
          routerLog.warn("não foi possível carregar acesso do tenant/papel", err);
        }
        mountIsland("dash-root", <DashboardScreen />); // Dashboard com dados reais
        animateBars();
      } catch (err) {
        clearToken();
        authLog.warn("falha no login", err);
        if (loginError) {
          loginError.textContent =
            err instanceof Error && /credenc/i.test(err.message)
              ? "E-mail ou senha inválidos."
              : err instanceof Error
                ? err.message
                : "Não foi possível entrar agora. Tente novamente.";
          loginError.classList.add("is-visible");
        }
      } finally {
        btn.textContent = original;
        btn.disabled = false;
      }
    });

    on(logoutBtn, "click", () => {
      clearToken();
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
