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

  // Conta ESCOLHAS DE SOLUÇÃO — por âncora (card da home, submenu, link
  // externo), por clique numa aba ou pelas setas. Em todos os casos a tela é
  // reposicionada para caber a solução inteira.
  //
  // É um contador, e não uma marca de sim/não, por um motivo concreto: escolher
  // a solução que JÁ está aberta não muda `active`, o React não re-renderiza e
  // um efeito preso a `[active]` nunca rodaria — clicar na aba da solução aberta
  // deixaria de trazê-la para a tela, e a marca ficaria ligada esperando a
  // próxima troca, provocando um salto fora de hora. O contador sempre muda.
  //
  // Começa em zero e o efeito ignora o zero: entrar em /solucoes pelo menu, pelo
  // rodapé ou pela URL, sem âncora, continua abrindo a página pela introdução.
  const [pedido, setPedido] = useState(0);

  // Único caminho para escolher uma solução — nada chama setActive direto.
  const escolher = (id: string) => {
    setActive(id);
    setPedido((n) => n + 1);
  };

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
      if (IDS.includes(h)) escolher(h);
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
      if (id && IDS.includes(id)) escolher(id);
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  // Escolher uma solução precisa MOSTRAR a solução inteira. Sem reposicionar, o
  // cabeçalho da seção (eyebrow + título + lede + arte) ocupa ~470px e a barra
  // de abas mais ~90px: o painel começaria a ~587px do topo e sobraria menos de
  // 100px dele na tela — a informação apareceria partida em duas rolagens.
  //
  // O alvo da rolagem depende da altura da janela, e a regra é uma só: MOSTRAR
  // AS ABAS SEMPRE QUE ELAS COUBEREM JUNTO COM O PAINEL; quando não couberem, a
  // tela inteira vai para o painel. Assim a navegação nunca come o espaço da
  // informação — que é o que foi pedido — e em telas normais a barra de abas
  // continua visível. Para dimensionar: com as abas no topo a janela precisa de
  // 719px (Evolução) a 905px (Diagnóstico); com o painel encostado no topo, de
  // 609px a 795px.
  //
  // Este efeito é declarado DEPOIS do que abre o painel, então roda depois dele:
  // quando a rolagem é calculada, a altura do painel já é a definitiva. Os dois
  // quadros de espera existem porque o App Router também mexe na rolagem ao
  // resolver o hash — sem eles, a rolagem dele sobrescreveria esta.
  useEffect(() => {
    if (pedido === 0) return;
    const abas = document.querySelector(".sol-tabs-wrap");
    const painel = document.getElementById(active);
    if (!abas || !painel) return;
    let q2 = 0;
    const q1 = requestAnimationFrame(() => {
      q2 = requestAnimationFrame(() => {
        // 80px é o `scroll-padding-top` do html (lp.css), que já desconta o
        // header fixo: é onde o topo do elemento escolhido vai parar.
        const TOPO = 80;
        const comAbas =
          painel.getBoundingClientRect().bottom - abas.getBoundingClientRect().top + TOPO;
        const alvo = comAbas <= window.innerHeight ? abas : painel;
        alvo.scrollIntoView({ block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(q1);
      cancelAnimationFrame(q2);
    };
  }, [pedido, active]);

  const idx = IDS.indexOf(active);
  const go = (id: string) => {
    // Clicar numa aba (ou nas setas) também reposiciona: se a pessoa estiver
    // lendo o fim de uma solução e trocar para outra, sem isto a solução nova
    // abriria com o começo dela acima da dobra. Quando a barra de abas já está
    // no lugar, o reposicionamento não move nada — o salto só acontece quando
    // de fato havia rolagem a corrigir.
    escolher(id);
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
