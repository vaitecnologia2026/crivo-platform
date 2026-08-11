"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Seals } from "../_site/icons";

/**
 * §3 — Hero 1 e Hero 2 como TELAS TRANSITÓRIAS do mesmo componente, não duas
 * seções empilhadas. A transição é discreta (cross-fade), automática e também
 * manual (os dois indicadores). Sem cards dentro dos Heroes: os quatro cards de
 * Método, ICD, Governança de IA e Diagnósticos saíram daqui — o conteúdo segue
 * no site, em Arquitetura CRIVO, Futuro do Trabalho/IA e Soluções.
 *
 * As duas telas ficam no HTML (fade por opacidade), não são montadas e
 * desmontadas: assim o texto do Hero 2 existe para leitores e buscadores. A
 * inativa usa `visibility: hidden`, que a tira da ordem de tabulação e da
 * árvore de acessibilidade — sem precisar de aria-hidden sobre botões.
 */

const TROCA_MS = 7000; // tempo de cada tela
const SLIDES = [
  {
    id: "hero-1",
    foto: "/imagens/hero-noturno.jpg",
    alt: "Executivos observando o skyline da cidade ao anoitecer",
    eyebrow: "Transformação Organizacional · Liderança · Governança",
    titulo: (
      <>
        Decidir com <span className="terra-text">clareza</span>.<br />
        Liderar com <span className="terra-text">coerência</span>.<br />
        Evoluir com <span className="terra-text">sustentação</span>.
      </>
    ),
    sub: "Para empresas que querem converter estratégia em execução, liderança em coerência e cultura em resultados, com Método CRIVO™, dados e evidências.",
  },
  {
    id: "hero-2",
    foto: "/imagens/hero-executivos.jpg",
    alt: "Equipe executiva caminhando pelo corredor de um escritório corporativo",
    eyebrow: "Estratégia · Decisão · Execução",
    titulo: (
      <>
        Entre a estratégia e o resultado, existe a{" "}
        <span className="terra-text">qualidade das decisões</span> e da{" "}
        <span className="terra-text">execução</span>.
      </>
    ),
    sub: "A CRIVO transforma organizações fortalecendo quem decide, quem mobiliza pessoas e quem faz a estratégia acontecer.",
  },
];

export function HeroCarousel() {
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);
  const secao = useRef<HTMLElement | null>(null);

  const ir = useCallback((i: number) => setAtual(((i % SLIDES.length) + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    // Quem pediu menos movimento no sistema não recebe rotação automática.
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento || parado) return;
    const t = setInterval(() => setAtual((i) => (i + 1) % SLIDES.length), TROCA_MS);
    return () => clearInterval(t);
  }, [parado]);

  // Pausa enquanto o mouse está sobre o Hero ou o foco está dentro dele —
  // trocar a tela debaixo de quem está lendo ou tabulando é hostil.
  useEffect(() => {
    const el = secao.current;
    if (!el) return;
    const parar = () => setParado(true);
    const seguir = () => setParado(false);
    el.addEventListener("mouseenter", parar);
    el.addEventListener("mouseleave", seguir);
    el.addEventListener("focusin", parar);
    el.addEventListener("focusout", seguir);
    return () => {
      el.removeEventListener("mouseenter", parar);
      el.removeEventListener("mouseleave", seguir);
      el.removeEventListener("focusin", parar);
      el.removeEventListener("focusout", seguir);
    };
  }, []);

  return (
    <section
      id="hero"
      ref={secao}
      className="hero hero--home section--dark"
      aria-roledescription="carrossel"
      aria-label="Apresentação da CRIVO"
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`hero__bleed hero__bleed--fade${i === atual ? " is-on" : ""}`}
          style={{ backgroundImage: `url('${s.foto}')` }}
          role="img"
          aria-label={s.alt}
          // A foto inativa some por opacidade, não por visibility — sem isto o
          // leitor de tela anunciaria as duas descrições ao mesmo tempo.
          aria-hidden={i !== atual}
        />
      ))}

      <div className="container hero__inner">
        <div className="hero__deck">
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className={`hero__copy hero__slide${i === atual ? " is-on" : ""}`}
              role="group"
              aria-roledescription="tela"
              aria-label={`Tela ${i + 1} de ${SLIDES.length}`}
            >
              <span className="eyebrow eyebrow--terra">{s.eyebrow}</span>
              {i === 0 ? (
                <h1 className="display">{s.titulo}</h1>
              ) : (
                <h2 className="display">{s.titulo}</h2>
              )}
              <span className="rule-terra" aria-hidden="true" />
              <p className="hero__sub">{s.sub}</p>
              <div className="hero__ctas">
                <a href="#diagnostico" className="btn btn--terra">
                  Gerar MAPA Executivo →
                </a>
                {/* §3 — o segundo botão existe só no Hero 1 e desce para a
                    Jornada/Soluções na própria Home. */}
                {i === 0 && (
                  <a href="#solucoes" className="btn btn--ghost">
                    Como a CRIVO atua →
                  </a>
                )}
              </div>
              {i === 0 && <Seals dark items={["Sem custo", "Confidencial", "Leitura executiva inicial"]} />}
            </div>
          ))}
        </div>
      </div>

      <div className="container hero__ctrl-wrap">
        <div className="hero__ctrl" role="group" aria-label="Escolher tela do Hero">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`hero__dot${i === atual ? " is-on" : ""}`}
              aria-label={`Ir para a tela ${i + 1} de ${SLIDES.length}`}
              aria-current={i === atual ? "true" : undefined}
              onClick={() => ir(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
