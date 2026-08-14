"use client";

import { useEffect, useState } from "react";

/**
 * Flutuante do site: o botão "Gerar MAPA Executivo" (abre o modal via
 * #diagnostico).
 *
 * §12 — ele só aparece DEPOIS que o primeiro Hero sai da tela. Antes disso a
 * dobra já tem o mesmo CTA em destaque, e o botão flutuante só competiria com
 * ele e cobriria conteúdo no celular.
 *
 * O popup de "prova social" que existia aqui foi REMOVIDO: ele sorteava nome,
 * empresa e horário e apresentava isso como atividade real de outras pessoas.
 * Prova social só vale com fato verdadeiro — quando houver números reais de
 * MAPAs gerados, entram como dado agregado, não como pessoas inventadas.
 */
export function LpFloaters() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Limite = altura do Hero quando existe (Home, /metodo, /conteudos); nas
    // páginas sem .hero, uma tela cheia. Medir pela rolagem em vez de observar
    // a seção: em /solucoes a primeira <section> envolve as sete soluções e
    // continuaria visível página adentro — o botão nunca apareceria.
    const hero = document.querySelector<HTMLElement>(".hero");
    const limite = () => (hero ? hero.offsetHeight : window.innerHeight) * 0.9;
    // §12 — e ele tambem SOME ao chegar no rodape. No mobile o botao vira uma
    // barra de largura total (left/right: 12px) e cobria a linha de copyright.
    // ZONA_DO_BOTAO e a faixa que ele ocupa na base da tela (altura + respiro);
    // quando o topo do rodape entra nessa faixa, o botao sai.
    const ZONA_DO_BOTAO = 96;
    const rodape = document.querySelector<HTMLElement>("footer");
    const aoRolar = () => {
      const passouOHero = window.scrollY > limite();
      const topoDoRodape = rodape ? rodape.getBoundingClientRect().top : Infinity;
      setVisivel(passouOHero && topoDoRodape > window.innerHeight - ZONA_DO_BOTAO);
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  if (!visivel) return null;

  return (
    <a href="#diagnostico" className="float-cta" aria-label="Gerar MAPA Executivo">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Gerar MAPA Executivo</span>
    </a>
  );
}
