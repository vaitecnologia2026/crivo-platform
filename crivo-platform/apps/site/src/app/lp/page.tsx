import type { Metadata } from "next";
import { LpEffects } from "./LpEffects";
import { HeroBanners } from "./HeroBanners";
import { DiagnosticoInicialQuiz } from "./DiagnosticoInicialQuiz";
import "./lp.css";

export const metadata: Metadata = {
  title: "CRIVO™ — Decision Intelligence System",
  description:
    "Plataforma de inteligência organizacional e desenvolvimento da liderança. A CRIVO identifica riscos humanos, custos invisíveis e padrões de liderança que afetam cultura, execução e resultados — transformando diagnóstico em plano de ação, desenvolvimento e evolução sustentável.",
};

// Plataforma React (apps/web). Configurável por env: defina
// NEXT_PUBLIC_PLATAFORMA_URL=https://app.crivolegacy.com.br quando o subdomínio
// estiver no ar. Fallback: preview atual da Vercel.
const PLATAFORMA_URL =
  process.env.NEXT_PUBLIC_PLATAFORMA_URL ?? "https://crivo-web.vercel.app/";
const DESIGN_SYSTEM_URL = "/design-system";

function VerticeMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 44" fill="none" aria-hidden="true">
      <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
      <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      <LpEffects />

      {/* ===================== NAV ===================== */}
      <header className="nav" id="nav">
        <div className="container nav__inner">
          <a href="#hero" className="brand">
            <VerticeMark className="vertice" />
            <span className="brand__text">
              <span className="brand__name">CRIVO</span>
              <span className="brand__sub">Decision Intelligence</span>
            </span>
          </a>
          <nav className="nav__links">
            <a href="#problema">O Problema</a>
            <a href="#metodo">Método</a>
            <a href="#icd">ICD</a>
            <a href="#portal">Portal</a>
            <a href="#solucoes">Soluções</a>
            <a href="#nr1">NR-1</a>
          </nav>
          <div className="nav__actions">
            <a href={DESIGN_SYSTEM_URL} className="btn btn--ghost btn--sm">
              Manual de marca
            </a>
            <a href={PLATAFORMA_URL} className="btn btn--terra btn--sm">
              Acessar sistema
            </a>
          </div>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section id="hero" className="hero">
        <div className="hero__bg"></div>
        <div className="container hero__inner">
          <HeroBanners />

          <div className="hero__visual">
            <svg className="vertice-hero" viewBox="0 0 240 220" fill="none" aria-hidden="true">
              <line x1="34" y1="178" x2="120" y2="32" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="206" y1="178" x2="120" y2="32" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="34" y1="178" x2="88" y2="178" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="152" y1="178" x2="206" y2="178" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="120" cy="32" r="11" fill="#C4894A" />
              <circle cx="120" cy="32" r="4.8" fill="#F2F0EC" />
            </svg>
            <span className="vertice-hero__label">O ponto de decisão · o ICD</span>
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

      {/* ===================== PROBLEMA ===================== */}
      <section className="section section--light" id="problema">
        <div className="container">
          <span className="eyebrow">O Problema</span>
          <h2 className="h2">Empresas crescem até o limite da sua liderança.</h2>
          <p className="lede">
            A maioria das empresas investe em estratégia, processos e tecnologia. Poucas desenvolvem a liderança que
            sustenta decisões, comportamentos e execução sob pressão.
          </p>

          <div className="pain-grid">
            <article className="pain-card">
              <span className="pain-card__num">01</span>
              <h3>Decisões reativas sob pressão</h3>
              <p>
                Sob pressão e urgência, líderes decidem no modo automático — e colhem retrabalho, conflito e
                inconsistência.
              </p>
            </article>
            <article className="pain-card">
              <span className="pain-card__num">02</span>
              <h3>Crescimento sem sustentação humana</h3>
              <p>
                A empresa acelera, mas a liderança não acompanha. O líder vira gargalo. O time não executa sem validação
                constante.
              </p>
            </article>
            <article className="pain-card">
              <span className="pain-card__num">03</span>
              <h3>Riscos invisíveis que viram passivo</h3>
              <p>Clima tóxico, burnout, turnover e adoecimento corroem produtividade, cultura e resultado — e raramente são monitorados.</p>
            </article>
            <article className="pain-card">
              <span className="pain-card__num">04</span>
              <h3>NR-1 como sintoma de algo maior</h3>
              <p>
                A regulação chegou, mas o problema não é compliance: é a forma como a liderança decide, cobra e se
                comporta.
              </p>
            </article>
          </div>

          <p className="transition-quote">
            &ldquo;O problema não é a estratégia. É a qualidade da decisão que a executa.&rdquo;
          </p>
        </div>
      </section>

      {/* ===================== NR-1 ===================== */}
      <section className="section section--dark" id="nr1">
        <div className="container">
          <span className="eyebrow eyebrow--terra">NR-1 · porta de entrada</span>
          <h2 className="h2 h2--light h2--center">
            A NR-1 tornou obrigatório um problema que já impactava cultura, liderança e resultado.
          </h2>
          <p className="lede lede--light">
            A atualização da NR-1 ampliou a atenção das empresas sobre fatores psicossociais relacionados ao trabalho.
            Mas o desafio vai além da conformidade: envolve a forma como a organização lidera, decide, cobra, comunica e
            sustenta a rotina. A porta de entrada pode ser a NR-1 — a transformação acontece na liderança.
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

      {/* ===================== QUEM SOMOS ===================== */}
      <section className="section section--dark" id="quem-somos">
        <div className="container split">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">Quem somos</span>
            <h2 className="h2 h2--light">
              Consultoria estratégica de transformação organizacional por meio do desenvolvimento sustentável da
              liderança.
            </h2>
            <p className="body--light">
              A CRIVO™ combina método proprietário, leitura organizacional, desenvolvimento da liderança e tecnologia
              aplicada para transformar sinais dispersos em clareza, plano de ação e evolução sustentável — conectando
              liderança, comportamento, cultura, governança, tecnologia, execução e resultado.
            </p>
            <blockquote className="pull-quote">
              &ldquo;A CRIVO™ transforma sinais invisíveis em clareza, liderança e evolução sustentável.&rdquo;
            </blockquote>
          </div>
          <div className="split__right">
            <div className="frente">
              <span className="frente__ic">▴</span>
              <div>
                <strong>Liderança</strong>
                <span>
                  Fortalecimento da capacidade humana de liderar, decidir, comunicar e sustentar a rotina em ambientes
                  de pressão e complexidade.
                </span>
              </div>
            </div>
            <div className="frente">
              <span className="frente__ic">▴</span>
              <div>
                <strong>Cultura</strong>
                <span>Leitura e desenvolvimento dos padrões culturais, comportamentos e rituais que sustentam ou limitam a execução.</span>
              </div>
            </div>
            <div className="frente">
              <span className="frente__ic">▴</span>
              <div>
                <strong>Inteligência Organizacional</strong>
                <span>Diagnóstico estruturado de riscos humanos, fatores psicossociais, custos invisíveis e sinais que afetam clima, performance e continuidade.</span>
              </div>
            </div>
            <div className="frente">
              <span className="frente__ic">▴</span>
              <div>
                <strong>Governança e IA</strong>
                <span>Preparação da liderança e da cultura para o uso responsável da inteligência artificial — conectando pessoas, tecnologia, ética, decisão e produtividade.</span>
              </div>
            </div>
            <div className="frente">
              <span className="frente__ic">▴</span>
              <div>
                <strong>Performance Sustentável</strong>
                <span>Transformação de diagnóstico em plano de ação, acompanhamento, desenvolvimento da liderança e evolução mensurável.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="container mvv">
          <article className="mvv-card">
            <span className="mvv-card__tag">Missão</span>
            <p>
              Transformar riscos invisíveis em consciência, ação e evolução organizacional — desenvolvendo lideranças
              capazes de sustentar cultura, decisões, governança e resultados em ambientes de pressão e transformação
              tecnológica.
            </p>
          </article>
          <article className="mvv-card">
            <span className="mvv-card__tag">Visão</span>
            <p>
              Ser referência em inteligência organizacional e desenvolvimento da liderança para empresas que precisam
              integrar pessoas, cultura, tecnologia, decisão e performance de forma sustentável.
            </p>
          </article>
          <article className="mvv-card">
            <span className="mvv-card__tag">Valores</span>
            <p>
              Critério acima de pressão. Evidência acima de opinião. Governança, confidencialidade e responsabilidade —
              com o desenvolvimento humano como base de todo resultado sustentável.
            </p>
          </article>
        </div>
      </section>

      {/* ===================== COMO NASCEU ===================== */}
      <section className="section section--light" id="como-nasceu">
        <div className="container container--narrow">
          <span className="eyebrow">Como nasceu a CRIVO™</span>
          <h2 className="h2">Da deterioração decisória sob pressão a um método de transformação.</h2>
          <p className="lede">
            A CRIVO™ nasceu da percepção executiva de que organizações perdem performance, clareza, cultura e
            sustentabilidade quando a qualidade das decisões se deteriora sob pressão. Enquanto o mercado mede sintomas,
            a CRIVO desenvolveu uma camada de inteligência organizacional capaz de transformar padrões invisíveis de
            risco humano em leitura executiva, indicadores, desenvolvimento da liderança e transformação.
          </p>

          <div className="founders">
            <article className="founder">
              <h3>Rodrigo Oliveira</h3>
              <span className="founder__role">Cofundador</span>
              <p>
                Quase três décadas nos bastidores das decisões que impactam cultura, liderança, clima, execução e
                resultados. Conduziu agendas de RH, transformação cultural, desenvolvimento de lideranças, relações
                trabalhistas, sucessão, integração pós-aquisição e decisões críticas sob pressão. Aprofundou estudos em
                comportamento humano, neurociência, PNL, conselho consultivo, tomada de decisão e IA.
              </p>
            </article>
            <article className="founder">
              <h3>Viviani Ostan</h3>
              <span className="founder__role">Cofundadora</span>
              <p>
                Experiência executiva no setor bancário e de investimentos, liderando grandes equipes, estruturando
                novos negócios, desenvolvendo pessoas e sustentando relações de confiança em contextos de alta
                exigência, performance e responsabilidade.
              </p>
            </article>
          </div>

          <blockquote className="pull-quote pull-quote--center">
            &ldquo;A CRIVO™ nasceu para transformar sinais invisíveis em clareza, liderança e evolução
            sustentável.&rdquo;
          </blockquote>
        </div>
      </section>

      {/* ===================== RISCOS PSICOSSOCIAIS E IA ===================== */}
      <section className="section section--dark" id="riscos-ia">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Os dois desafios da nova gestão</span>
          <h2 className="h2 h2--light h2--center">Riscos psicossociais e IA.</h2>
          <p className="lede lede--light" style={{ textAlign: "center", margin: "0 auto 8px" }}>
            A CRIVO™ atua onde os dois maiores desafios das empresas se encontram: o aumento da pressão humana e a
            aceleração tecnológica.
          </p>

          <div className="riscos-grid">
            <article className="risco-card">
              <span className="risco-card__ic">◴</span>
              <h3>Riscos psicossociais</h3>
              <p>Leitura estruturada de sobrecarga, conflitos, afastamentos, comunicação, segurança psicológica e fatores humanos que impactam cultura, execução e resultados.</p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic">◆</span>
              <h3>Pessoas + IA</h3>
              <p>Preparação da liderança e da cultura para integrar inteligência artificial com consciência, critério, governança e responsabilidade.</p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic">▲</span>
              <h3>Liderança e cultura</h3>
              <p>Desenvolvimento de líderes capazes de sustentar decisões, conversas, rotinas e comportamentos em ambientes de pressão e transformação.</p>
            </article>
            <article className="risco-card">
              <span className="risco-card__ic">❖</span>
              <h3>Governança comportamental</h3>
              <p>Transformação de sinais invisíveis em diagnóstico, plano de ação, desenvolvimento da liderança, evidências e evolução sustentável.</p>
            </article>
          </div>
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
              <strong>dimensões — os 4 Rs</strong>
              <span>Reatividade · Rigidez · Repercussão · Risco</span>
            </div>
            <div className="icd-step">
              <span className="icd-step__num">0–100</span>
              <strong>score</strong>
              <span>Com zonas de leitura. Quanto mais alto, maior a coerência decisória.</span>
            </div>
            <div className="icd-step">
              <span className="icd-step__num">1</span>
              <strong>tensão dominante</strong>
              <span>O R que mais pesa na decisão sob pressão (entre os 4 Rs).</span>
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

      {/* ===================== PORTAL EXECUTIVO ===================== */}
      <section className="section section--dark" id="portal">
        <div className="container split">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">Portal Executivo CRIVO</span>
            <h2 className="h2 h2--light">A visão executiva da sua organização, em um ambiente logado e seguro.</h2>
            <p className="body--light">
              Empresas contratantes acessam um <strong>ambiente seguro</strong> para organizar diagnósticos, acompanhar
              dashboards, gerir planos de ação e monitorar a evolução da jornada CRIVO.
            </p>
            <blockquote className="pull-quote">
              &ldquo;O Portal organiza a visão executiva da empresa. O app sustenta a transformação na rotina dos
              líderes.&rdquo;
            </blockquote>
            <p className="lgpd-note">
              <strong>LGPD &amp; confidencialidade.</strong> A empresa visualiza dados organizacionais e por grupo — sem
              exposição indevida de respostas individuais sensíveis. Tudo agregado e protegido.
            </p>
          </div>
          <div className="split__right">
            <div className="portal-features">
              <div className="portal-feature">
                <span>▴</span> Cadastrar áreas e estrutura organizacional
              </div>
              <div className="portal-feature">
                <span>▴</span> Criar campanhas e disparar links de pesquisa
              </div>
              <div className="portal-feature">
                <span>▴</span> Acompanhar a adesão em tempo real
              </div>
              <div className="portal-feature">
                <span>▴</span> Visualizar dashboards do diagnóstico e indicadores agregados de liderança
              </div>
              <div className="portal-feature">
                <span>▴</span> Acessar o mapa de riscos psicossociais
              </div>
              <div className="portal-feature">
                <span>▴</span> Gerir o plano de ação e as evidências
              </div>
              <div className="portal-feature">
                <span>▴</span> Gerar relatórios executivos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== DASHBOARD ===================== */}
      <section className="section section--light" id="dashboard">
        <div className="container">
          <span className="eyebrow">Dashboard executivo</span>
          <h2 className="h2">Dados que viram decisão — em uma leitura.</h2>
          <p className="lede">
            O dashboard transforma respostas em inteligência organizacional. Tudo o que a liderança precisa para decidir
            com critério, monitorar riscos e comprovar a evolução.
          </p>

          <div className="dash-grid">
            <div className="dash-card">
              <strong>Índice Geral CRIVO</strong>
              <span>Síntese dos fatores humanos, culturais e organizacionais</span>
            </div>
            <div className="dash-card">
              <strong>Evolução dos indicadores</strong>
              <span>Tendência ao longo do tempo</span>
            </div>
            <div className="dash-card">
              <strong>Taxa de adesão</strong>
              <span>Participação por área e campanha</span>
            </div>
            <div className="dash-card">
              <strong>Áreas críticas</strong>
              <span>Prioridades de atuação</span>
            </div>
            <div className="dash-card">
              <strong>Fatores psicossociais</strong>
              <span>Leitura estruturada dos riscos relacionados ao trabalho</span>
            </div>
            <div className="dash-card">
              <strong>Liderança e cultura</strong>
              <span>Padrões de liderança, segurança psicológica e coerência</span>
            </div>
            <div className="dash-card">
              <strong>Plano de ação</strong>
              <span>Status, responsáveis e prazos</span>
            </div>
            <div className="dash-card">
              <strong>Evidências</strong>
              <span>Documentação e acompanhamento da jornada</span>
            </div>
            <div className="dash-card">
              <strong>Relatório executivo</strong>
              <span>Síntese para C-Level e conselho</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== APP CRIVO ===================== */}
      <section className="section section--dark" id="app">
        <div className="container split">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">App CRIVO</span>
            <h2 className="h2 h2--light">A transformação que acontece na rotina do líder.</h2>
            <p className="body--light">
              O Portal mostra onde a organização precisa atuar. O app ajuda a liderança a sustentar a mudança todos os
              dias — conectado à jornada CRIVO, aos planos de ação e aos indicadores agregados.
            </p>
            <p className="lgpd-note">
              <strong>Portal ↔ App.</strong> Uma jornada integrada: o que o líder desenvolve no app reflete na leitura
              organizacional do Portal — e vice-versa.
            </p>
          </div>
          <div className="split__right">
            <div className="app-features">
              <div className="app-feature">
                <strong>Meu Estado</strong>
                <span>Check-in da coerência decisória no dia a dia.</span>
              </div>
              <div className="app-feature">
                <strong>CRIVO Pocket</strong>
                <span>Microaprendizados aplicados à liderança.</span>
              </div>
              <div className="app-feature">
                <strong>Radar da Decisão · ICD™</strong>
                <span>Leitura contínua da coerência decisória sob pressão.</span>
              </div>
              <div className="app-feature">
                <strong>Simulador de Decisão</strong>
                <span>Ensaie decisões difíceis antes de agir.</span>
              </div>
              <div className="app-feature">
                <strong>Mentor Operacional · Mentor CRIVO</strong>
                <span>Apoio reflexivo e operacional à decisão.</span>
              </div>
              <div className="app-feature">
                <strong>Academia CRIVO</strong>
                <span>Cursos, trilhas, vídeos e materiais aplicados.</span>
              </div>
              <div className="app-feature">
                <strong>Dashboard do Líder</strong>
                <span>Evolução e plano de desenvolvimento do líder.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== ECOSSISTEMA · ACADEMIA ===================== */}
      <section className="section section--light" id="ecossistema">
        <div className="container">
          <span className="eyebrow">Ecossistema CRIVO</span>
          <h2 className="h2">Um ecossistema contínuo de desenvolvimento organizacional.</h2>
          <p className="lede">
            A jornada não termina no diagnóstico nem no app. Ela continua no Portal do Líder e na Academia CRIVO — com
            conteúdos, trilhas, treinamentos, dashboards e inteligência contínua.
          </p>

          <div className="eco-grid">
            <div className="eco-card eco-card--main">
              <span className="eco-card__tag">Portal do Líder · Academia CRIVO</span>
              <h3>Academia CRIVO de Liderança e Cultura</h3>
              <p>
                Vídeos, cursos, trilhas, artigos, guias, checklists, gravações de mentorias e materiais práticos —
                conectados ao plano de ação, à mentoria e à evolução.
              </p>
              <ul className="eco-list">
                <li>Dashboards</li>
                <li>Conteúdos &amp; vídeos</li>
                <li>Cursos &amp; trilhas</li>
                <li>Biblioteca estratégica</li>
                <li>Artigos &amp; guias</li>
                <li>Analytics &amp; inteligência contínua</li>
              </ul>
            </div>
            <div className="eco-side">
              <div className="eco-card">
                <span className="eco-card__tag">Integrações</span>
                <h4>LinkedIn · YouTube</h4>
                <p>Conteúdos e produção da CRIVO integrados ao Portal do Líder — quando tecnicamente viável.</p>
              </div>
              <div className="eco-card">
                <span className="eco-card__tag">Roadmap</span>
                <h4>Plataforma em evolução contínua</h4>
                <p>Login executivo, conteúdos, cursos, dashboards e jornadas integradas.</p>
              </div>
            </div>
          </div>
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
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
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
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
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
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
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
              <a href="#diagnostico" className="btn btn--terra btn--block">
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
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
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
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
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

      {/* ===================== AUTORIDADE ===================== */}
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
                <tr>
                  <td>Questionário NR-1</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Mapeamento de fatores psicossociais</td>
                  <td>parcial</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Diagnóstico organizacional estruturado</td>
                  <td>—</td>
                  <td>✓</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Plano de ação executável (PDCA)</td>
                  <td>—</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Dashboard executivo com evolução longitudinal</td>
                  <td>—</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Portal Executivo logado e seguro (LGPD)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>App CRIVO de sustentação da rotina</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Desenvolvimento e Trilha de Liderança</td>
                  <td>—</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Academia CRIVO (cursos, trilhas, conteúdos)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Mentor CRIVO e Simulador de Decisão</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>ICD™ — Índice de Coerência Decisória (métrica proprietária)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Pocket — preparo rápido para decisões e conversas</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Leitura contínua e evolutiva por ciclos</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Mentoria executiva e governança comportamental</td>
                  <td>—</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Conselho estratégico C-Level (Advisory)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="transition-quote transition-quote--light">
            &ldquo;Não tratamos apenas o risco. Atuamos na liderança que sustenta cultura, decisões e resultados.&rdquo;
          </p>
        </div>
      </section>

      {/* ===================== E-BOOK ===================== */}
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

      {/* ===================== DIAGNÓSTICO ===================== */}
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

          {/* Preview do Relatório Preliminar (estilo Lovable rev2) — 5 blocos com scores
              ilustrativos + 3 pontos de atenção. Ajuda o lead a entender o que vai chegar
              por e-mail depois do quiz. */}
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

      {/* ===================== FAQ ===================== */}
      <section className="section section--light" id="faq">
        <div className="container container--narrow">
          <span className="eyebrow">Perguntas frequentes</span>
          <h2 className="h2">Antes da nossa conversa.</h2>

          <div className="faq">
            <details>
              <summary>O que a CRIVO faz na prática?</summary>
              <p>
                A CRIVO é uma plataforma de inteligência organizacional e desenvolvimento da liderança. Ajuda a empresa a
                identificar riscos humanos, custos invisíveis e padrões de liderança que afetam cultura, execução e
                resultados — transformando diagnóstico em plano de ação, desenvolvimento da liderança e evolução
                acompanhada (Portal, app, indicadores e parecer consultivo).
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
                aplicadas a uma decisão real, 4 eixos — Clareza, Critério, Alinhamento e Decisão — score de 0 a 100 com
                zonas de leitura e evolução trimestral. Dados individuais privados; visão agregada para a empresa, sem
                ranking nominal.
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

      {/* ===================== CTA FINAL ===================== */}
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

      {/* ===================== FOOTER ===================== */}
      <footer className="footer">
        <div className="container footer__grid">
          <div>
            <div className="brand brand--footer">
              <VerticeMark className="vertice" />
              <span className="brand__text">
                <span className="brand__name">CRIVO</span>
                <span className="brand__sub">Decision Intelligence</span>
              </span>
            </div>
            <p className="footer__tag">Decisão com critério é infraestrutura de qualidade e resultado.</p>
          </div>
          <div>
            <h5>Institucional</h5>
            <ul>
              <li>
                <a href="#hero">Início</a>
              </li>
              <li>
                <a href="#quem-somos">Quem somos</a>
              </li>
              <li>
                <a href="#como-nasceu">Como nasceu</a>
              </li>
              <li>
                <a href="#riscos-ia">Novo ciclo de gestão</a>
              </li>
              <li>
                <a href="#metodo">Método CRIVO</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Soluções</h5>
            <ul>
              <li>
                <a href="#diagnostico">Diagnóstico Inicial</a>
              </li>
              <li>
                <a href="#solucoes">CRIVO Diagnóstico™</a>
              </li>
              <li>
                <a href="#solucoes">CRIVO Liderança</a>
              </li>
              <li>
                <a href="#solucoes">CRIVO Evolução</a>
              </li>
              <li>
                <a href="#solucoes">CRIVO Enterprise</a>
              </li>
              <li>
                <a href="#solucoes">CRIVO Advisory</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Sistema</h5>
            <ul>
              <li>
                <a href="#solucoes">CRIVO Diagnóstico™</a>
              </li>
              <li>
                <a href="#portal">Portal Executivo</a>
              </li>
              <li>
                <a href="#app">App CRIVO</a>
              </li>
              <li>
                <a href="#ecossistema">Academia CRIVO</a>
              </li>
              <li>
                <a href="#icd">Radar da Decisão · ICD™</a>
              </li>
              <li>
                <a href="#dashboard">Dashboard</a>
              </li>
              <li>
                <a href="#nr1">NR-1</a>
              </li>
              <li>
                <a href={PLATAFORMA_URL}>Plataforma</a>
              </li>
            </ul>
          </div>
          <div>
            <h5>Contato</h5>
            <ul>
              <li>Rodrigo Oliveira · Cofundador</li>
              <li>Viviani Ostan · Cofundadora</li>
              <li>
                <a href="mailto:contato@crivolegacy.com.br">contato@crivolegacy.com.br</a>
              </li>
              <li>
                <a
                  href="https://wa.me/5511918531796?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20CRIVO"
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp executivo · (11) 91853-1796
                </a>
              </li>
              <li>
                <a href={PLATAFORMA_URL}>Área administrativa</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer__legal">
          <div className="container">
            © 2026 CRIVO™ — Decision Intelligence System · O2 Legacy &amp; Consulting · Confidencial · LGPD
          </div>
        </div>
      </footer>
    </>
  );
}
