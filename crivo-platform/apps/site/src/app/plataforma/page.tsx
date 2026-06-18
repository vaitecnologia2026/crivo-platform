import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { PLATAFORMA_URL, WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Plataforma CRIVO — Portal Executivo, Dashboard, App e Academia",
  description:
    "Portal Executivo logado e seguro (LGPD), Dashboard executivo, App CRIVO (Pocket, Radar da Decisão) e Academia CRIVO — uma jornada integrada de transformação.",
};

export default function PlataformaPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Plataforma CRIVO</span>
          <h1 className="display h2--light">
            Portal, App e Academia em uma <span className="terra-text">jornada integrada</span>.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 760 }}>
            O Portal organiza a visão executiva da empresa. O App sustenta a transformação na rotina do líder. A
            Academia desenvolve competências. Tudo conectado, agregado e protegido pela LGPD.
          </p>
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
            Login seguro, dashboards inteligentes, plano de ação estruturado e indicadores que mostram o que importa.
            Tudo integrado para transformar dados em decisões e acompanhar a evolução com confiança.
          </p>

          <div className="laptop" role="img" aria-label="Dashboard executivo CRIVO: Índice Geral 78, taxa de adesão 84%, fatores psicossociais, áreas críticas e liderança">
            <div className="laptop__screen">
              <div className="dashshot">
                <div className="dashshot__bar" aria-hidden="true">
                  <span className="dashshot__brand">CRIVO</span>
                  <span className="dashshot__crumb">Dashboard Executivo · Empresa Demo</span>
                  <span className="dashshot__dots"><i /><i /><i /></span>
                </div>
                <div className="dashshot__grid">
                  <div className="ds-tile ds-tile--index">
                    <span className="ds-tile__label">Índice Geral CRIVO</span>
                    <p className="ds-index"><strong>78</strong><span>/100</span></p>
                    <span className="ds-pill ds-pill--ok">Saúde organizacional · Boa</span>
                  </div>
                  <div className="ds-tile ds-tile--wide">
                    <span className="ds-tile__label">Evolução do índice</span>
                    <svg className="ds-line" viewBox="0 0 240 84" preserveAspectRatio="none" aria-hidden="true">
                      <polyline points="4,64 38,58 72,62 106,46 140,50 174,34 208,38 236,22" />
                      <circle cx="236" cy="22" r="3.5" />
                    </svg>
                    <div className="ds-line__axis"><span>jan</span><span>jun</span></div>
                  </div>
                  <div className="ds-tile">
                    <span className="ds-tile__label">Taxa de adesão</span>
                    <p className="ds-big">84%</p>
                    <span className="ds-tile__sub">Participação geral · +12 p.p.</span>
                  </div>
                  <div className="ds-tile">
                    <span className="ds-tile__label">Áreas críticas</span>
                    <ul className="ds-areas">
                      <li>Carga de trabalho <em className="ds-tag ds-tag--high">Alto</em></li>
                      <li>Relações de trabalho <em className="ds-tag ds-tag--mid">Médio</em></li>
                      <li>Reconhecimento <em className="ds-tag ds-tag--mid">Médio</em></li>
                    </ul>
                  </div>
                  <div className="ds-tile">
                    <span className="ds-tile__label">Fatores psicossociais</span>
                    <div className="ds-donut-wrap">
                      <span className="ds-donut" aria-hidden="true" />
                      <ul className="ds-legend">
                        <li><i className="is-high" /> Alto 36%</li>
                        <li><i className="is-mid" /> Médio 48%</li>
                        <li><i className="is-low" /> Baixo 16%</li>
                      </ul>
                    </div>
                  </div>
                  <div className="ds-tile">
                    <span className="ds-tile__label">Liderança e cultura</span>
                    <div className="ds-meter"><span>Segurança psicológica</span><i style={{ width: "74%" }} /><b>74</b></div>
                    <div className="ds-meter"><span>Coerência de liderança</span><i style={{ width: "71%" }} /><b>71</b></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="laptop__base" aria-hidden="true" />
          </div>

          <div className="dash-kpis">
            <div className="dash-kpi">
              <span className="dash-kpi__label">Plano de ação</span>
              <strong className="dash-kpi__num">32</strong>
              <span className="dash-kpi__sub">ações em andamento</span>
              <div className="dash-kpi__bar"><i style={{ width: "64%" }} /></div>
              <span className="dash-kpi__foot">18 concluídas · 14 em andamento · 4 atrasadas</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi__label">Evidências</span>
              <strong className="dash-kpi__num">112</strong>
              <span className="dash-kpi__sub">registradas</span>
              <span className="dash-kpi__foot dash-kpi__foot--up">+18 esta semana</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi__label">Riscos psicossociais</span>
              <div className="dash-heat" aria-hidden="true">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className={`dash-heat__c dash-heat__c--${[1, 2, 3, 2, 3, 4, 3, 4, 4][i]}`} />
                ))}
              </div>
              <span className="dash-kpi__foot">probabilidade × impacto</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi__label">Tendências</span>
              <div className="dash-bars" aria-hidden="true">
                <i style={{ height: "40%" }} /><i style={{ height: "70%" }} /><i style={{ height: "92%" }} />
              </div>
              <span className="dash-kpi__foot">atenção · estável · melhora</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== APP CRIVO ===================== */}
      <section className="section section--dark" id="app">
        <div className="container split split--app">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">App CRIVO</span>
            <h2 className="h2 h2--light">A transformação que acontece na rotina do líder.</h2>
            <p className="body--light">
              O Portal mostra onde a organização precisa atuar. O app ajuda a liderança a sustentar a mudança todos os
              dias — conectado à jornada CRIVO, aos planos de ação e aos indicadores agregados.
            </p>
            <p className="body--light">
              <strong>Pocket prepara. Registro de Decisão organiza. ICD / Radar mede a coerência. Academia desenvolve
              competências.</strong>
            </p>
            <ul className="app-chips" aria-label="Recursos do App CRIVO">
              <li>Meu Estado</li>
              <li>CRIVO Pocket</li>
              <li>Radar da Decisão · ICD™</li>
              <li>Mentor CRIVO</li>
              <li>Academia CRIVO</li>
              <li>Dashboard do Líder</li>
            </ul>
            <p className="lgpd-note">
              <strong>Portal ↔ App.</strong> Uma jornada integrada: o que o líder desenvolve no app reflete na leitura
              organizacional do Portal — e vice-versa.
            </p>
          </div>

          <div className="split__right">
            <div className="phone" role="img" aria-label="Tela do App CRIVO: saudação ao líder, Meu Estado, Pocket e Radar da Decisão">
              <span className="phone__notch" aria-hidden="true" />
              <div className="phone__screen">
                <div className="phone__bar" aria-hidden="true">
                  <span>9:41</span>
                  <span className="phone__brand">CRIVO</span>
                  <span>▤ ▦ ▮</span>
                </div>
                <div className="phone__greet">
                  <span className="phone__hello">Bom dia, Líder.</span>
                  <span className="phone__date">Como está sua coerência hoje?</span>
                </div>
                <div className="phone__state">
                  <div className="phone__ring phone__ring--lg"><strong>78</strong><em>Coerência</em></div>
                  <span className="phone__checkin">Último check-in: hoje, 07:30</span>
                  <span className="phone__btn">Fazer check-in</span>
                </div>
                <span className="phone__label">Em destaque</span>
                <div className="phone__card">
                  <span className="phone__tag">◎ Radar da Decisão</span>
                  <span className="phone__sub">2 sinais críticos detectados</span>
                </div>
                <div className="phone__card">
                  <span className="phone__tag">◳ CRIVO Pocket</span>
                  <span className="phone__sub">Novo microaprendizado disponível</span>
                </div>
                <span className="phone__label">Seu plano</span>
                <div className="phone__card phone__card--plan">
                  <span className="phone__sub">Próximo passo sugerido</span>
                  <span className="phone__tag">CRIVO Pocket →</span>
                </div>
                <div className="phone__nav" aria-hidden="true">
                  <span className="is-active">Início</span>
                  <span>Estado</span>
                  <span>Pocket</span>
                  <span>Plano</span>
                  <span>Mais</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== ACADEMIA / ECOSSISTEMA ===================== */}
      <section className="section section--light" id="ecossistema">
        <div className="container">
          <span className="eyebrow">Academia &amp; Recursos CRIVO</span>
          <h2 className="h2">Recursos que ampliam sua evolução.</h2>
          <p className="lede">
            Conteúdos, trilhas e inteligência prática que fortalecem lideranças e organizam o conhecimento em ação.
          </p>

          <div className="eco-cards">
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 4 3 9l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </span>
              <h3>Academia CRIVO</h3>
              <p>Cursos e formações para líderes e times, com aplicação prática.</p>
            </article>
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="m10 9.5 5 2.5-5 2.5v-5Z" fill="currentColor"/></svg>
              </span>
              <h3>Conteúdos e vídeos</h3>
              <p>Vídeos, aulas e microconteúdos para aplicar hoje.</p>
            </article>
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/></svg>
              </span>
              <h3>Trilhas e materiais</h3>
              <p>Jornadas e materiais estruturados por tema e nível de liderança.</p>
            </article>
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M13 3v5h5M9.5 13h5M9.5 16.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </span>
              <h3>Artigos e guias</h3>
              <p>Artigos, guias e checklists para uso no dia a dia.</p>
            </article>
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="m16 10 5-3v10l-5-3v-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              </span>
              <h3>Webinars / Cases</h3>
              <p>Webinars, casos reais e entrevistas com especialistas.</p>
            </article>
            <article className="eco-tile">
              <span className="eco-tile__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <h3>Inteligência contínua</h3>
              <p>Relatórios, análises e insights para decisões cada vez melhores.</p>
            </article>
          </div>

          <p className="eco-foot">
            A Academia e os Recursos tornam o conhecimento acessível, organizado e sempre atualizado.
          </p>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="h2 h2--light h2--center">Conheça a plataforma por dentro.</h2>
          <div className="hero__ctas" style={{ justifyContent: "center" }}>
            <a href="/lp#diagnostico" className="btn btn--terra">
              Fazer Diagnóstico Inicial
            </a>
            <a href={PLATAFORMA_URL} className="btn btn--ghost">
              Acessar Portal
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
