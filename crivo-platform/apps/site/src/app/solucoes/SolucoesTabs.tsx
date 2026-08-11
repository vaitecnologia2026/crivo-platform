"use client";

import { useEffect, useState } from "react";

// Telas 09–15: UMA barra de abas (01–07) com setas nas pontas; o conteúdo da
// solução ativa troca abaixo. As seções em si são server-rendered em page.tsx;
// este componente só controla qual delas fica visível (âncoras /solucoes#id
// continuam funcionando — o hash ativa a aba correspondente).
const TABS = [
  { id: "mapa-executivo", num: "01", label: "Mapa Executivo" },
  { id: "diagnostico-sol", num: "02", label: "Diagnóstico" },
  { id: "gestao-da-rotina", num: "03", label: "Gestão da Rotina" },
  { id: "lideranca", num: "04", label: "Liderança" },
  { id: "evolucao", num: "05", label: "Evolução" },
  { id: "enterprise", num: "06", label: "Enterprise" },
  { id: "advisory", num: "07", label: "Advisory" },
] as const;

const IDS = TABS.map((t) => t.id) as readonly string[];

const Chevron = ({ dir }: { dir: "l" | "r" }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d={dir === "l" ? "M14.5 6 8.5 12l6 6" : "M9.5 6l6 6-6 6"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function SolucoesTabs() {
  const [active, setActive] = useState<string>("mapa-executivo");

  // Mostra só a solução ativa. A classe (e não style.display) porque o servidor
  // já entrega .sol-pane/.is-open — assim a página abre certa antes do JS.
  useEffect(() => {
    for (const id of IDS) {
      document.getElementById(id)?.classList.toggle("is-open", id === active);
    }
  }, [active]);

  // Âncoras externas (/solucoes#lideranca) e mudanças de hash ativam a aba.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (IDS.includes(h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  // §2 — "cada opção do menu Soluções deve abrir a solução escolhida e deixá-la
  // ativa". Estando JÁ em /solucoes, o clique no submenu é navegação só de hash:
  // o App Router resolve com history.pushState, que NÃO emite `hashchange`, e o
  // componente não remonta — sem isto a URL mudava e a aba ficava na anterior.
  // O listener é em fase de captura, antes do handler do <Link>.
  useEffect(() => {
    const aoClicar = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const id = (a.getAttribute("href") || "").match(/^\/solucoes#(.+)$/)?.[1];
      if (id && IDS.includes(id)) setActive(id);
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  const idx = IDS.indexOf(active);
  const go = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="sol-tabs-wrap">
      <button
        type="button"
        className="sol-tabs__arrow"
        aria-label="Solução anterior"
        disabled={idx === 0}
        onClick={() => idx > 0 && go(IDS[idx - 1])}
      >
        <Chevron dir="l" />
      </button>
      <nav className="sol-tabs" aria-label="Soluções CRIVO™">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === active ? "is-active" : ""}
            aria-current={t.id === active ? "true" : undefined}
            onClick={() => go(t.id)}
          >
            <span className="sol-tabs__num">{t.num}</span>
            <span className="sol-tabs__label">{t.label}</span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="sol-tabs__arrow"
        aria-label="Próxima solução"
        disabled={idx === IDS.length - 1}
        onClick={() => idx < IDS.length - 1 && go(IDS[idx + 1])}
      >
        <Chevron dir="r" />
      </button>
    </div>
  );
}
