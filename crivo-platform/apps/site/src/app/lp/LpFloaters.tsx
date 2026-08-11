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
    const hero = document.querySelector(".hero");
    // Página sem Hero (legais, /design-system): o botão fica disponível direto.
    if (!hero) {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => setVisivel(!e.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(hero);
    return () => obs.disconnect();
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
