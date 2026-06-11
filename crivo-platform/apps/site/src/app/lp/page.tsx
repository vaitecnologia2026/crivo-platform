import type { Metadata } from "next";
import { LpEffects } from "./LpEffects";
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
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Inteligência Organizacional e Liderança</span>
            <h1 className="display">
              Transformação organizacional começa pelo{" "}
              <span className="terra-text">comportamento e pelas decisões</span> da liderança.
            </h1>
            <p className="hero__sub">
              A CRIVO™ ajuda empresas a identificar riscos humanos e organizacionais, custos invisíveis e padrões de
              liderança que afetam cultura, execução e resultados — transformando diagnóstico em plano de ação,
              desenvolvimento e evolução sustentável.
            </p>
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
            <p className="hero__micro">Diagnosticar é o começo. Sustentar a mudança exige liderança preparada.</p>
          </div>

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
              &ldquo;Toda transformação passa pela liderança.&rdquo;
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
              Empresas contratantes recebem acesso com <strong>login e senha</strong>. No Portal Executivo, a empresa
              organiza todo o diagnóstico e acompanha a transformação em um só lugar.
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
                <span>▴</span> Visualizar dashboards e o ICD organizacional
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
              <strong>ICD médio</strong>
              <span>Coerência decisória da organização</span>
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
              <strong>Riscos psicossociais</strong>
              <span>Mapeamento NR-1 aplicado</span>
            </div>
            <div className="dash-card">
              <strong>Custos invisíveis</strong>
              <span>Passivo estimado e monitorado</span>
            </div>
            <div className="dash-card">
              <strong>Plano de ação</strong>
              <span>Status, responsáveis e prazos</span>
            </div>
            <div className="dash-card">
              <strong>Evidências</strong>
              <span>Documentação para conformidade</span>
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
              Enquanto o Portal organiza a visão executiva da empresa, o app sustenta a evolução no dia a dia da
              liderança — conectado ao mesmo ICD e ao mesmo plano de ação.
            </p>
            <p className="lgpd-note">
              <strong>Portal ↔ App.</strong> Uma jornada integrada: o que o líder desenvolve no app reflete na leitura
              organizacional do Portal — e vice-versa.
            </p>
          </div>
          <div className="split__right">
            <div className="app-features">
              <div className="app-feature">
                <strong>Check-in</strong>
                <span>Registro do estado decisório no dia a dia.</span>
              </div>
              <div className="app-feature">
                <strong>CRIVO Pocket</strong>
                <span>Microaprendizados aplicados à liderança.</span>
              </div>
              <div className="app-feature">
                <strong>ICD</strong>
                <span>Medição contínua da coerência decisória.</span>
              </div>
              <div className="app-feature">
                <strong>Chat CRIVO IA</strong>
                <span>Apoio inteligente à decisão, sob demanda.</span>
              </div>
              <div className="app-feature">
                <strong>Acompanhamento</strong>
                <span>Evolução visível ao longo da jornada.</span>
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
          <p className="lede">Desenvolvemos líderes para sustentar cultura, reduzir riscos e fortalecer a performance.</p>

          <div className="ladder">
            <div className="ladder__step ladder__step--free">
              <span className="ladder__tag ladder__tag--free">Grátis</span>
              <strong>Pré-diagnóstico + E-book</strong>
              <span>Entrada · conheça seu risco</span>
            </div>
            <div className="ladder__step ladder__step--s1">
              <span className="ladder__tag">01</span>
              <strong>CRIVO Base</strong>
              <span>Formação coletiva</span>
            </div>
            <div className="ladder__step ladder__step--s2">
              <span className="ladder__tag">02</span>
              <strong>CRIVO Evolução</strong>
              <span>Mentoria &amp; governança</span>
            </div>
            <div className="ladder__step ladder__step--s3">
              <span className="ladder__tag">03</span>
              <strong>CRIVO Enterprise</strong>
              <span>Transformação</span>
            </div>
            <div className="ladder__step ladder__step--s4">
              <span className="ladder__tag">04</span>
              <strong>CRIVO Advisory</strong>
              <span>Conselho C-Level</span>
            </div>
          </div>

          <div className="product-grid product-grid--4">
            <article className="product-card">
              <span className="product-card__level">01</span>
              <h3>CRIVO Base</h3>
              <span className="product-card__tag">Formação Coletiva</span>
              <p>
                Turmas de até 50 líderes. Formação contínua: liderança prática, cultura, gestão emocional, NR-1 aplicada
                e CRIVO Pocket. ICD inicial incluído.
              </p>
              <a href="#diagnostico" className="btn btn--outline-dark btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card product-card--featured">
              <span className="badge-featured">Mais procurado</span>
              <span className="product-card__level">02</span>
              <h3>CRIVO Evolução</h3>
              <span className="product-card__tag">Mentoria &amp; Governança</span>
              <p>
                Mentoria em grupo, governança comportamental, liderança sob pressão, ICD evolutivo e devolutivas
                estruturadas. Aprofundamento contínuo.
              </p>
              <a href="#diagnostico" className="btn btn--terra btn--block">
                Conhecer
              </a>
            </article>

            <article className="product-card">
              <span className="product-card__level">03</span>
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
              <span className="product-card__level">04</span>
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

          <div className="trilha">
            <span className="trilha__eyebrow">Trilha da Liderança · base</span>
            <div className="trilha__grid">
              <div>
                <strong>30–50</strong>
                <span>líderes por ciclo</span>
              </div>
              <div>
                <strong>6 meses</strong>
                <span>sustentação opcional até 12</span>
              </div>
              <div>
                <strong>Semanal</strong>
                <span>encontros com aplicação prática</span>
              </div>
              <div>
                <strong>Evolutivo</strong>
                <span>acompanhamento integrado a resultados</span>
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
                  <th>Plataformas NR-1</th>
                  <th>Consultorias tradicionais</th>
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
                  <td>Diagnóstico organizacional</td>
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
                  <td>Desenvolvimento de líderes</td>
                  <td>—</td>
                  <td>parcial</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Métrica proprietária de decisão (ICD)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Leitura contínua e evolutiva</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
                <tr>
                  <td>Conselho estratégico (C-Level)</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="compare__crivo">✓</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="transition-quote transition-quote--light">
            &ldquo;Não atuamos apenas no problema. Atuamos na sustentação humana da organização.&rdquo;
          </p>
        </div>
      </section>

      {/* ===================== E-BOOK ===================== */}
      <section className="section section--light" id="ebook">
        <div className="container ebook">
          <div className="ebook__copy">
            <span className="eyebrow">Material gratuito</span>
            <h2 className="h2">Guia NR-1 para Lideranças: o que muda em 26/05/2026.</h2>
            <p className="ebook__lede">
              Um material técnico e direto sobre a obrigatoriedade da NR-1, os riscos psicossociais e o papel da
              liderança na conformidade — sem juridiquês.
            </p>
            <ul className="ebook__list">
              <li>
                <span>▴</span> O que a fiscalização passa a exigir na prática
              </li>
              <li>
                <span>▴</span> Como a liderança vira fator de risco — ou de proteção
              </li>
              <li>
                <span>▴</span> Checklist de conformidade para começar hoje
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
        <div className="container split split--form">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">Diagnóstico inicial · gratuito</span>
            <h2 className="h2 h2--light">
              Comece pela leitura preliminar da coerência decisória da sua liderança.
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
                <span>▴</span> Leitura inicial dos riscos psicossociais e da pressão decisória
              </li>
              <li>
                <span>▴</span> Indicação do padrão dominante que governa as decisões
              </li>
              <li>
                <span>▴</span> Recomendação de nível de serviço adequado ao seu momento
              </li>
              <li>
                <span>▴</span> Argumentação técnica para conformidade NR-1
              </li>
              <li>
                <span>▴</span> Conversa estratégica com um especialista CRIVO
              </li>
            </ul>
            <p className="objection">
              &ldquo;Não é mais um cadastro de plataforma. É uma leitura técnica preliminar do estado decisório da sua
              organização.&rdquo;
            </p>
          </div>

          <form className="lead-form" id="leadForm">
            <h3 className="form__title">Solicitar diagnóstico inicial</h3>
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

            <button type="submit" className="btn btn--terra btn--block">
              Solicitar diagnóstico inicial →
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
              <summary>O que é o ICD e por que ele é diferente?</summary>
              <p>
                O ICD — Índice de Coerência Decisória — é a métrica proprietária da CRIVO que mede a qualidade do estado
                decisório do líder: não o resultado da decisão, mas as condições em que ela foi tomada. São 10 perguntas
                sobre uma decisão real, 5 dimensões avaliadas (Clareza, Pressão, Confiança, Influência, Risco/Ação) e um
                score de 0 a 100, com o padrão dominante que governa as decisões.
              </p>
            </details>
            <details>
              <summary>A CRIVO resolve a obrigação da NR-1?</summary>
              <p>
                A CRIVO apoia a empresa na conformidade: diagnóstico, leitura técnica, plano de ação, evidências e
                acompanhamento — integrando os riscos psicossociais à liderança, à decisão e à execução. Mais do que
                cumprir a obrigação, tratamos a causa: a forma como a liderança decide, cobra e se comporta. A NR-1 é
                obrigatória desde 26/05/2026.
              </p>
            </details>
            <details>
              <summary>Como funciona o Portal Executivo e o que vejo no dashboard?</summary>
              <p>
                Empresas contratantes recebem acesso logado (login e senha). No Portal, a empresa cadastra áreas, cria
                campanhas, dispara links de pesquisa, acompanha a adesão e gere o plano de ação. O dashboard reúne ICD
                médio, evolução dos indicadores, taxa de adesão, áreas críticas, riscos psicossociais, custos invisíveis,
                plano de ação, evidências e relatório executivo — sempre com dados agregados e protegidos pela LGPD.
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
            A CRIVO identifica riscos e padrões decisórios, organiza o diagnóstico no Portal Executivo, desenvolve
            líderes e transforma dados em plano de ação, governança, execução e evolução mensurável.
          </p>
          <h2 className="display final__title">
            Decisão com critério é <span className="terra-text">infraestrutura</span> de qualidade e resultado.
          </h2>
          <p className="final__sub">Lideranças sustentam cultura. Cultura sustenta organizações.</p>
          <div className="hero__ctas">
            <a href="#diagnostico" className="btn btn--terra">
              Solicitar diagnóstico
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
            <h5>Soluções</h5>
            <ul>
              <li>
                <a href="#solucoes">CRIVO Base</a>
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
                <a href="#icd">ICD — Índice de Coerência</a>
              </li>
              <li>
                <a href="#metodo">Método CRIVO</a>
              </li>
              <li>
                <a href="#portal">Portal Executivo</a>
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
            <h5>O2 Legacy &amp; Consulting</h5>
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
                  WhatsApp · (11) 91853-1796
                </a>
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
