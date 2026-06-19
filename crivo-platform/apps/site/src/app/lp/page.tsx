import type { Metadata } from "next";
import { LpEffects } from "./LpEffects";
import { DiagnosticoInicialQuiz } from "./DiagnosticoInicialQuiz";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import {
  MetodoSection,
  IcdSection,
  PortfolioSection,
  PortalSection,
  DashboardSection,
  AppSection,
  EcossistemaSection,
} from "../_sections/CrivoSections";
import "./lp.css";

export const metadata: Metadata = {
  title: "CRIVO™ — Decision Intelligence System",
  description:
    "Consultoria estratégica de transformação organizacional com tecnologia aplicada. A CRIVO™ revela sinais invisíveis, prioriza ações, desenvolve lideranças e sustenta a evolução com método, dados, plano de ação e evidências.",
};

// Home única — sequência das 16 seções (print Pág. 01: Arquitetura, menu e navegação).
// Menu por âncoras; seções pesadas vêm de _sections/CrivoSections (mesma fonte das
// páginas dedicadas /metodo /plataforma /solucoes). Alternância claro/azul premium.
export default function LandingPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== 01 · HERO 1 ===================== */}
      <section id="hero" className="hero hero--1">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="hero-badge">
              <i className="hero-badge__dot" aria-hidden="true" />
              Transformação Organizacional · Liderança · Governança
            </span>
            <h1 className="display">
              Transformação organizacional começa pela forma como a liderança{" "}
              <span className="terra-text">decide e sustenta comportamentos</span>.
            </h1>
            <p className="hero__support">
              Estratégia ganha força quando líderes transformam intenção em rotina, decisões em alinhamento e
              comportamento em cultura.
            </p>
            <p className="hero__sub">
              Somos uma consultoria estratégica de transformação organizacional com tecnologia aplicada. Ajudamos
              empresas a revelar sinais invisíveis, priorizar ações, desenvolver lideranças e sustentar evolução com
              método, dados, plano de ação e evidências.
            </p>
            <p className="hero__phrase">Decidir melhor. Sustentar melhor. Evoluir com evidência.</p>
            <div className="hero__ctas">
              <a href="#diagnostico" className="btn btn--terra">
                Fazer Diagnóstico Inicial
              </a>
              <a
                href="https://wa.me/5511918531796?text=Quero%20agendar%20uma%20conversa%20estrat%C3%A9gica%20com%20a%20CRIVO"
                target="_blank"
                rel="noopener"
                className="btn btn--outline-dark"
              >
                Agendar Conversa Estratégica
              </a>
            </div>
            <p className="hero__micro">Leitura preliminar gratuita · Confidencial · Resposta em até 24h úteis</p>
          </div>

          <div className="hero__visual">
            <figure className="hero-card">
              <span className="hero-card__tag">Inteligência Decisória</span>
              <div
                className="hero-card__photo"
                style={{ backgroundImage: "url('/imagens/hero-executivos.jpg')" }}
                role="img"
                aria-label="Equipe executiva caminhando em ambiente corporativo"
              />
              <figcaption className="hero-card__bar">
                <span className="hero-card__brand">Decision Intelligence</span>
                <span className="hero-card__meta">Liderança · cultura · performance</span>
                <span className="hero-card__live">
                  <i aria-hidden="true" /> LIVE
                </span>
              </figcaption>
            </figure>

            <div className="hero-float" aria-hidden="true">
              <span className="hero-float__label">ICD · Coerência Decisória</span>
              <div className="hero-float__row">
                <strong className="hero-float__score">78</strong>
                <span className="hero-float__of">/100</span>
                <span className="hero-float__pill">Boa</span>
              </div>
              <div className="hero-float__bar">
                <i style={{ width: "78%" }} />
              </div>
              <span className="hero-float__foot">Saúde da liderança sob pressão · +6 no ciclo</span>
            </div>
          </div>
        </div>

        <div className="container hero__trust">
          <div className="trust__item">
            <strong>ICD</strong>
            <span>Métrica proprietária CRIVO</span>
          </div>
          <div className="trust__item">
            <strong>LGPD</strong>
            <span>Dados agregados e protegidos</span>
          </div>
          <div className="trust__item">
            <strong>12 meses</strong>
            <span>Jornada completa</span>
          </div>
          <div className="trust__item">
            <strong>Evolução</strong>
            <span>Plano de ação e resultado mensurável</span>
          </div>
        </div>
      </section>

      {/* ===================== 02 · HERO 2 ===================== */}
      <section id="hero2" className="hero hero--2 section--dark">
        <div className="container hero__inner hero__inner--rev">
          <div className="hero__visual">
            <figure className="hero-card hero-card--dark">
              <span className="hero-card__tag">Decisão em ambientes complexos</span>
              <div
                className="hero-card__photo"
                style={{ backgroundImage: "url('/imagens/icd-deliberacao.jpg')" }}
                role="img"
                aria-label="Reunião executiva de liderança"
              />
              <figcaption className="hero-card__bar">
                <span className="hero-card__brand">Pessoas + IA</span>
                <span className="hero-card__meta">Cultura · tecnologia · governança</span>
                <span className="hero-card__live">
                  <i aria-hidden="true" /> CRIVO
                </span>
              </figcaption>
            </figure>
          </div>
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">
              Pessoas · Decisões · Tecnologia · Inteligência Artificial
            </span>
            <h2 className="display h2--light">
              A próxima vantagem competitiva será a <span className="terra-text">qualidade das decisões</span> em
              ambientes complexos.
            </h2>
            <p className="hero__support hero__support--light">
              Pessoas, tecnologia e Inteligência Artificial estão acelerando a gestão. A governança transforma
              velocidade em direção, dados em prioridade e mudança em evolução sustentável.
            </p>
            <p className="hero__sub hero__sub--light">
              A CRIVO™ prepara lideranças e organizações para decidir melhor em ambientes complexos, alinhando cultura,
              tecnologia, responsabilidade e execução em uma mesma agenda de evolução.
            </p>
            <p className="hero__phrase hero__phrase--light">
              Tecnologia acelera. Liderança dá direção. Governança sustenta.
            </p>
            <div className="hero__ctas">
              <a href="#solucoes" className="btn btn--terra">
                Conhecer Soluções CRIVO
              </a>
              <a
                href="https://wa.me/5511918531796?text=Quero%20falar%20com%20um%20especialista%20CRIVO"
                target="_blank"
                rel="noopener"
                className="btn btn--ghost"
              >
                Falar com Especialista
              </a>
            </div>
            <p className="hero__micro hero__micro--light">
              Para empresas que precisam transformar complexidade em clareza, prioridade e execução.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== 03 · O PROBLEMA ===================== */}
      <section className="section section--light" id="o-problema">
        <div className="container">
          <span className="eyebrow">O Problema</span>
          <h2 className="h2">Empresas crescem até o limite da sua liderança.</h2>
          <p className="lede">
            Estratégia, processo e tecnologia só geram desempenho sustentável quando a liderança sustenta decisões,
            comportamentos e execução — mesmo sob pressão.
          </p>

          <div className="pain-grid">
            <article className="pain-card">
              <span className="pain-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </span>
              <span className="pain-card__num">01</span>
              <h3>Pressão decisória</h3>
              <p>Líderes decidem sob pressão e aumentam retrabalho, conflito e inconsistência.</p>
            </article>
            <article className="pain-card">
              <span className="pain-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="pain-card__num">02</span>
              <h3>Crescimento sem sustentação</h3>
              <p>O negócio cresce mais rápido do que o sistema de liderança consegue sustentar.</p>
            </article>
            <article className="pain-card">
              <span className="pain-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c5 0 9 4.6 9 7 0 1-.8 2.3-2 3.5M6.2 6.2C3.9 7.7 3 9.7 3 12c0 .9 4 7 9 7 1.4 0 2.7-.4 3.8-1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <span className="pain-card__num">03</span>
              <h3>Custos invisíveis</h3>
              <p>Clima, turnover, burnout e atritos corroem produtividade e resultado.</p>
            </article>
            <article className="pain-card">
              <span className="pain-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </span>
              <span className="pain-card__num">04</span>
              <h3>NR-1 tornou o tema visível</h3>
              <p>Compliance é apenas a superfície de um problema organizacional mais amplo.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ===================== 04 · QUEM SOMOS ===================== */}
      <section className="section section--dark" id="quem-somos">
        <div className="container split">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">Quem somos</span>
            <h2 className="h2 h2--light">
              Consultoria estratégica de transformação organizacional por meio do desenvolvimento sustentável da
              liderança.
            </h2>
            <p className="lede lede--light">
              A CRIVO™ combina método proprietário, leitura organizacional, desenvolvimento da liderança e tecnologia
              aplicada para transformar sinais dispersos em clareza, plano de ação e evolução sustentável.
            </p>
            <blockquote className="pull-quote">
              &ldquo;A CRIVO™ transforma sinais invisíveis em clareza, liderança e evolução sustentável.&rdquo;
            </blockquote>
            <div className="cta-inline">
              <a href="/sobre" className="btn btn--terra">
                Conhecer a CRIVO · quem somos e fundadores →
              </a>
            </div>
          </div>
          <div className="split__right">
            <div className="lp-photo lp-photo--portrait" aria-hidden="true">
              <span style={{ backgroundImage: "url('/imagens/quem-somos-lideranca.jpg')" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 05 · COMO NASCEU ===================== */}
      <section className="section section--light" id="como-nasceu">
        <div className="container">
          <span className="eyebrow">Como nasceu</span>
          <h2 className="h2">Da prática executiva à inteligência aplicável.</h2>
          <p className="lede">
            A CRIVO nasceu da prática executiva e da percepção de que a qualidade das decisões sob pressão molda
            cultura, performance e resultados. Transformamos padrões invisíveis em inteligência aplicável para
            lideranças que precisam decidir melhor em contextos reais.
          </p>
          <div className="cta-inline">
            <a href="/sobre#como-nasceu" className="btn btn--outline-dark">
              Ler a história completa e conhecer os fundadores →
            </a>
          </div>
        </div>
      </section>

      {/* ===================== 06 · RISCOS PSICOSSOCIAIS E IA ===================== */}
      <section className="section section--dark" id="riscos-ia">
        <div className="container">
          <div className="riscos-head">
            <div className="riscos-head__txt">
              <span className="eyebrow eyebrow--terra">Os dois desafios da nova gestão</span>
              <h2 className="h2 h2--light">
                Riscos psicossociais e Inteligência Artificial:{" "}
                <span className="terra-text">as duas agendas que moldam a nova gestão.</span>
              </h2>
              <p className="lede lede--light">
                A pressão sobre as pessoas aumenta. A tecnologia acelera. Sustentar resultados exige liderança
                preparada, governança sólida e inteligência organizacional.
              </p>
            </div>
            <div className="venn" role="img" aria-label="Pessoas e Inteligência Artificial: duas agendas que se encontram">
              <span className="venn__glow" aria-hidden="true" />
              <svg viewBox="0 0 360 240" fill="none" aria-hidden="true">
                <circle cx="142" cy="120" r="90" className="venn__ring" />
                <circle cx="218" cy="120" r="90" className="venn__ring" />
                <g className="venn__ic" transform="translate(96,98)">
                  <circle cx="16" cy="13" r="7.5" />
                  <path d="M2 46c0-9 6.2-15 14-15s14 6 14 15" />
                </g>
                <g className="venn__ic" transform="translate(218,98)">
                  <rect x="7" y="7" width="34" height="34" rx="6" />
                  <rect x="17" y="17" width="14" height="14" rx="2" />
                  <path d="M16 3v4M24 3v4M32 3v4M16 41v4M24 41v4M32 41v4M3 16h4M3 24h4M3 32h4M41 16h4M41 24h4M41 32h4" />
                </g>
              </svg>
            </div>
          </div>

          <div className="riscos-grid">
            <article className="risco-card">
              <span className="risco-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <span className="risco-card__num">01</span>
              <h3>Pressão humana</h3>
              <p>
                Leitura profunda dos riscos psicossociais que impactam saúde, engajamento, cultura e performance:
                sobrecarga, conflitos, comunicação, segurança psicológica e fatores humanos críticos.
              </p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="5" cy="13" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="19" cy="13" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="20" r="2" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v11M11 11l-4.3 1.5M13 11l4.3 1.5M6.6 14.6 11 18.4M17.4 14.6 13 18.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </span>
              <span className="risco-card__num">02</span>
              <h3>Pessoas, IA e governança</h3>
              <p>
                Integração responsável da inteligência artificial à estratégia de pessoas, com critérios, ética,
                governança e controle de riscos.
              </p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 18c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.6" /><path d="M16.5 13c2.2.3 4 2.1 4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <span className="risco-card__num">03</span>
              <h3>Liderança e cultura</h3>
              <p>
                Desenvolvimento de líderes que sustentam decisões, conduzem conversas difíceis e constroem culturas de
                confiança, clareza e adaptação contínua.
              </p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="risco-card__num">04</span>
              <h3>Transformação organizacional</h3>
              <p>
                Conexão entre diagnóstico, governança e execução para transformar sinais em ações que geram evolução
                sustentável e vantagem competitiva.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ===================== 07 · MÉTODO · 08 · ICD · 09 · SOLUÇÕES ===================== */}
      <MetodoSection />
      <IcdSection />
      <PortfolioSection />

      {/* ===================== 10 · PORTAL · 11 · DASHBOARD · 12 · APP · 13 · ECOSSISTEMA ===================== */}
      <PortalSection />
      <DashboardSection />
      <AppSection />
      <EcossistemaSection />

      {/* ===================== NR-1 (âncora / seção específica) ===================== */}
      <section className="section section--dark" id="nr1">
        <div className="container">
          <span className="eyebrow eyebrow--terra">NR-1 · porta de entrada</span>
          <h2 className="h2 h2--light h2--center">
            A NR-1 tornou visível uma parte do desafio. A evolução acontece quando diagnóstico vira ação, evidência e
            sustentação.
          </h2>
          <p className="lede lede--light">
            A NR-1 é porta de entrada, não o limite da CRIVO. A atualização ampliou a atenção das empresas sobre fatores
            psicossociais — mas o desafio vai além da conformidade: envolve a forma como a organização lidera, decide,
            cobra, comunica e sustenta a rotina. A entrega conecta fatores psicossociais, plano de ação, responsáveis,
            prazos, evidências, liderança e acompanhamento.
          </p>

          <div className="nr1-split">
            <div className="nr1-col">
              <h4>O que está em jogo</h4>
              <ul className="nr1-list nr1-list--risk">
                <li>Compliance legal e passivo trabalhista</li>
                <li>Riscos psicossociais sistêmicos</li>
                <li>Liderança sob pressão e baixa sustentação da rotina</li>
                <li>Ambiente organizacional deteriorado</li>
                <li>Custos invisíveis não monitorados</li>
              </ul>
            </div>
            <div className="nr1-col">
              <h4>Como a CRIVO apoia</h4>
              <ul className="nr1-list nr1-list--deliver">
                <li>
                  <strong>CRIVO Diagnóstico™</strong> — diagnóstico organizacional estruturado
                </li>
                <li>
                  <strong>Pesquisa estruturada</strong> — mapeamento de ambiente e liderança
                </li>
                <li>
                  <strong>Leitura técnica</strong> — leitura sistêmica de riscos e causas
                </li>
                <li>
                  <strong>Plano de ação</strong> — estratégia com método, prioridade e prazo
                </li>
                <li>
                  <strong>Evidências e acompanhamento</strong> — monitoramento evolutivo do ambiente
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 14 · E-BOOK ===================== */}
      <section className="section section--light" id="ebook">
        <div className="container ebook">
          <div className="ebook__copy">
            <span className="eyebrow">Material gratuito</span>
            <h2 className="h2">NR-1, riscos psicossociais e liderança: o que enxergar além da conformidade.</h2>
            <p className="ebook__lede">
              Um material direto para entender como fatores psicossociais impactam cultura, liderança, execução e
              resultados — e como transformar a exigência da NR-1 em diagnóstico, evidências e plano de ação.
            </p>
            <ul className="ebook__list">
              <li>
                <span>▴</span> O que a NR-1 exige na prática sobre fatores psicossociais
              </li>
              <li>
                <span>▴</span> Como a liderança pode ampliar ou reduzir riscos na rotina
              </li>
              <li>
                <span>▴</span> Como organizar diagnóstico, evidências e plano de ação
              </li>
            </ul>
          </div>
          <form className="ebook__form" id="ebookForm">
            <div className="ebook__cover">
              <svg viewBox="0 0 48 44" fill="none" aria-hidden="true">
                <line x1="5" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="43" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="5" y1="37" x2="17" y2="37" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="31" y1="37" x2="43" y2="37" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
                <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
              </svg>
              <strong>Guia NR-1</strong>
              <em>para Lideranças · 2026</em>
            </div>
            <div className="field">
              <label htmlFor="eb-nome">Nome</label>
              <input type="text" id="eb-nome" name="nome" placeholder="Seu nome" required />
            </div>
            <div className="field">
              <label htmlFor="eb-email">E-mail corporativo</label>
              <input type="email" id="eb-email" name="email" placeholder="nome@empresa.com.br" required />
            </div>
            <button type="submit" className="btn btn--terra btn--block">
              Receber e-book gratuito →
            </button>
            <p className="form__lgpd">Sem custo · Sem spam · Dados protegidos pela LGPD</p>
            <p className="form__success" id="ebookSuccess" role="status" aria-live="polite">
              Pronto! Enviamos o guia para o seu e-mail corporativo.
            </p>
            <p className="form__error" id="ebookError" role="alert" aria-live="assertive">
              Não foi possível enviar agora. Tente novamente em instantes.
            </p>
          </form>
        </div>
      </section>

      {/* ===================== 14 · DIAGNÓSTICO INICIAL ===================== */}
      <section className="section section--accent" id="diagnostico">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Diagnóstico inicial · gratuito</span>
          <h2 className="h2 h2--light h2--center">
            Faça uma leitura preliminar dos riscos invisíveis que afetam liderança, cultura e resultados.
          </h2>
          <p className="lede lede--light" style={{ textAlign: "center", margin: "0 auto 24px" }}>
            Em poucos minutos, identifique sinais iniciais de pressão organizacional, riscos psicossociais e
            fragilidades de liderança — com devolutiva por e-mail. Não substitui o CRIVO Diagnóstico™ completo.
          </p>

          <div className="preview-report">
            <div className="preview-report__head">
              <span className="preview-report__eyebrow">Relatório Preliminar · prévia</span>
              <h3 className="preview-report__title">Leitura por bloco</h3>
              <span className="preview-report__sub">Exemplo ilustrativo · escala 0–100</span>
            </div>
            <div className="preview-report__bars">
              <div className="preview-bar">
                <div className="preview-bar__label">
                  <span>Estrutura e Rotina</span>
                  <strong>72</strong>
                </div>
                <div className="preview-bar__track">
                  <div className="preview-bar__fill" style={{ width: "72%" }} />
                </div>
              </div>
              <div className="preview-bar">
                <div className="preview-bar__label">
                  <span>Liderança e Sustentação</span>
                  <strong>58</strong>
                </div>
                <div className="preview-bar__track">
                  <div className="preview-bar__fill preview-bar__fill--warn" style={{ width: "58%" }} />
                </div>
              </div>
              <div className="preview-bar">
                <div className="preview-bar__label">
                  <span>Cultura e Segurança Psicológica</span>
                  <strong>64</strong>
                </div>
                <div className="preview-bar__track">
                  <div className="preview-bar__fill" style={{ width: "64%" }} />
                </div>
              </div>
              <div className="preview-bar">
                <div className="preview-bar__label">
                  <span>Fatores Psicossociais (NR-1)</span>
                  <strong>46</strong>
                </div>
                <div className="preview-bar__track">
                  <div className="preview-bar__fill preview-bar__fill--warn" style={{ width: "46%" }} />
                </div>
              </div>
              <div className="preview-bar">
                <div className="preview-bar__label">
                  <span>Governança</span>
                  <strong>70</strong>
                </div>
                <div className="preview-bar__track">
                  <div className="preview-bar__fill" style={{ width: "70%" }} />
                </div>
              </div>
            </div>
            <div className="preview-report__pontos">
              <span className="preview-report__eyebrow">3 pontos de atenção</span>
              <ol>
                <li>Sustentação inconsistente da rotina pela liderança.</li>
                <li>Indicadores psicossociais abaixo da zona saudável.</li>
                <li>Falta de ritual de revisão decisória.</li>
              </ol>
              <p className="preview-report__legend">
                Enviado por e-mail · PDF · zona saudável ≥ 60
              </p>
            </div>
          </div>

          <DiagnosticoInicialQuiz />
        </div>

        <div className="container split split--form">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">Quer a devolutiva e o próximo passo?</span>
            <h2 className="h2 h2--light">
              Receba o Relatório Preliminar CRIVO e fale com um especialista.
            </h2>

            <div className="diag-compare">
              <div className="diag-card diag-card--free">
                <span className="diag-card__tag diag-card__tag--free">Diagnóstico inicial · gratuito</span>
                <p>
                  Leitura <strong>preliminar</strong> do estado decisório e dos riscos psicossociais. Ponto de partida —
                  não substitui o diagnóstico oficial completo.
                </p>
              </div>
              <div className="diag-card">
                <span className="diag-card__tag">Diagnóstico completo · contratado</span>
                <p>
                  Diagnóstico <strong>oficial</strong> da organização, aplicado e gerido no Portal Executivo, com plano
                  de ação, evidências e acompanhamento.
                </p>
              </div>
            </div>

            <ul className="benefit-list">
              <li>
                <span>▴</span> Leitura inicial da maturidade em 5 dimensões (pressão, liderança, cultura, fatores psicossociais e governança)
              </li>
              <li>
                <span>▴</span> Principal ponto de atenção da sua organização
              </li>
              <li>
                <span>▴</span> Recomendação de nível de serviço adequado ao seu momento
              </li>
              <li>
                <span>▴</span> Próximo passo sugerido e conversa estratégica com um especialista CRIVO
              </li>
            </ul>
            <p className="objection">
              &ldquo;Não é só um formulário. É uma primeira leitura sobre riscos invisíveis, liderança e pontos de
              atenção que podem afetar cultura, execução e resultados.&rdquo;
            </p>
          </div>

          <form className="lead-form" id="leadForm">
            <h3 className="form__title">Fazer diagnóstico inicial</h3>
            <p className="form__sub">Gratuito · Resposta de um especialista em até 24h úteis.</p>

            <div className="field">
              <label htmlFor="nome">Nome completo</label>
              <input type="text" id="nome" name="nome" placeholder="Seu nome" required />
            </div>
            <div className="field">
              <label htmlFor="empresa">Empresa</label>
              <input type="text" id="empresa" name="empresa" placeholder="Razão social" required />
            </div>
            <div className="field">
              <label htmlFor="segmento">Segmento</label>
              <select id="segmento" name="segmento" required defaultValue="">
                <option value="">Selecione o segmento</option>
                <option>Indústria</option>
                <option>Varejo</option>
                <option>Saúde</option>
                <option>Serviços financeiros</option>
                <option>Tecnologia</option>
                <option>Educação</option>
                <option>Construção / Engenharia</option>
                <option>Logística e transporte</option>
                <option>Outro</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="colaboradores">Nº de colaboradores</label>
                <select id="colaboradores" name="colaboradores" required defaultValue="">
                  <option value="">Selecione</option>
                  <option>Até 50</option>
                  <option>51 a 200</option>
                  <option>201 a 500</option>
                  <option>501 a 1.000</option>
                  <option>1.001 a 5.000</option>
                  <option>Mais de 5.000</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="lideres">Nº de líderes</label>
                <input type="number" id="lideres" name="lideres" placeholder="Ex: 12" min="1" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input type="tel" id="whatsapp" name="whatsapp" placeholder="(00) 00000-0000" required />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail corporativo</label>
              <input type="email" id="email" name="email" placeholder="nome@empresa.com.br" required />
            </div>
            <div className="field">
              <label htmlFor="desafio">Principal desafio atual da empresa (opcional)</label>
              <textarea
                id="desafio"
                name="desafio"
                rows={2}
                placeholder="Ex.: turnover na liderança, conflitos entre áreas, decisões sob pressão…"
              />
            </div>
            <div className="field">
              <label htmlFor="governanca">Como a empresa acompanha decisões, planos de ação e responsabilidades hoje?</label>
              <textarea
                id="governanca"
                name="governanca"
                rows={2}
                placeholder="Ex.: rituais de acompanhamento, responsáveis, prazos, evidências, uso de IA, comitês, indicadores ou dificuldades atuais."
              />
            </div>

            <button type="submit" className="btn btn--terra btn--block">
              Fazer diagnóstico inicial →
            </button>
            <p className="form__lgpd">Dados protegidos pela LGPD · Confidencial · Sem spam</p>
            <p className="form__success" id="formSuccess" role="status" aria-live="polite">
              Solicitação recebida. Um especialista CRIVO entra em contato em até 24h úteis.
            </p>
            <p className="form__error" id="formError" role="alert" aria-live="assertive">
              Não foi possível enviar agora. Verifique sua conexão e tente novamente.
            </p>
          </form>
        </div>
      </section>

      {/* ===================== 15 · FAQ ===================== */}
      <section className="section section--light" id="faq">
        <div className="container container--narrow">
          <span className="eyebrow">Perguntas frequentes</span>
          <h2 className="h2">Antes da nossa conversa.</h2>

          <div className="faq">
            <details>
              <summary>O que a CRIVO faz na prática?</summary>
              <p>
                A CRIVO é uma consultoria estratégica de transformação organizacional com tecnologia aplicada. Ajuda a
                empresa a identificar riscos organizacionais, custos invisíveis e padrões de liderança que afetam
                cultura, execução e resultados — transformando diagnóstico em plano de ação, desenvolvimento da liderança
                e evolução acompanhada (Portal, app, indicadores e parecer consultivo).
              </p>
            </details>
            <details>
              <summary>Como a CRIVO apoia governança, liderança e IA na prática?</summary>
              <p>
                Conectando decisão, cultura e tecnologia em uma mesma agenda. A CRIVO estrutura rituais de
                acompanhamento (responsáveis, prazos, evidências), desenvolve a liderança para decidir com critério sob
                pressão e prepara cultura e pessoas para o uso responsável da Inteligência Artificial — com método,
                indicadores agregados e plano de ação no Portal e no app.
              </p>
            </details>
            <details>
              <summary>A CRIVO é uma solução apenas para NR-1?</summary>
              <p>
                Não. A NR-1 é uma porta de entrada e uma urgência de mercado, não o centro da marca. A CRIVO atua em
                liderança, cultura, fatores psicossociais, transformação cultural, governança de IA e performance.
              </p>
            </details>
            <details>
              <summary>A CRIVO resolve a obrigação da NR-1?</summary>
              <p>
                A CRIVO apoia a empresa com diagnóstico, leitura técnica, plano de ação, evidências e acompanhamento —
                integrando fatores psicossociais à liderança, à decisão e à execução. Não prometemos conformidade
                automática: tratamos a causa — a forma como a liderança decide, cobra, comunica e sustenta a rotina.
              </p>
            </details>
            <details>
              <summary>O que é o ICD™ e por que ele é diferente?</summary>
              <p>
                O ICD™ — Índice de Coerência Decisória — é uma metodologia proprietária da CRIVO para apoiar líderes na
                leitura da coerência decisória em decisões reais. Não julga a decisão nem mede personalidade ou saúde
                mental: mostra onde a decisão pode estar perdendo sustentação e impactando o resultado. São 8 afirmações
                aplicadas a uma decisão real, 4 eixos — Clareza, Critério, Alinhamento e Sustentação — score de 0 a 100
                com zonas de leitura e evolução trimestral. Dados individuais privados; visão agregada para a empresa,
                sem ranking nominal.
              </p>
            </details>
            <details>
              <summary>Como funciona o Portal Executivo e o que vejo no dashboard?</summary>
              <p>
                Empresas contratantes acessam um ambiente seguro. No Portal, a empresa cadastra áreas, cria campanhas de
                diagnóstico, acompanha a adesão e gere o plano de ação. O dashboard reúne o Índice Geral CRIVO, fatores
                psicossociais, liderança e cultura, áreas críticas, plano de ação, evidências e relatório executivo —
                sempre com dados agregados, por grupos elegíveis e protegidos pela LGPD.
              </p>
            </details>
            <details>
              <summary>Qual é o papel do App CRIVO?</summary>
              <p>
                O App CRIVO é a camada que sustenta a transformação na rotina do líder: Meu Estado, CRIVO Pocket, Radar
                da Decisão (ICD™), Simulador de Decisão, Mentor Operacional e Mentor CRIVO, Academia CRIVO e Dashboard
                do Líder. Enquanto o Portal organiza a visão executiva da empresa, o app ajuda a liderança a aplicar o
                método no dia a dia — conectado aos planos de ação e aos indicadores agregados.
              </p>
            </details>
            <details>
              <summary>A empresa verá respostas individuais?</summary>
              <p>
                Não. A empresa visualiza apenas dados agregados e por grupos elegíveis, respeitando um volume mínimo de
                respondentes. Os dados individuais do líder pertencem ao líder; o ICD não é usado para ranking ou
                avaliação individual pela empresa.
              </p>
            </details>
            <details>
              <summary>Pequenas empresas podem usar a CRIVO?</summary>
              <p>
                Sim. O diagnóstico inicial gratuito é uma porta de entrada acessível a empresas de qualquer porte, e os
                níveis de serviço se ajustam ao momento e ao tamanho da organização.
              </p>
            </details>
            <details>
              <summary>O diagnóstico inicial é o mesmo que o diagnóstico completo?</summary>
              <p>
                Não. O diagnóstico inicial é gratuito e oferece uma leitura preliminar do risco decisório — um ponto de
                partida. O diagnóstico completo é contratado, aplicado e gerido no Portal Executivo, com plano de ação,
                evidências e acompanhamento contínuo.
              </p>
            </details>
            <details>
              <summary>Qual nível de serviço é o certo para nós?</summary>
              <p>
                Depende do momento. CRIVO Base para formação coletiva; Evolução para mentoria e governança; Enterprise
                para transformação organizacional (M&amp;A, profissionalização, crescimento); Advisory para conselho
                estratégico de C-Level e fundadores. O diagnóstico inicial indica o nível adequado.
              </p>
            </details>
            <details>
              <summary>Como a CRIVO protege os dados (LGPD)?</summary>
              <p>
                A empresa visualiza dados organizacionais e por grupo, sem exposição indevida de respostas individuais
                sensíveis. Tudo agregado, confidencial e em conformidade com a LGPD — no Portal Executivo e no app CRIVO.
              </p>
            </details>
            <details>
              <summary>Isso é coaching ou programa de bem-estar?</summary>
              <p>
                Não. A CRIVO é um sistema técnico de coerência decisória e governança comportamental. Trabalhamos com
                método, métrica e consequência mensurável — não com motivação genérica.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ===================== 16 · CTA FINAL ===================== */}
      <section className="section section--final">
        <div className="container final">
          <svg className="vertice-final" viewBox="0 0 120 100" fill="none" aria-hidden="true">
            <line x1="17" y1="82" x2="60" y2="16" stroke="#F2F0EC" strokeWidth="2" strokeLinecap="round" />
            <line x1="103" y1="82" x2="60" y2="16" stroke="#F2F0EC" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="82" x2="44" y2="82" stroke="#F2F0EC" strokeWidth="2" strokeLinecap="round" />
            <line x1="76" y1="82" x2="103" y2="82" stroke="#F2F0EC" strokeWidth="2" strokeLinecap="round" />
            <circle cx="60" cy="16" r="6" fill="#C4894A" />
            <circle cx="60" cy="16" r="2.6" fill="#F2F0EC" />
          </svg>
          <p className="final__message">
            A CRIVO identifica riscos psicossociais, custos invisíveis e padrões de liderança, organiza o diagnóstico no
            Portal Executivo e sustenta a evolução por meio de planos de ação, desenvolvimento e acompanhamento contínuo.
          </p>
          <h2 className="display final__title">
            Decisão com critério é <span className="terra-text">infraestrutura</span> de qualidade e resultado.
          </h2>
          <p className="final__sub">Lideranças sustentam cultura. Cultura sustenta organizações.</p>
          <div className="hero__ctas">
            <a href="#diagnostico" className="btn btn--terra">
              Fazer diagnóstico inicial
            </a>
            <a
              href="https://wa.me/5511918531796?text=Quero%20falar%20com%20um%20especialista%20CRIVO"
              target="_blank"
              rel="noopener"
              className="btn btn--ghost"
            >
              Falar com especialista
            </a>
          </div>
          <p className="hero__micro">Confidencial · Sem compromisso · Resposta em 24h úteis</p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
