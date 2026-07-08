import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./plataforma.css";

export const metadata: Metadata = {
  title: "Plataforma CRIVO™ — Portal Executivo e Área do Líder",
  description:
    "Portal Executivo: indicadores, riscos, plano de ação, evidências e relatórios em um único ambiente. Área do Líder: ferramentas práticas para decidir, registrar decisões e sustentar a rotina.",
};

// Ícones de traço adicionais (fora do conjunto padrão de _site/icons.tsx),
// no mesmo estilo stroke ~1.6-1.8px — sem emoji.
const IcCadeado = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
  </svg>
);
const IcPulso = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 12h3.5l2-5.5 3.5 11 2-5.5H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcSino = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.5 1.4 5.5H4.6S6 14.5 6 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcCasa = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcPerfil = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 19c1-3.4 3.8-5.3 7-5.3s6 1.9 7 5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcMais = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export default function PlataformaPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ 06 · PORTAL EXECUTIVO ============ */}
      <section id="portal" className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Portal Executivo CRIVO™</span>
            <h1 className="display">
              A visão executiva da<br />
              organização para transformar<br />
              diagnóstico em <span className="terra-text">ação,</span><br />
              <span className="terra-text">evidências</span> e <span className="terra-text">resultado.</span>
            </h1>
            <span className="rule-terra" aria-hidden="true" />
            <p className="hero__sub">
              Informação estratégica para decisões mais rápidas, prioridades claras, plano de ação acompanhado e
              resultados sustentáveis.
            </p>
            <div className="hero__ctas">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>

          <div className="hero__visual">
            <div
              className="laptop"
              role="img"
              aria-label="Portal Executivo CRIVO: Visão Geral com desempenho geral 72/100, tendência +14 pontos, 8 iniciativas em andamento e 81% de execução do plano"
            >
              <div className="laptop__screen">
                <div className="pf-laptop-body">
                  <nav className="pf-sidebar" aria-hidden="true">
                    <span className="pf-sidebar__brand">CRIVO™</span>
                    <span className="is-active">Visão Geral</span>
                    <span>Indicadores</span>
                    <span>Prioridades</span>
                    <span>Plano de ação</span>
                    <span>Evidências</span>
                    <span>Resultados</span>
                    <span>Relatórios</span>
                  </nav>
                  <div className="pf-main">
                    <div className="pf-main__head">
                      <span className="pf-main__title">Visão Geral</span>
                      <div className="pf-selects">
                        <span className="pf-select">Empresa exemplo SA ⌄</span>
                        <span className="pf-select">Trimestre atual ⌄</span>
                      </div>
                    </div>

                    <div className="pf-kpis">
                      <div className="pf-kpi">
                        <span className="pf-kpi__label">Indicadores-chave</span>
                        <strong className="pf-kpi__num">72/100</strong>
                        <span className="pf-kpi__sub">Desempenho geral</span>
                      </div>
                      <div className="pf-kpi">
                        <span className="pf-kpi__label">Tendência</span>
                        <strong className="pf-kpi__num">+14 pts</strong>
                        <span className="pf-kpi__sub">vs. trimestre anterior</span>
                      </div>
                      <div className="pf-kpi">
                        <span className="pf-kpi__label">Prioridades ativas</span>
                        <strong className="pf-kpi__num">8</strong>
                        <span className="pf-kpi__sub">Iniciativas em andamento</span>
                      </div>
                      <div className="pf-kpi">
                        <span className="pf-kpi__label">Execução do plano</span>
                        <strong className="pf-kpi__num">81%</strong>
                        <span className="pf-kpi__sub">Concluída</span>
                      </div>
                    </div>

                    <div className="pf-charts">
                      <div className="pf-chart">
                        <span className="pf-chart__label">Indicadores por dimensão</span>
                        <ul className="pf-bars" aria-hidden="true">
                          <li>Pessoas<i style={{ width: "72%" }} /></li>
                          <li>Processos<i style={{ width: "58%" }} /></li>
                          <li>Liderança<i style={{ width: "80%" }} /></li>
                          <li>Cultura<i style={{ width: "66%" }} /></li>
                        </ul>
                      </div>
                      <div className="pf-chart">
                        <span className="pf-chart__label">Distribuição de evidências</span>
                        <ul className="pf-legend">
                          <li><i className="a" />Alta</li>
                          <li><i className="b" />Média</li>
                          <li><i className="c" />Baixa</li>
                          <li><i className="d" />A validar</li>
                        </ul>
                      </div>
                    </div>

                    <div className="pf-evidence">
                      <span>
                        <strong className="pf-evidence__num">96</strong>
                        <span className="pf-evidence__sub">evidências registradas</span>
                      </span>
                      <a href="#diagnostico">Ver detalhes →</a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="laptop__base" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="container">
          {/* Faixa de 4 ícones-features */}
          <div className="pf-feat-row">
            <div className="pf-feat">
              <span className="pf-feat__ic">{IC.pessoas}</span>
              <strong>Diagnósticos</strong>
            </div>
            <div className="pf-feat">
              <span className="pf-feat__ic">{IC.grafico}</span>
              <strong>Dashboard executivo</strong>
            </div>
            <div className="pf-feat">
              <span className="pf-feat__ic">{IC.prancheta}</span>
              <strong>Plano de ação</strong>
            </div>
            <div className="pf-feat">
              <span className="pf-feat__ic">{IC.documento}</span>
              <strong>Evidências e resultados</strong>
            </div>
          </div>

          {/* Tudo em um único ambiente */}
          <div className="pf-strip">
            <div className="pf-strip__label">Tudo em um único ambiente</div>
            <div className="chips">
              <span className="chip">{IC.check}Indicadores estratégicos</span>
              <span className="chip">{IC.check}Visão executiva em tempo real</span>
              <span className="chip">{IC.check}Prioridades claras</span>
              <span className="chip">{IC.check}Decisões com base em evidências</span>
            </div>
          </div>

          {/* CRIVO Plus™ */}
          <div className="pf-strip">
            <div className="pf-strip__label">
              CRIVO Plus™
              <small>Inteligência ampliada para decisões que geram impacto.</small>
            </div>
            <div className="chips">
              <span className="chip">{IC.pessoas}People Analytics</span>
              <span className="chip">{IC.chip}Governança de IA</span>
              <span className="chip">{IC.grafico}Custos Invisíveis</span>
              <span className="chip">{IC.prancheta}Workforce Planning</span>
              <span className="chip">{IC.escudo}Transformação Cultural</span>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__ic">{IC.alvo}</span>
            <div className="cta-band__text">
              <div className="t">
                Da leitura executiva ao <span className="terra-text">resultado</span> sustentado.
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-light">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 07 · ÁREA DO LÍDER ============ */}
      <section id="area-do-lider" className="hero" style={{ paddingTop: 96, minHeight: "auto" }}>
        <div className="container">
          <div className="pf-leader">
            {/* Coluna esquerda: copy */}
            <div className="hero__copy" style={{ maxWidth: "none" }}>
              <span className="eyebrow eyebrow--terra">Área do Líder</span>
              <h2 className="display">
                A prática da<br />
                <span className="terra-text" style={{ fontStyle: "italic" }}>liderança</span><br />
                em uma rotina guiada.
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="hero__sub">
                Um ambiente individual para apoiar líderes a decidir com mais clareza, registrar decisões reais,
                desenvolver competências e sustentar a execução.
              </p>

              <div className="pf-mini-row">
                <div className="pf-mini">
                  <span className="pf-mini__ic">{IC.escudo}</span>
                  <span>Privacidade protegida</span>
                </div>
                <div className="pf-mini">
                  <span className="pf-mini__ic">{IC.grafico}</span>
                  <span>Foco no que realmente importa</span>
                </div>
                <div className="pf-mini">
                  <span className="pf-mini__ic">{IcCadeado}</span>
                  <span>Dados confidenciais</span>
                </div>
              </div>

              <div className="hero__ctas">
                <a href="#diagnostico" className="btn btn--terra">
                  Gerar MAPA →
                </a>
                <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                  Agendar conversa estratégica →
                </a>
              </div>
            </div>

            {/* Coluna central: mockup iPhone */}
            <div className="phone-stage">
              <div
                className="phone"
                role="img"
                aria-label="App CRIVO: saudação ao líder, próximo passo registrar decisão, atalhos e visão rápida com coerência decisória 78"
              >
                <span className="phone__notch" aria-hidden="true" />
                <div className="phone__screen">
                  <div className="phone__bar" aria-hidden="true">
                    <span>9:41</span>
                    <span className="phone__brand">CRIVO™</span>
                    <span className="pf-phone-bell">{IcSino}<i /></span>
                  </div>
                  <div className="phone__greet">
                    <span className="phone__hello">Bem-vindo, Líder.</span>
                    <span className="phone__date">Qual será o foco de hoje?</span>
                  </div>

                  <span className="phone__label">Próximo passo</span>
                  <div className="phone__card">
                    <span className="phone__tag">Registrar decisão →</span>
                    <span className="phone__sub">Reunião de planejamento comercial</span>
                  </div>

                  <div className="pf-grid" aria-hidden="true">
                    <div className="pf-tile">{IcPulso}<span>Meu Estado</span></div>
                    <div className="pf-tile">{IC.bussola}<span>Pocket</span></div>
                    <div className="pf-tile">{IC.documento}<span>Registro de Decisão</span></div>
                    <div className="pf-tile">{IC.alvo}<span>ICD / Radar</span></div>
                    <div className="pf-tile">{IC.capelo}<span>Academia</span></div>
                    <div className="pf-tile">{IC.pessoas}<span>Mentor</span></div>
                  </div>

                  <span className="phone__label">Visão rápida</span>
                  <div className="pf-quick">
                    <div className="phone__ring phone__ring--lg">
                      <strong>78</strong>
                      <em>Coerência decisória</em>
                    </div>
                    <ul className="pf-quick__bars" aria-hidden="true">
                      <li>Clareza<i style={{ width: "80%" }} /></li>
                      <li>Critério<i style={{ width: "70%" }} /></li>
                      <li>Alinhamento<i style={{ width: "76%" }} /></li>
                      <li>Sustentação<i style={{ width: "68%" }} /></li>
                    </ul>
                  </div>

                  <div className="pf-tabbar" aria-hidden="true">
                    <span className="is-active">{IcCasa}</span>
                    <span>{IcPulso}</span>
                    <span className="is-add">{IcMais}</span>
                    <span>{IC.livro}</span>
                    <span>{IcPerfil}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita: timeline vertical */}
            <ol className="pf-timeline">
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.bussola}</span>
                <strong>Pocket prepara</strong>
                <span>Orienta antes de decisões e conversas importantes.</span>
              </li>
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.documento}</span>
                <strong>Registro organiza</strong>
                <span>Registre decisões reais e crie histórico de coerência.</span>
              </li>
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.alvo}</span>
                <strong>ICD mede</strong>
                <span>Acompanhe a coerência das suas decisões.</span>
              </li>
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.capelo}</span>
                <strong>Academia desenvolve</strong>
                <span>Cursos e trilhas para fortalecer sua liderança.</span>
              </li>
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.pessoas}</span>
                <strong>Mentor apoia</strong>
                <span>Converse, reflita e evolua com orientação.</span>
              </li>
              <li className="pf-timeline__item">
                <span className="pf-timeline__ic">{IC.grafico}</span>
                <strong>Dashboard acompanha</strong>
                <span>Veja sua evolução e próximos passos.</span>
              </li>
            </ol>
          </div>

          <div className="cta-band" style={{ marginTop: 48 }}>
            <span className="cta-band__ic">{IC.alvo}</span>
            <div className="cta-band__text">
              <div className="t">
                Da decisão individual à <span className="terra-text">liderança</span> sustentada.
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-light">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>

          <p className="pf-motto">
            <span className="rule-terra" aria-hidden="true" />
            Clareza para decidir. Estrutura para agir. Evidência para evoluir.
            <span className="rule-terra" aria-hidden="true" />
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
