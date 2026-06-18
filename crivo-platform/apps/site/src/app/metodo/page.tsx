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

      {/* ===================== MÉTODO ===================== */}
      <section className="section section--light" id="metodo">
        <div className="container">
          <span className="eyebrow">Metodologia</span>
          <h2 className="h2">Método, sustentação e inteligência organizacional contínua.</h2>
          <p className="lede">
            O Método CRIVO transforma percepção, responsabilidade, integração, valores e organização em práticas de
            liderança, decisões mais coerentes e evolução mensurável da cultura.
          </p>

          <div className="metodo-grid">
            <div className="metodo-card">
              <span className="metodo-card__letter">C</span>
              <h3>Consciência</h3>
              <p>Ler o contexto, reconhecer pressões e ampliar a clareza antes de decidir.</p>
            </div>
            <div className="metodo-card">
              <span className="metodo-card__letter">R</span>
              <h3>Responsabilidade</h3>
              <p>Assumir escolhas, consequências e compromissos de execução.</p>
            </div>
            <div className="metodo-card">
              <span className="metodo-card__letter">I</span>
              <h3>Integração</h3>
              <p>Conectar pessoas, áreas, comunicação e prioridades.</p>
            </div>
            <div className="metodo-card">
              <span className="metodo-card__letter">V</span>
              <h3>Valores</h3>
              <p>Decidir com critério, propósito e coerência cultural.</p>
            </div>
            <div className="metodo-card">
              <span className="metodo-card__letter">O</span>
              <h3>Organização</h3>
              <p>Transformar decisões em rotina, plano de ação, acompanhamento e resultado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== ICD ===================== */}
      <section className="section section--dark" id="icd">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Diferencial proprietário</span>
          <h2 className="h2 h2--light h2--center">ICD — Índice de Coerência Decisória</h2>
          <p className="lede lede--light">
            O ICD™ é uma metodologia proprietária da CRIVO para apoiar líderes na leitura da{" "}
            <strong>coerência decisória sob pressão</strong>. Não julga a decisão nem mede personalidade: mostra onde a
            decisão pode estar perdendo sustentação.
          </p>

          <div className="icd-how">
            <div className="icd-step">
              <span className="icd-step__num">8</span>
              <strong>perguntas</strong>
              <span>Aplicadas a uma decisão real, específica e recente.</span>
            </div>
            <div className="icd-step">
              <span className="icd-step__num">4</span>
              <strong>eixos</strong>
              <span>Clareza · Critério · Alinhamento · Sustentação</span>
            </div>
            <div className="icd-step">
              <span className="icd-step__num">0–100</span>
              <strong>score</strong>
              <span>Com zonas de leitura. Quanto mais alto, maior a coerência decisória.</span>
            </div>
            <div className="icd-step">
              <span className="icd-step__num">1</span>
              <strong>tensão dominante</strong>
              <span>O eixo que mais pesa na decisão sob pressão (entre os 4 eixos).</span>
            </div>
          </div>

          <div className="grid grid--3 icd-delivers">
            <div className="deliver-card">
              <span className="deliver-card__tag">Para o líder</span>
              <p>Clareza sobre o padrão que governa suas decisões — e os caminhos de desenvolvimento.</p>
            </div>
            <div className="deliver-card">
              <span className="deliver-card__tag">Para a empresa</span>
              <p>
                Leitura agregada da coerência decisória da liderança por ciclos e áreas elegíveis — com evolução no
                tempo e preservando a confidencialidade.
              </p>
            </div>
            <div className="deliver-card">
              <span className="deliver-card__tag">Para o RH</span>
              <p>Evidência de impacto e cruzamento com clima e turnover — sempre com dados agregados e protegidos.</p>
            </div>
          </div>

          {/* Diagrama radial do ICD — índice central + 4 eixos. */}
          <div
            className="icd-radial"
            role="img"
            aria-label="Diagrama do ICD: índice central de Coerência Decisória com quatro eixos — Clareza, Critério, Alinhamento e Sustentação"
          >
            <svg className="icd-radial__lines" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <circle cx="200" cy="200" r="150" className="icd-radial__ring" />
              <line x1="200" y1="200" x2="200" y2="58" />
              <line x1="200" y1="200" x2="342" y2="200" />
              <line x1="200" y1="200" x2="200" y2="342" />
              <line x1="200" y1="200" x2="58" y2="200" />
            </svg>
            <span className="icd-radial__core">
              <strong>ICD</strong>
              <em>Coerência Decisória</em>
            </span>
            <span className="icd-radial__node icd-radial__node--t">
              <b>Clareza</b>
              <i>do que se decide</i>
            </span>
            <span className="icd-radial__node icd-radial__node--r">
              <b>Critério</b>
              <i>como se decide</i>
            </span>
            <span className="icd-radial__node icd-radial__node--b">
              <b>Alinhamento</b>
              <i>com quem se decide</i>
            </span>
            <span className="icd-radial__node icd-radial__node--l">
              <b>Sustentação</b>
              <i>depois de decidir</i>
            </span>
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
