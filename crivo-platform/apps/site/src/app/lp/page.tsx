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
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">Futuro do Trabalho · IA · Pessoas · Decisões</span>
            <h2 className="display">
              A IA amplia e acelera a capacidade das organizações.{" "}
              <span className="terra-text">A vantagem competitiva continuará sendo humana.</span>
            </h2>
            <span className="rule-terra" aria-hidden="true" />
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
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>
          <div className="hero__visual">
            <figure className="hero-card">
              <div
                className="hero-card__photo"
                style={{ backgroundImage: "url('/imagens/ia-boardroom.jpg')" }}
                role="img"
                aria-label="Executivos reunidos em boardroom noturno com a marca CRIVO"
              />
            </figure>
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
                Estrutura que transforma <span className="terra-text">inteligência</span> em{" "}
                <span className="terra-text">resultado</span>.
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
            <span className="cta-band__ic">{IC.bussola}</span>
            <div className="cta-band__text">
              <div className="t">
                Da leitura executiva <span className="terra-text">ao resultado sustentado.</span>
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
            <div className="journey-card">
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
            <span className="cta-band__ic">{IC.grafico}</span>
            <div className="cta-band__text">
              <div className="t">
                Do primeiro mapa à <span className="terra-text">evolução sustentada.</span>
              </div>
              <div className="s">CRIVO Plus™: projetos especiais em IA, cultura, dados, sucessão e transformação.</div>
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
                A norma gera urgência. A gestão sustenta a resposta.
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
                <ul>
                  <li>{IC.check} Desempenho em queda</li>
                  <li>{IC.check} Clima organizacional frágil</li>
                  <li>{IC.check} Afastamentos e rotatividade</li>
                  <li>{IC.check} Riscos legais e reputacionais</li>
                  <li>{IC.check} Decisões sem informação</li>
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
              <div className="t">Comece entendendo o momento da sua empresa.</div>
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
      <section id="quem-somos" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="qs-split">
            <div>
              <span className="eyebrow eyebrow--terra">Quem Somos</span>
              <h2 className="h2">
                Inteligência organizacional.
                <br />
                Decisão com critério.
                <br />
                <span className="terra-text">Evolução com evidência.</span>
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 16 }}>
                A CRIVO™ é uma consultoria estratégica de <strong>inteligência aplicada à gestão</strong>, criada
                para transformar liderança, cultura e governança em maturidade organizacional, execução consistente
                e resultados mensuráveis.
              </p>
              <p className="lede" style={{ marginBottom: 26, fontSize: 16 }}>
                Integramos método proprietário, desenvolvimento humano, dados e tecnologia para conectar{" "}
                <strong>diagnóstico, plano de ação, evidências e sustentação da liderança</strong> em uma jornada
                estruturada.
              </p>
              <Link href="/sobre" className="btn btn--terra">
                Conheça nossa história →
              </Link>
            </div>
            <div>
              <div
                className="qs-photo"
                style={{ backgroundImage: "url('/imagens/quem-somos-ia.jpg')" }}
                role="img"
                aria-label="Arte digital de perfil humano formado por redes de dados"
              />
              <div className="strip strip--2col">
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.pessoas}</span>
                  <strong>Pessoas</strong>
                  <p>Comportamento, cultura e liderança</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.chip}</span>
                  <strong>Inteligência Artificial</strong>
                  <p>Tecnologia como amplificadora de inteligência</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.grafico}</span>
                  <strong>Dados</strong>
                  <p>Informações estruturadas para decisões</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.alvo}</span>
                  <strong>Resultados</strong>
                  <p>Execução, impacto e evolução sustentável</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
