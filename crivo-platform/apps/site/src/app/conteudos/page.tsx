import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { VerticeMark } from "../_site/VerticeMark";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./conteudos.css";

export const metadata: Metadata = {
  title: "Conteúdos — Centro de Inteligência CRIVO™",
  description:
    "Análises, ferramentas e materiais práticos para transformar informação em decisões mais inteligentes: Mapa Executivo CRIVO™, Newsletter, redes sociais e CRIVO Academy™.",
};

const SOCIAL = {
  // Tela 18: logos nas cores oficiais das marcas (LinkedIn azul, Instagram
  // rosa/gradiente, YouTube vermelho) — SVG de marca, não ícone de traço.
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" />
      <circle cx="7.6" cy="7.9" r="1.4" fill="#fff" />
      <path d="M6.5 10.4h2.2V18H6.5zM10.6 10.4h2.1v1.1c.5-.8 1.4-1.3 2.5-1.3 1.9 0 3 1.2 3 3.4V18H16v-3.9c0-1.2-.5-1.9-1.5-1.9s-1.7.8-1.7 2V18h-2.2z" fill="#fff" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FD9739" />
          <stop offset="0.5" stopColor="#E33E5C" />
          <stop offset="1" stopColor="#A335AF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-g)" />
      <circle cx="12" cy="12" r="4.4" stroke="#fff" strokeWidth="1.8" fill="none" />
      <circle cx="17.1" cy="6.9" r="1.2" fill="#fff" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="4.5" width="21" height="15" rx="4" fill="#FF0000" />
      <path d="M10.2 9v6l5.2-3-5.2-3z" fill="#fff" />
    </svg>
  ),
};

export default function ConteudosPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ HERO — Centro de Inteligência CRIVO™ (tela 18) ============ */}
      <section id="conteudos" className="hero hero--2 section--dark">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Centro de Inteligência CRIVO™</span>
            <h1 className="display">
              Conteúdo que
              <br />
              transforma informação
              <br />
              em <span className="terra-text">decisão.</span>
            </h1>
            <span className="rule-terra" aria-hidden="true" />
            <p className="hero__sub" style={{ marginBottom: 8 }}>
              Análises, ferramentas e materiais práticos para transformar informação em decisões mais inteligentes.
            </p>
            {/* Tela 18: cada selo tem ícone PRÓPRIO (escudo · ciclo · estrela). */}
            <div className="seals cc-seals">
              <span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="m9 11.5 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Confidencial
              </span>
              <span>
                <i aria-hidden="true" />
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12a8 8 0 0 1 13.9-5.4M20 12a8 8 0 0 1-13.9 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Atualizado continuamente
              </span>
              <span>
                <i aria-hidden="true" />
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m12 3.5 2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.2l-5.1 2.7 1.1-5.6-4.2-3.9 5.7-.7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                Conteúdo de alto valor
              </span>
            </div>
          </div>
          <div className="hero__visual">
            <div
              className="cc-photo"
              style={{ backgroundImage: "url('/imagens/conteudos-laptop.jpg')" }}
              role="img"
              aria-label="Laptop com a marca CRIVO sobre mesa de trabalho em madeira"
            />
          </div>
        </div>

        {/* Faixa de 4 cards claros (base do hero, tela 18) */}
        <div className="container">
          <div className="strip cc-cards">
            {/* 1 — Mapa Executivo CRIVO™ (com mockup 3D do livro) */}
            <div className="strip-card cc-card--book">
              <div className="cc-book" aria-hidden="true">
                <div className="cc-book__cover">
                  <VerticeMark className="cc-book__mark" />
                  <strong>
                    MAPA
                    <br />
                    EXECUTIVO
                    <br />
                    CRIVO™
                  </strong>
                  <span>LIDERANÇA • CULTURA</span>
                  <span>ROTINA • RISCOS</span>
                  <span>FATORES PSICOSSOCIAIS</span>
                </div>
              </div>
              <span className="strip-card__ic">{IC.livro}</span>
              <strong>Mapa Executivo CRIVO™</strong>
              <p>
                Receba o Mapa Executivo CRIVO™ e descubra como transformar riscos invisíveis em clareza, prioridades
                e ação.
              </p>
              <a href="#diagnostico" className="btn btn--terra btn--sm cc-card__cta">
                Receber Mapa Executivo
                <br />+ e-book complementar →
              </a>
            </div>

            {/* 2 — Newsletter CRIVO™ */}
            <div className="strip-card">
              <span className="strip-card__ic">{IC.envelope}</span>
              <strong>Newsletter CRIVO™</strong>
              <p>
                Análises exclusivas, tendências e insights sobre liderança, cultura, decisão e gestão de riscos
                humanos.
              </p>
              <a
                href={WHATSAPP_ESPECIALISTA}
                target="_blank"
                rel="noopener"
                className="btn btn--terra btn--sm cc-card__cta"
              >
                Receber Insights Executivos →
              </a>
            </div>

            {/* 3 — Siga a CRIVO nas redes */}
            <div className="strip-card">
              <strong>Siga a CRIVO nas redes</strong>
              <p>
                Acompanhe conteúdos, vídeos e reflexões sobre liderança, cultura, tomada de decisão e inteligência
                organizacional.
              </p>
              <div className="cc-social">
                <a href="#" aria-label="CRIVO no LinkedIn">
                  <span className="cc-social__ic">{SOCIAL.linkedin}</span>
                  <span>LinkedIn</span>
                </a>
                <a href="#" aria-label="CRIVO no Instagram">
                  <span className="cc-social__ic">{SOCIAL.instagram}</span>
                  <span>Instagram</span>
                </a>
                <a href="#" aria-label="CRIVO no YouTube">
                  <span className="cc-social__ic">{SOCIAL.youtube}</span>
                  <span>YouTube</span>
                </a>
              </div>
            </div>

            {/* 4 — CRIVO Academy™ (EM BREVE) */}
            <div className="strip-card">
              <span className="cc-badge">Em breve</span>
              <span className="strip-card__ic">{IC.capelo}</span>
              <strong>CRIVO Academy™</strong>
              <p>
                Trilhas práticas para líderes e empresas. Conteúdos que desenvolvem competências, ampliam repertório
                e geram resultados.
              </p>
              <a
                href={WHATSAPP_ESPECIALISTA}
                target="_blank"
                rel="noopener"
                className="btn btn--outline-dark btn--sm cc-card__cta"
              >
                Entrar na lista de interesse →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ EM DESENVOLVIMENTO + CTA final (tela 18) ============ */}
      <section id="em-desenvolvimento" className="section section--light">
        <div className="container">
          <div className="cc-dev-head">
            <span className="cc-dev-head__tag">Em desenvolvimento</span>
            <span className="cc-dev-head__rule" aria-hidden="true" />
            <p>Novos formatos e conteúdos estão sendo preparados para ampliar ainda mais a sua jornada de conhecimento.</p>
          </div>

          <div className="cc-mini-grid">
            <div className="cc-mini-card">
              <span className="cc-mini-card__ic">{IC.apresentacao}</span>
              <strong>Webinars CRIVO™</strong>
              <p>Encontros online com especialistas sobre liderança, cultura, IA e o futuro do trabalho.</p>
              <span className="cc-mini-badge">Em breve</span>
            </div>
            <div className="cc-mini-card">
              <span className="cc-mini-card__ic">{IC.microfone}</span>
              <strong>Podcast CRIVO™</strong>
              <p>Conversas executivas sobre decisões, comportamento humano, gestão e transformação organizacional.</p>
              <span className="cc-mini-badge">Em breve</span>
            </div>
            <div className="cc-mini-card">
              <span className="cc-mini-card__ic">{IC.documento}</span>
              <strong>Biblioteca CRIVO™</strong>
              <p>Guias, templates, playbooks e materiais práticos para apoiar sua gestão no dia a dia.</p>
              <span className="cc-mini-badge">Em breve</span>
            </div>
            <div className="cc-mini-card">
              <span className="cc-mini-card__ic">{IC.grafico}</span>
              <strong>Estudos e Pesquisas</strong>
              <p>Análises, benchmarks e relatórios especiais sobre tendências e desafios organizacionais.</p>
              <span className="cc-mini-badge">Em breve</span>
            </div>
          </div>

          {/* Rodapé da seção — banda navy (tela 18) */}
          <div className="cta-band cta-band--split">
            <span className="cta-band__ic">{IC.cerebro}</span>
            <div className="cta-band__text">
              <div className="t">
                O Centro de Inteligência CRIVO™ faz parte do nosso compromisso com a{" "}
                <span className="terra-text">evolução contínua das empresas e das lideranças.</span>
              </div>
            </div>
            <span className="cta-band__rule" aria-hidden="true" />
            <div className="cta-band__text" style={{ textAlign: "right" }}>
              <div className="t">
                Conteúdo hoje.
                <br />
                Decisões melhores amanhã.
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
