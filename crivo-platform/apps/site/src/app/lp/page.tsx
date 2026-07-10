import type { Metadata } from "next";
import Link from "next/link";
import { LpEffects } from "./LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC, Seals } from "../_site/icons";
import "./lp.css";

export const metadata: Metadata = {
  title: "CRIVO™ — Decision Intelligence",
  description:
    "Decidir com clareza. Liderar com coerência. Evoluir com sustentação. Para empresas que querem converter estratégia em execução, liderança em coerência e cultura em resultados, com Método CRIVO™, dados e evidências.",
};

// Home — 6 seções na ordem das telas finais aprovadas (ORDEM_TELAS_FINAIS):
// 01 Hero · 02 IA + Vantagem Humana · 03 Arquitetura · 08 Soluções ·
// 16 NR-1/Fatores Psicossociais · 19 Quem Somos. Copy fiel às telas.
export default function LandingPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ 01 · HERO PRINCIPAL (tela 01) ============ */}
      <section id="hero" className="hero hero--1 section--dark">
        <div
          className="hero__bleed"
          style={{ backgroundImage: "url('/imagens/hero-noturno.jpg')" }}
          role="img"
          aria-label="Executivos observando o skyline da cidade ao anoitecer"
        />
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Transformação Organizacional · Liderança · Governança</span>
            <h1 className="display">
              Decidir com <span className="terra-text">clareza</span>.<br />
              Liderar com <span className="terra-text">coerência</span>.<br />
              Evoluir com <span className="terra-text">sustentação</span>.
            </h1>
            <span className="rule-terra" aria-hidden="true" />
            <p className="hero__sub">
              Para empresas que querem converter estratégia em execução, liderança em coerência e cultura em
              resultados, com Método CRIVO™, dados e evidências.
            </p>
            <div className="hero__ctas">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA Executivo CRIVO™ →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--ghost">
                Agendar conversa estratégica →
              </a>
            </div>
            <Seals dark items={["Sem custo", "Confidencial", "Leitura executiva inicial"]} />
          </div>
        </div>

        {/* Fileira de 4 cards creme (base da dobra, tela 01) */}
        <div className="container">
          <div className="strip">
            <div className="strip-card">
              <span className="strip-card__ic">{IC.alvo}</span>
              <strong>Método CRIVO™</strong>
              <p>Consciência · Responsabilidade · Integração · Valores · Organização</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.bussola}</span>
              <strong>ICD™ — Coerência Decisória</strong>
              <p>Clareza · Critério · Alinhamento · Sustentação</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.chip}</span>
              <strong>Governança para a era da IA</strong>
              <p>Critérios, cultura e responsabilidade para integrar pessoas, processos e tecnologia.</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.prancheta}</span>
              <strong>Diagnósticos e soluções sob medida</strong>
              <p>NR-1, riscos psicossociais, liderança, cultura e governança.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 02 · IA + VANTAGEM HUMANA (tela 02) ============ */}
      <section id="ia-vantagem-humana" className="hero hero--2 section--dark">
        <div
          className="hero__bleed"
          style={{ backgroundImage: "url('/imagens/ia-boardroom.jpg')" }}
          role="img"
          aria-label="Executivos reunidos em boardroom noturno com a marca CRIVO"
        />
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Futuro do Trabalho · IA · Pessoas · Decisões</span>
            <h2 className="display">
              A IA amplia e acelera
              <br />a capacidade das organizações.{" "}
              <span className="terra-text">A vantagem competitiva continuará sendo humana.</span>
            </h2>
            <p className="hero__sub">
              O diferencial está no julgamento, no critério e na qualidade das decisões que orientam tecnologia,
              liderança, cultura e evolução organizacional.
            </p>
            <p className="hero__bold">
              Tecnologia amplia capacidade. Decisões definem direção. Liderança sustenta a evolução.
            </p>
            <div className="hero__ctas">
              <Link href="/solucoes" className="btn btn--terra">
                Conhecer Soluções CRIVO →
              </Link>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--ghost-terra">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>
        </div>

        {/* Fileira de 4 cards creme (tela 02) */}
        <div className="container">
          <div className="strip">
            <div className="strip-card">
              <span className="strip-card__ic">{IC.cerebro}</span>
              <strong>IA integrada à gestão</strong>
              <p>Integração entre tecnologia, pessoas, processos e decisões.</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.grafico}</span>
              <strong>Trabalho em evolução</strong>
              <p>Competências, adaptação e aprendizagem para novas formas de trabalho.</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.pessoas}</span>
              <strong>Liderança adaptativa</strong>
              <p>Capacidade para lidar com mudanças, riscos psicossociais e responsabilidades ampliadas.</p>
            </div>
            <div className="strip-card">
              <span className="strip-card__ic">{IC.escudo}</span>
              <strong>Governança responsável</strong>
              <p>Limites, rituais e evidências para orientar tecnologia, cultura e resultado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 03 · ARQUITETURA CRIVO™ (tela 03) ============ */}
      <section id="arquitetura" className="section section--light">
        <div className="container">
          <div className="arch-hero">
            <div>
              <span className="eyebrow eyebrow--terra">Arquitetura CRIVO™</span>
              <h2 className="h2">
                Estrutura que transforma
                <br />
                <span className="terra-text">inteligência</span> em <span className="terra-text">resultado</span>.
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede">
                A CRIVO™ combina método proprietário, inteligência decisória, gestão executiva e desenvolvimento da
                liderança em uma jornada integrada e mensurável.
              </p>
            </div>
            <div
              className="arch-photo"
              style={{ backgroundImage: "url('/imagens/arquitetura-reuniao.jpg')" }}
              role="img"
              aria-label="Executivos analisando o dashboard CRIVO em sala de reunião"
            />
          </div>

          <div className="arch">
            <div className="arch-card">
              <span className="arch-card__ic">{IC.alvo}</span>
              <strong>Método CRIVO™</strong>
              <p>Metodologia proprietária para estruturar leitura, decisão, execução e evolução.</p>
              <Link href="/metodo#metodo">Saiba mais →</Link>
            </div>
            <div className="arch-card">
              <span className="arch-card__ic">{IC.bussola}</span>
              <strong>ICD™</strong>
              <span className="sub">Índice de Coerência Decisória</span>
              <p>Métrica proprietária para avaliar clareza, critério, alinhamento e sustentação.</p>
              <Link href="/metodo#icd">Saiba mais →</Link>
            </div>
            <div className="arch-card">
              <span className="arch-card__ic">{IC.grafico}</span>
              <strong>Portal Executivo</strong>
              <p>Indicadores, riscos, plano de ação, evidências e relatórios em um único ambiente.</p>
              <Link href="/plataforma#portal">Saiba mais →</Link>
            </div>
            <div className="arch-card">
              <span className="arch-card__ic">{IC.pessoas}</span>
              <strong>Área do Líder</strong>
              <p>Ferramentas práticas para apoiar decisões, registrar aprendizados e sustentar a rotina.</p>
              <Link href="/plataforma#area-do-lider">Saiba mais →</Link>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__ic">{IC.escudo}</span>
            <div className="cta-band__text">
              <div className="t">
                Da leitura executiva
                <br />
                ao <span className="terra-text">resultado</span> sustentado.
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA Executivo →
              </a>
              <Link href="/solucoes" className="btn btn--outline-light">
                Conhecer Soluções CRIVO™ →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 08 · SOLUÇÕES CRIVO™ (tela 08) ============ */}
      <section id="solucoes" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="sol-head">
            <div>
              <span className="eyebrow eyebrow--terra">Soluções CRIVO™</span>
              <h2 className="h2">
                Uma jornada para transformar <span className="terra-text">decisão</span> em{" "}
                <span className="terra-text">resultado</span>.
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 0 }}>
                A CRIVO orienta o próximo passo da empresa com leitura executiva, método, tecnologia e evidências.
              </p>
            </div>
            <img
              className="sol-art"
              src="/imagens/solucoes-horizonte.jpg"
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
          </div>

          <div className="journey" style={{ marginTop: 0 }}>
            <div className="journey-card journey-card--hl">
              <span className="journey-card__num">1</span>
              <span className="journey-card__ic">{IC.alvo}</span>
              <strong>Mapa Executivo</strong>
              <span className="tag">Clareza inicial</span>
              <p>Entenda o momento da empresa e identifique prioridades.</p>
              <a href="#diagnostico">Gerar Mapa →</a>
            </div>
            <div className="journey-card">
              <span className="journey-card__num">2</span>
              <span className="journey-card__ic">{IC.lupa}</span>
              <strong>Diagnóstico</strong>
              <span className="tag">Leitura aprofundada</span>
              <p>Mapeie riscos, cultura, liderança, rotina e fatores críticos.</p>
              <Link href="/solucoes#diagnostico-sol">Solicitar análise →</Link>
            </div>
            <div className="journey-card">
              <span className="journey-card__num">3</span>
              <span className="journey-card__ic">{IC.pessoas}</span>
              <strong>Execução e Liderança</strong>
              <span className="tag">Rotina, decisão e desenvolvimento</span>
              <p>Transforme prioridades em plano, cadência e liderança aplicada.</p>
              <Link href="/solucoes#gestao-da-rotina">Conhecer jornada →</Link>
            </div>
            <div className="journey-card">
              <span className="journey-card__num">4</span>
              <span className="journey-card__ic">{IC.escudo}</span>
              <strong>Evolução e Advisory</strong>
              <span className="tag">Governança e sustentação</span>
              <p>Acompanhe ciclos, evidências e decisões críticas em alta gestão.</p>
              <Link href="/solucoes#evolucao">Ver soluções →</Link>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__bar" aria-hidden="true" />
            <div className="cta-band__text">
              <div className="t">
                Do primeiro mapa à
                <br />
                <span className="terra-text">evolução sustentada.</span>
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA Executivo →
              </a>
              <Link href="/solucoes" className="btn btn--outline-light">
                Conhecer Soluções CRIVO™ →
              </Link>
            </div>
          </div>

          <p className="plus-line">
            <span className="plus-line__rule" aria-hidden="true" />
            <span>
              <strong>CRIVO Plus™:</strong> projetos especiais em IA, cultura, dados, sucessão e transformação.
            </span>
            <span className="plus-line__rule" aria-hidden="true" />
          </p>
        </div>
      </section>

      {/* ============ 16 · NR-1 / FATORES PSICOSSOCIAIS (tela 16) ============ */}
      <section id="nr1" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="nr1-hero">
            <div>
              <span className="eyebrow eyebrow--terra">NR-1 · Fatores Psicossociais</span>
              <h2 className="h2">
                A NR-1 tornou visível um problema que já impactava <span className="terra-text">cultura</span>,{" "}
                <span className="terra-text">liderança</span> e <span className="terra-text">resultado</span>.
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 8 }}>
                A conformidade é apenas o ponto de partida. O desafio real está em entender como pressão, rotina,
                comunicação, liderança e decisões afetam a saúde das pessoas, a consistência da gestão e os
                resultados da organização.
              </p>
              <p className="hl-line">
                {IC.escudo}
                <span>
                  A norma gera urgência. <span className="terra-text">A gestão sustenta a resposta.</span>
                </span>
              </p>
            </div>
            <div
              className="nr1-photo"
              style={{ backgroundImage: "url('/imagens/nr1-executivo.jpg')" }}
              role="img"
              aria-label="Executivo de braços cruzados observando a cidade pela janela do escritório"
            >
              <div className="nr1-dark">
                <strong>Fatores psicossociais não tratados geram impactos reais e custos invisíveis.</strong>
                <span className="rule-terra" aria-hidden="true" />
                {/* Tela 16: cada item tem ícone PRÓPRIO (não check). */}
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 6l6 6 4-4 8 8M21 12v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Desempenho em queda
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19M16 5.5a3.2 3.2 0 0 1 0 5M17.5 14.6c1.6.6 2.6 1.9 3 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Clima organizacional frágil
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 20s-7-4.6-8.6-9A4.8 4.8 0 0 1 12 6.4 4.8 4.8 0 0 1 20.6 11C19 15.4 12 20 12 20z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M7 12h3l1.5-2.5 2 4L15 11h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Afastamentos e rotatividade
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 4v16M6 6.5h12M12 20h4M8 20h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M6 6.5 3.5 12a2.6 2.6 0 0 0 5 0L6 6.5zM18 6.5 15.5 12a2.6 2.6 0 0 0 5 0L18 6.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                    Riscos legais e reputacionais
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 1 3.6 10.8c-.8.6-1.1 1.3-1.1 2.2h-5c0-.9-.3-1.6-1.1-2.2A6 6 0 0 1 12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Decisões sem informação
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="nr1-grid">
            <div className="nr1-card">
              <div className="nr1-card__head">
                <span className="nr1-card__ic">{IC.alerta}</span>
                <strong>O que está em jogo</strong>
              </div>
              <ul className="checks">
                <li>{IC.check} Exposição legal e trabalhista</li>
                <li>{IC.check} Sinais de desgaste organizacional</li>
                <li>{IC.check} Pressão sobre líderes e equipes</li>
                <li>{IC.check} Falhas de comunicação, prioridade e rotina</li>
                <li>{IC.check} Custos invisíveis em retrabalho e afastamentos</li>
              </ul>
            </div>
            <div className="nr1-card">
              <div className="nr1-card__head">
                <span className="nr1-card__ic">{IC.pessoas}</span>
                <strong>Como a CRIVO apoia</strong>
              </div>
              <ul className="checks">
                <li>{IC.check} Diagnóstico estruturado</li>
                <li>{IC.check} Pesquisa aplicada</li>
                <li>{IC.check} Análise executiva</li>
                <li>{IC.check} Plano de ação</li>
                <li>{IC.check} Evidências e acompanhamento</li>
              </ul>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__ic">{IC.alvo}</span>
            <div className="cta-band__text">
              <div className="t">
                Comece entendendo o momento da <span className="terra-text">sua empresa.</span>
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA Executivo →
              </a>
              <Link href="/solucoes#diagnostico-sol" className="btn btn--outline-light">
                Conhecer Diagnóstico CRIVO™ →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 19 · QUEM SOMOS (tela 19) ============ */}
      <section id="quem-somos" className="section section--light qs-sec" style={{ paddingTop: 0, paddingBottom: 56 }}>
        <div className="qs-hero">
          <div
            className="qs-hero__bleed"
            style={{ backgroundImage: "url('/imagens/quem-somos-ia.jpg')" }}
            role="img"
            aria-label="Arte digital de perfil humano formado por redes de dados"
          />
          <div className="container qs-hero__inner">
            <div className="qs-hero__copy">
              <span className="eyebrow eyebrow--terra">Quem Somos</span>
              <span className="rule-terra" aria-hidden="true" style={{ margin: "10px 0 18px" }} />
              <h2 className="h2">
                Inteligência organizacional.
                <br />
                Decisão com critério.
                <br />
                <span className="terra-text">Evolução com evidência.</span>
              </h2>
              <p className="qs-p">
                A CRIVO™ é uma consultoria estratégica de <strong>inteligência aplicada à gestão</strong>, criada
                para transformar liderança, cultura e governança em maturidade organizacional, execução consistente
                e resultados mensuráveis.
              </p>
              <p className="qs-p">
                Integramos método proprietário, desenvolvimento humano, dados e tecnologia para conectar{" "}
                <strong>diagnóstico, plano de ação, evidências e sustentação da liderança</strong> em uma jornada
                estruturada.
              </p>
              <p className="qs-p">
                Nossa abordagem nasce da convergência entre experiência executiva, ciência do comportamento e visão
                organizacional. Essa base se traduz em um sistema aplicado para fortalecer{" "}
                <strong>decisões, cultura, responsabilidades e execução</strong>.
              </p>
              <p className="qs-p">
                Em um novo ciclo marcado por inteligência artificial, novas gerações, fatores psicossociais e maior
                complexidade empresarial, organizamos a inteligência necessária para transformar{" "}
                <strong>intenção em rotina, decisão em ação e evolução</strong> em <strong>legado de gestão</strong>.
              </p>
              <Link href="/sobre" className="btn btn--terra" style={{ marginTop: 10 }}>
                Conheça nossa história →
              </Link>
            </div>
            <aside className="qs-callouts">
              <div className="qs-callout">
                <span className="qs-callout__ic">{IC.pessoas}</span>
                <div>
                  <strong>Pessoas</strong>
                  <p>Comportamento, cultura e liderança</p>
                </div>
              </div>
              <div className="qs-callout">
                <span className="qs-callout__ic">{IC.chip}</span>
                <div>
                  <strong>Inteligência Artificial</strong>
                  <p>Tecnologia como amplificadora de inteligência</p>
                </div>
              </div>
              <div className="qs-callout">
                <span className="qs-callout__ic">{IC.grafico}</span>
                <div>
                  <strong>Dados</strong>
                  <p>Informações estruturadas para decisões</p>
                </div>
              </div>
              <div className="qs-callout">
                <span className="qs-callout__ic">{IC.alvo}</span>
                <div>
                  <strong>Resultados</strong>
                  <p>Execução, impacto e evolução sustentável</p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Faixa Missão · Visão · Valores (base da tela 19) */}
        <div className="container">
          <div className="mvv">
            <div className="mvv__col">
              <span className="mvv__ic">{IC.bussola}</span>
              <strong className="mvv__title">Missão</strong>
              <span className="mvv__rule" aria-hidden="true" />
              <p>Elevar o padrão das decisões que moldam o futuro das organizações.</p>
            </div>
            <div className="mvv__col">
              <span className="mvv__ic">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m4 13 12.5-8.5 3 4.5L7 17.5zM7 17.5 5.5 21M9.8 15.6 11 20M16.5 4.5l3 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="5" cy="13.6" r="1.8" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <strong className="mvv__title">Visão</strong>
              <span className="mvv__rule" aria-hidden="true" />
              <p>
                Transformar Decision Intelligence em referência nacional de liderança e gestão, impulsionando
                organizações mais conscientes, ágeis e sustentáveis.
              </p>
            </div>
            <div className="mvv__col mvv__col--valores">
              <span className="mvv__ic">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 4h10l4 5.5L12 20 3 9.5 7 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M3 9.5h18M9.5 4 12 20 14.5 4M7 4l2.5 5.5M17 4l-2.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </span>
              <strong className="mvv__title">Valores</strong>
              <span className="mvv__rule" aria-hidden="true" />
              <p>
                Os valores da CRIVO™ orientam a forma como pensamos, decidimos e construímos organizações mais
                maduras, consistentes e preparadas para o futuro.
              </p>
              <div className="mvv__values">
                <ul>
                  <li>Clareza</li>
                  <li>Critério</li>
                  <li>Coragem</li>
                  <li>Coerência</li>
                </ul>
                <ul>
                  <li>Governança</li>
                  <li>Integridade</li>
                  <li>Responsabilidade</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
