import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Soluções CRIVO — do Diagnóstico Inicial ao Advisory",
  description:
    "Diagnóstico Inicial, CRIVO Diagnóstico, Liderança, Evolução, Enterprise e Advisory — para cada momento da organização, um nível de atuação.",
};

export default function SolucoesPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Soluções &amp; Serviços</span>
          <h1 className="display h2--light">
            Para cada momento da organização, um <span className="terra-text">nível de atuação</span>.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 760 }}>
            Da entrada (NR-1 e diagnóstico inicial) à transformação cultural, governança de IA e performance —
            diagnóstico, plano de ação, desenvolvimento da liderança, app, dados e acompanhamento.
          </p>
        </div>
      </section>

      {/* ===================== SOLUÇÕES ===================== */}
      <section className="section section--light" id="solucoes">
        <div className="container">
          <span className="eyebrow">Soluções &amp; Serviços</span>
          <h2 className="h2">Para cada momento da organização, um nível de atuação.</h2>
          <p className="lede">
            A CRIVO combina diagnóstico, plano de ação, desenvolvimento da liderança, app, dados e acompanhamento para
            cada momento da organização — da entrada (NR-1 e diagnóstico inicial) à transformação cultural, governança
            de IA e performance.
          </p>

          <div className="ladder ladder--8">
            <div className="ladder__step ladder__step--free">
              <span className="ladder__tag ladder__tag--free">Grátis</span>
              <strong>Diagnóstico Inicial</strong>
              <span>Entrada · leitura preliminar</span>
            </div>
            <div className="ladder__step ladder__step--s1">
              <span className="ladder__tag">01</span>
              <strong>Diagnóstico Essencial</strong>
              <span>Pequenas empresas · AEP/PGR</span>
            </div>
            <div className="ladder__step ladder__step--s1">
              <span className="ladder__tag">02</span>
              <strong>Diagnóstico Organizacional</strong>
              <span>Campanha · dashboards · inventário</span>
            </div>
            <div className="ladder__step ladder__step--s2">
              <span className="ladder__tag">03</span>
              <strong>Liderança</strong>
              <span>Jornada · app · mentorias</span>
            </div>
            <div className="ladder__step ladder__step--s2">
              <span className="ladder__tag">04</span>
              <strong>Evolução</strong>
              <span>Mentoria &amp; governança · ciclos</span>
            </div>
            <div className="ladder__step ladder__step--s3">
              <span className="ladder__tag">05</span>
              <strong>Enterprise</strong>
              <span>Transformação organizacional</span>
            </div>
            <div className="ladder__step ladder__step--s4">
              <span className="ladder__tag">06</span>
              <strong>Advisory</strong>
              <span>Conselho C-Level</span>
            </div>
            <div className="ladder__step ladder__step--s4">
              <span className="ladder__tag">+</span>
              <strong>Projetos Especiais</strong>
              <span>Escopo customizado</span>
            </div>
          </div>

          <div className="product-grid product-grid--auto">
            <article className="product-card product-card--free">
              <span className="product-card__level">01</span>
              <h3>Diagnóstico Inicial</h3>
              <span className="product-card__tag">Leitura preliminar · gratuito</span>
              <p>
                Primeira leitura sobre riscos invisíveis, liderança e pontos de atenção. Relatório Preliminar CRIVO™ por
                e-mail em até 24h.
              </p>
              <a href="/lp#diagnostico" className="btn btn--outline-dark btn--block">
                Fazer diagnóstico inicial
              </a>
            </article>

            <article className="product-card">
              <span className="product-card__level">02</span>
              <h3>CRIVO Diagnóstico™</h3>
              <span className="product-card__tag">Diagnóstico Organizacional</span>
              <p>
                Diagnóstico oficial estruturado: fatores psicossociais, liderança, cultura, dashboard, plano de ação e
                evidências. Aplicado e gerido no Portal Executivo.
              </p>
              <a href="/lp#diagnostico" className="btn btn--outline-dark btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card">
              <span className="product-card__level">03</span>
              <h3>CRIVO Liderança</h3>
              <span className="product-card__tag">Jornada de Liderança</span>
              <p>
                Jornada aplicada à rotina: trilhas, mentorias, app (Radar da Decisão, Academia CRIVO) e desenvolvimento
                contínuo. Turmas de até 50 líderes.
              </p>
              <a href="/lp#diagnostico" className="btn btn--outline-dark btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card product-card--featured">
              <span className="badge-featured">Mais procurado</span>
              <span className="product-card__level">04</span>
              <h3>CRIVO Evolução</h3>
              <span className="product-card__tag">Mentoria &amp; Governança</span>
              <p>
                Mentoria em grupo, governança comportamental, liderança sob pressão, Radar da Decisão evolutivo e
                devolutivas estruturadas. Aprofundamento contínuo.
              </p>
              <a href="/lp#diagnostico" className="btn btn--terra btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card">
              <span className="product-card__level">05</span>
              <h3>CRIVO Enterprise</h3>
              <span className="product-card__tag">Transformação Organizacional</span>
              <p>
                Diagnóstico completo, PDCA, workshops, mentoria individual e sustentação cultural. Ideal para M&amp;A,
                profissionalização ou crescimento acelerado.
              </p>
              <a href="/lp#diagnostico" className="btn btn--outline-dark btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card">
              <span className="product-card__level">06</span>
              <h3>CRIVO Advisory</h3>
              <span className="product-card__tag">Conselho Estratégico</span>
              <p>
                Conselheiro para C-Level e fundadores. Sustentação contínua com visão de governança e sucessão.
              </p>
              <a href="/lp#diagnostico" className="btn btn--outline-dark btn--block">
                Conhecer
              </a>
            </article>
          </div>

          <div className="strategic-tags">
            <span className="strategic-tags__eyebrow">Soluções estratégicas CRIVO</span>
            <p className="strategic-tags__lede">Agendas específicas para liderança, cultura e governança.</p>
            <div className="strategic-tags__list">
              <span className="strategic-tag">Transformação Cultural</span>
              <span className="strategic-tag">Cultura Adaptável — Pessoas + IA</span>
              <span className="strategic-tag">Governança de IA e Pessoas</span>
              <span className="strategic-tag">Governança Comportamental</span>
              <span className="strategic-tag">Custos Invisíveis</span>
              <span className="strategic-tag">Palestras e Mentorias Executivas</span>
            </div>
          </div>

          <div className="lp-photo lp-photo--band lp-photo--band-light" aria-hidden="true">
            <span style={{ backgroundImage: "url('/imagens/trilha-mentoria.jpg')" }} />
          </div>

          <div className="trilha">
            <span className="trilha__eyebrow">Trilha da Liderança · base</span>
            <p className="trilha__lede">
              A liderança não recebe apenas conteúdo. Ela entra em uma jornada prática, acompanhada por app, mentoria,
              Academia CRIVO, indicadores e plano de ação.
            </p>
            <div className="trilha__grid">
              <div>
                <strong>30–50</strong>
                <span>líderes por ciclo</span>
              </div>
              <div>
                <strong>6 meses</strong>
                <span>de jornada com sustentação até 12</span>
              </div>
              <div>
                <strong>Semanal · quinzenal</strong>
                <span>encontros recorrentes</span>
              </div>
              <div>
                <strong>App + indicadores + plano</strong>
                <span>evolução acompanhada e mensurável</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== DIFERENCIAL / COMPARATIVO ===================== */}
      <section className="section section--light" id="autoridade">
        <div className="container">
          <span className="eyebrow">Diferencial CRIVO</span>
          <h2 className="h2">Uma abordagem que conecta o que muitas empresas tratam de forma fragmentada.</h2>
          <p className="lede">
            Liderança, decisão, cultura, experiência do colaborador, riscos psicossociais, inteligência organizacional,
            transformação e sustentação da performance — em um método integrado.
          </p>

          <div className="compare">
            <table className="compare__table">
              <thead>
                <tr>
                  <th>Capacidade</th>
                  <th>Soluções focadas em NR-1</th>
                  <th>Consultorias pontuais</th>
                  <th className="compare__crivo">CRIVO</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Questionário NR-1</td><td>✓</td><td>✓</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mapeamento de fatores psicossociais</td><td>parcial</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Diagnóstico organizacional estruturado</td><td>—</td><td>✓</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Plano de ação executável (PDCA)</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Dashboard executivo com evolução longitudinal</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Portal Executivo logado e seguro (LGPD)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>App CRIVO de sustentação da rotina</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Desenvolvimento e Trilha de Liderança</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Academia CRIVO (cursos, trilhas, conteúdos)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mentor CRIVO e Simulador de Decisão</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>ICD™ — Índice de Coerência Decisória (métrica proprietária)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Pocket — preparo rápido para decisões e conversas</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Leitura contínua e evolutiva por ciclos</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mentoria executiva e governança comportamental</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Conselho estratégico C-Level (Advisory)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
              </tbody>
            </table>
          </div>

          <p className="transition-quote transition-quote--light">
            &ldquo;Não tratamos apenas o risco. Atuamos na liderança que sustenta cultura, decisões e resultados.&rdquo;
          </p>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="h2 h2--light h2--center">Qual é o momento da sua organização?</h2>
          <p className="lede lede--light" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            O diagnóstico inicial gratuito indica o nível de serviço ideal — confidencial, com resposta em até 24h úteis.
          </p>
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
