import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { PLATAFORMA_URL, WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Método CRIVO + ICD — Índice de Coerência Decisória",
  description:
    "O Método CRIVO (C-R-I-V-O) e o ICD™ — leitura proprietária da coerência decisória sob pressão, nos eixos Clareza, Critério, Alinhamento e Sustentação.",
};

export default function MetodoPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Método CRIVO</span>
          <h1 className="display h2--light">
            Um método para <span className="terra-text">decidir, sustentar e evoluir</span>.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 760 }}>
            Percepção, decisão, rotina, plano de ação, evidências e evolução mensurável — a estrutura C-R-I-V-O e o ICD™,
            a leitura proprietária da coerência decisória da liderança.
          </p>
        </div>
      </section>

      {/* ===================== MÉTODO (print Pág. 05) ===================== */}
      <section className="section section--light" id="metodo">
        <div className="container">
          <span className="eyebrow">Metodologia</span>
          <h2 className="h2">Método CRIVO: clareza para decidir, sustentar e evoluir.</h2>
          <p className="lede">
            O CRIVO traduz percepção, responsabilidade, integração, valores e organização em prática de liderança,
            qualidade de decisão e evolução cultural mensurável.
          </p>

          {/* 5 etapas C-R-I-V-O conectadas (círculo-letra + ícone no rodapé) */}
          <div className="crivo-flow">
            <article className="crivo-step">
              <span className="crivo-step__letter">C</span>
              <h3>Consciência</h3>
              <p>Ler o contexto e reconhecer pressões para ampliar a clareza antes de decidir.</p>
              <span className="crivo-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
              </span>
            </article>
            <article className="crivo-step">
              <span className="crivo-step__letter">R</span>
              <h3>Responsabilidade</h3>
              <p>Assumir escolhas, consequências e compromissos de execução.</p>
              <span className="crivo-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </span>
            </article>
            <article className="crivo-step">
              <span className="crivo-step__letter">I</span>
              <h3>Integração</h3>
              <p>Conectar pessoas, áreas, comunicação e prioridades com alinhamento.</p>
              <span className="crivo-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 18c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.5" /><path d="M16.5 13c2.2.3 4 2.1 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
            </article>
            <article className="crivo-step">
              <span className="crivo-step__letter">V</span>
              <h3>Valores</h3>
              <p>Decidir com critério, propósito e coerência cultural.</p>
              <span className="crivo-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </span>
            </article>
            <article className="crivo-step">
              <span className="crivo-step__letter">O</span>
              <h3>Organização</h3>
              <p>Transformar decisões em rotina, plano de ação, acompanhamento e resultado.</p>
              <span className="crivo-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M10 5h10M10 12h10M10 19h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M4 5l1.4 1.4L8 4M4 12l1.4 1.4L8 11M4 19l1.4 1.4L8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </article>
          </div>

          {/* DO MÉTODO À EVOLUÇÃO — ciclo contínuo */}
          <div className="metodo-cycle">
            <span className="metodo-cycle__h">Do método à evolução</span>
            <div className="metodo-cycle__steps">
              <div className="cycle-step">
                <span className="cycle-step__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.5" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
                <strong>Qualidade de decisão</strong>
              </div>
              <span className="cycle-arrow" aria-hidden="true">→</span>
              <div className="cycle-step">
                <span className="cycle-step__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M9 4V3h6v1M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
                <strong>Plano de ação</strong>
              </div>
              <span className="cycle-arrow" aria-hidden="true">→</span>
              <div className="cycle-step">
                <span className="cycle-step__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
                <strong>Rotina e execução</strong>
              </div>
              <span className="cycle-arrow" aria-hidden="true">→</span>
              <div className="cycle-step">
                <span className="cycle-step__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <strong>Evolução mensurável</strong>
              </div>
            </div>
            <p className="metodo-cycle__foot">
              Um ciclo contínuo que fortalece a liderança, sustenta a cultura e gera resultados.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== ICD (print Pág. 06) ===================== */}
      <section className="section section--dark" id="icd">
        <div className="container">
          <div className="icd-pro-grid">
            <div className="icd-pro-txt">
              <span className="eyebrow eyebrow--terra">Diferencial proprietário</span>
              <h2 className="h2 h2--light">ICD — Índice de Coerência Decisória</h2>
              <p className="lede lede--light">
                O ICD™ é uma leitura proprietária da CRIVO que apoia líderes na identificação de onde a qualidade da{" "}
                <strong>decisão</strong> pode estar perdendo sustentação sob pressão — sem expor toda a metodologia que
                gera essa leitura.
              </p>
            </div>

            {/* Radial proprietário: índice central + 4 eixos icônicos */}
            <div className="icd-pro" role="img" aria-label="Diagrama do ICD: quatro eixos — Clareza, Critério, Alinhamento e Sustentação ao redor do índice central">
              <svg className="icd-pro__lines" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <circle cx="200" cy="200" r="150" className="icd-pro__ring" />
                <line x1="200" y1="200" x2="200" y2="62" />
                <line x1="200" y1="200" x2="62" y2="200" />
                <line x1="200" y1="200" x2="338" y2="200" />
                <line x1="200" y1="200" x2="200" y2="338" />
              </svg>
              <div className="icd-pro__core">
                <strong>ICD</strong>
                <em>Coerência Decisória</em>
              </div>
              <div className="icd-axis icd-axis--top">
                <span className="icd-axis__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.1 1.4 1.2 2.4h5.2c.1-1 .5-1.8 1.2-2.4A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </span>
                <strong>Clareza</strong>
                <p>Quanto a decisão está clara em sua intenção e direção.</p>
              </div>
              <div className="icd-axis icd-axis--left">
                <span className="icd-axis__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M6 21h12M5 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M5 7l-2.3 5.4a2.8 2.8 0 0 0 4.6 0L5 7ZM19 7l-2.3 5.4a2.8 2.8 0 0 0 4.6 0L19 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </span>
                <strong>Critério</strong>
                <p>Qualidade do raciocínio e dos critérios que fundamentam a decisão.</p>
              </div>
              <div className="icd-axis icd-axis--right">
                <span className="icd-axis__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="17" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.5" /><path d="M16.5 12c2.2.3 4 2.1 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
                <strong>Alinhamento</strong>
                <p>Grau de coerência com pessoas, contexto e expectativas.</p>
              </div>
              <div className="icd-axis icd-axis--bottom">
                <span className="icd-axis__ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </span>
                <strong>Sustentação</strong>
                <p>Capacidade da decisão de se manter firme no tempo, com evidências e preparo.</p>
              </div>
            </div>
          </div>

          <div className="grid grid--3 icd-delivers">
            <div className="deliver-card">
              <span className="deliver-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 18h16M5 18l-1.2-9 4.2 3.2L12 5l4 7.2L20.2 9 19 18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
              </span>
              <span className="deliver-card__tag">Para a liderança</span>
              <p>Clareza sobre o que sustenta — ou fragiliza — suas decisões e caminhos objetivos de desenvolvimento.</p>
            </div>
            <div className="deliver-card">
              <span className="deliver-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <span className="deliver-card__tag">Para a empresa</span>
              <p>
                Leitura agregada da coerência decisória da liderança por ciclos e áreas elegíveis, com evolução no
                tempo e preservando a confidencialidade.
              </p>
            </div>
            <div className="deliver-card">
              <span className="deliver-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="17" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.5" /><path d="M16.5 12c2.2.3 4 2.1 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <span className="deliver-card__tag">Para o RH</span>
              <p>Evidência de impacto e cruzamento com clima e turnover — sempre com dados agregados e protegidos.</p>
            </div>
          </div>

          <div className="cta-inline">
            <a href={PLATAFORMA_URL} className="btn btn--terra">
              Conhecer o Radar da Decisão →
            </a>
          </div>
        </div>
      </section>

      {/* ===================== JORNADA ===================== */}
      <section className="section section--light" id="jornada">
        <div className="container">
          <span className="eyebrow">A jornada CRIVO</span>
          <h2 className="h2">Do diagnóstico à sustentação da mudança.</h2>
          <p className="lede">
            Uma jornada de transformação clara: leitura inicial, diagnóstico, dashboard, plano de ação, desenvolvimento
            da liderança e evolução contínua — no Portal Executivo e no app CRIVO. O diagnóstico mostra onde atuar; a
            liderança sustenta a mudança na rotina.
          </p>

          <ol className="journey">
            <li className="journey-step">
              <span className="journey-step__num">01</span>
              <strong>E-book</strong>
              <span>Material técnico de entrada sobre NR-1 e liderança.</span>
            </li>
            <li className="journey-step">
              <span className="journey-step__num">02</span>
              <strong>Diagnóstico inicial</strong>
              <span>Leitura preliminar gratuita do risco decisório.</span>
            </li>
            <li className="journey-step">
              <span className="journey-step__num">03</span>
              <strong>Conversa estratégica</strong>
              <span>Análise com um especialista CRIVO.</span>
            </li>
            <li className="journey-step">
              <span className="journey-step__num">04</span>
              <strong>Diagnóstico contratado</strong>
              <span>Diagnóstico completo e oficial da organização.</span>
            </li>
            <li className="journey-step journey-step--hl">
              <span className="journey-step__num">05</span>
              <strong>Portal Executivo</strong>
              <span>Acesso logado para gerir o diagnóstico.</span>
            </li>
            <li className="journey-step journey-step--hl">
              <span className="journey-step__num">06</span>
              <strong>Dashboard</strong>
              <span>ICD, indicadores e mapa de riscos em tempo real.</span>
            </li>
            <li className="journey-step">
              <span className="journey-step__num">07</span>
              <strong>Plano de ação</strong>
              <span>Estratégia com método, prioridade e prazo.</span>
            </li>
            <li className="journey-step journey-step--hl">
              <span className="journey-step__num">08</span>
              <strong>App CRIVO</strong>
              <span>Transformação na rotina dos líderes.</span>
            </li>
            <li className="journey-step">
              <span className="journey-step__num">09</span>
              <strong>Acompanhamento</strong>
              <span>Leitura evolutiva e desenvolvimento contínuo.</span>
            </li>
          </ol>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="h2 h2--light h2--center">Pronto para ler a coerência decisória da sua liderança?</h2>
          <div className="hero__ctas" style={{ justifyContent: "center" }}>
            <a href="/lp#diagnostico" className="btn btn--terra">
              Fazer Diagnóstico Inicial
            </a>
            <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--ghost">
              Falar com Especialista
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
