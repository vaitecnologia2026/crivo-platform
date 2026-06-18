"use client";

import { useEffect, useState } from "react";

/**
 * Hero rotativo (LP Print 1): dois banners de posicionamento alternando.
 * Banner 1 = posicionamento central (plataforma de inteligência organizacional
 * e liderança). Banner 2 = percepção contemporânea (riscos psicossociais,
 * cultura e liderança). Auto-avanço a cada 7s, com dots para troca manual.
 */
const BANNERS = [
  {
    eyebrow: "Inteligência Organizacional e Liderança",
    title: (
      <>
        Transformação organizacional começa pelo{" "}
        <span className="terra-text">comportamento e pelas decisões</span> da liderança.
      </>
    ),
    sub: "A CRIVO™ ajuda empresas a identificar riscos humanos e organizacionais, custos invisíveis e padrões de liderança que afetam cultura, execução e resultados — transformando diagnóstico em plano de ação, desenvolvimento e evolução sustentável.",
    micro: "Diagnosticar é o começo. Sustentar a mudança exige liderança preparada.",
  },
  {
    eyebrow: "Riscos psicossociais, cultura e liderança",
    title: (
      <>
        Riscos humanos não tratados viram <span className="terra-text">custos invisíveis</span>, conflitos e decisões
        reativas.
      </>
    ),
    sub: "A CRIVO™ ajuda empresas a mapear fatores psicossociais, pressão organizacional e padrões de liderança — conectando diagnóstico, dashboard, plano de ação e desenvolvimento da liderança.",
    micro: "O diagnóstico revela o risco. A liderança decide se ele vira mudança.",
  },
];

export function HeroBanners() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % BANNERS.length), 7000);
    return () => clearInterval(id);
  }, []);

  const b = BANNERS[active];

  return (
    <div className="hero__copy">
      <span className="eyebrow eyebrow--terra">{b.eyebrow}</span>
      <h1 className="display" key={active}>
        {b.title}
      </h1>
      <p className="hero__sub" key={`sub-${active}`}>
        {b.sub}
      </p>
      <div className="hero__ctas">
        <a href="#diagnostico" className="btn btn--terra">
          Fazer diagnóstico inicial
        </a>
        <a
          href="https://wa.me/5511918531796?text=Quero%20falar%20com%20um%20especialista%20CRIVO"
          target="_blank"
          rel="noopener"
          className="btn btn--outline-dark"
        >
          Falar com especialista
        </a>
      </div>
      <p className="hero__micro">{b.micro}</p>

      <div className="hero__dots" role="tablist" aria-label="Alternar banner do hero">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Banner ${i + 1}`}
            className={`hero__dot${i === active ? " is-active" : ""}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
