import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { VerticeMark } from "../_site/VerticeMark";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC, Seals } from "../_site/icons";
import "../lp/lp.css";
import "./conteudos.css";

export const metadata: Metadata = {
  title: "Conteúdos — Centro de Inteligência CRIVO™",
  description:
    "Análises, ferramentas e materiais práticos para transformar informação em decisões mais inteligentes: Mapa Executivo CRIVO™, Newsletter, redes sociais e CRIVO Academy™.",
};

// Ícones de traço das redes sociais (nunca emoji, nunca logo colorido de marca —
// seguem o mesmo sistema de linha do restante do site).
const SOCIAL = {
  linkedin: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="8.3" r="1" fill="currentColor" />
      <path d="M8 11v6M12 17v-3.4c0-1.6 1.2-2.6 2.5-2.6S17 12 17 13.6V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.3 9.2v5.6l5-2.8-5-2.8z" fill="currentColor" />
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
              Conteúdo que transforma informação em <span className="terra-text">decisão.</span>
            </h1>
            <span className="rule-terra" aria-hidden="true" />
            <p className="hero__sub" style={{ marginBottom: 8 }}>
              Análises, ferramentas e materiais práticos para transformar informação em decisões mais inteligentes.
            </p>
            <Seals dark items={["Confidencial", "Atualizado continuamente", "Conteúdo de alto valor"]} />
          </div>
          <div className="hero__visual">
            <div className="laptop cc-laptop">
              <div className="laptop__screen cc-laptop__screen">
                <div className="brand">
                  <VerticeMark className="vertice" />
                  <div className="brand__text">
                    <span className="brand__name">
                      CRIVO<sup>™</sup>
                    </span>
                    <span className="brand__sub">Decision Intelligence</span>
                  </div>
                </div>
                <p className="cc-laptop__quote">
                  Clareza para decidir. Estrutura para agir.
                  <br />
                  Evidência para evoluir.
                </p>
              </div>
              <div className="laptop__base" aria-hidden="true" />
            </div>
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
