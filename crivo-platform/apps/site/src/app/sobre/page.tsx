import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./sobre.css";

export const metadata: Metadata = {
  title: "Sobre a CRIVO™ — quem somos e os fundadores",
  description:
    "A CRIVO™ é uma consultoria estratégica de inteligência aplicada à gestão. Conheça nossa missão, visão, valores e a trajetória de Rodrigo Oliveira e Viviani Ostan, fundadores da CRIVO™.",
};

// /sobre — 2 seções das telas finais aprovadas: 19 Quem Somos · 20 Como
// Nasceu / Fundadores. Copy fiel às telas, estrutura fiel ao padrão de
// ../lp/page.tsx (mesma "mão").
export default function SobrePage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ 19 · QUEM SOMOS ============ */}
      <section id="quem-somos" className="section section--light">
        <div className="container">
          <div className="qs-split">
            <div>
              <span className="eyebrow eyebrow--terra">Quem Somos</span>
              <h1 className="h2">
                Inteligência organizacional.
                <br />
                Decisão com critério.
                <br />
                <span className="terra-text">Evolução com evidência.</span>
              </h1>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                A CRIVO™ é uma consultoria estratégica de <strong>inteligência aplicada à gestão</strong>, criada
                para transformar liderança, cultura e governança em maturidade organizacional, execução consistente
                e resultados mensuráveis.
              </p>
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                Integramos método proprietário, desenvolvimento humano, dados e tecnologia para conectar{" "}
                <strong>diagnóstico, plano de ação, evidências e sustentação da liderança</strong> em uma jornada
                estruturada.
              </p>
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                Nossa abordagem nasce da convergência entre experiência executiva, ciência do comportamento e visão
                organizacional. Essa base se traduz em um sistema aplicado para fortalecer decisões, cultura,
                responsabilidades e execução.
              </p>
              <p className="lede" style={{ marginBottom: 0, fontSize: 16 }}>
                Em um novo ciclo marcado por inteligência artificial, novas gerações, fatores psicossociais e maior
                complexidade empresarial, organizamos a inteligência necessária para transformar{" "}
                <strong>intenção em rotina, decisão em ação e evolução</strong> em <strong>legado de gestão</strong>.
              </p>
            </div>
            <div>
              <div
                className="qs-photo"
                style={{ backgroundImage: "url('/imagens/quem-somos-lideranca.jpg')" }}
                role="img"
                aria-label="Liderança em ambiente corporativo"
              />
              <div className="strip strip--2col">
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.pessoas}</span>
                  <strong>PESSOAS</strong>
                  <p>Comportamento, cultura e liderança</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.chip}</span>
                  <strong>INTELIGÊNCIA ARTIFICIAL</strong>
                  <p>Tecnologia como amplificadora de inteligência</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.grafico}</span>
                  <strong>DADOS</strong>
                  <p>Informações estruturadas para decisões</p>
                </div>
                <div className="strip-card">
                  <span className="strip-card__ic">{IC.alvo}</span>
                  <strong>RESULTADOS</strong>
                  <p>Execução, impacto e evolução sustentável</p>
                </div>
              </div>
            </div>
          </div>

          {/* Missão · Visão · Valores */}
          <div className="sobre-mvv">
            <div className="sobre-mvv__col">
              <span className="sobre-mvv__ic">{IC.bussola}</span>
              <span className="sobre-mvv__title">Missão</span>
              <span className="sobre-mvv__rule" aria-hidden="true" />
              <p>Elevar o padrão das decisões que moldam o futuro das organizações.</p>
            </div>
            <div className="sobre-mvv__col">
              <span className="sobre-mvv__ic">{IC.telescopio}</span>
              <span className="sobre-mvv__title">Visão</span>
              <span className="sobre-mvv__rule" aria-hidden="true" />
              <p>
                Transformar Decision Intelligence em referência nacional de liderança e gestão, impulsionando
                organizações mais conscientes, ágeis e sustentáveis.
              </p>
            </div>
            <div className="sobre-mvv__col">
              <span className="sobre-mvv__ic">{IC.escudo}</span>
              <span className="sobre-mvv__title">Valores</span>
              <span className="sobre-mvv__rule" aria-hidden="true" />
              <p>
                Os valores da CRIVO™ orientam a forma como pensamos, decidimos e construímos organizações mais
                maduras, consistentes e preparadas para o futuro.
              </p>
              <ul className="sobre-mvv__values">
                <li>Clareza</li>
                <li>Governança</li>
                <li>Critério</li>
                <li>Integridade</li>
                <li>Coragem</li>
                <li>Responsabilidade</li>
                <li>Coerência</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 20 · COMO NASCEU / FUNDADORES ============ */}
      <section id="como-nasceu" className="section section--light">
        <div className="container">
          <div className="qs-split">
            <div>
              <span className="eyebrow eyebrow--terra">Como Nasceu a CRIVO™</span>
              <h2 className="h2">
                Duas trajetórias.
                <br />
                Um mesmo <span className="terra-text">propósito.</span>
              </h2>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                A CRIVO™ nasceu da convergência entre experiência executiva real e uma inquietação comum:
                organizações perdem clareza, coerência e capacidade de execução quando decisões críticas se afastam
                do contexto, das pessoas e da estratégia.
              </p>
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                Transformamos essa vivência em uma atuação aplicada, unindo visão de negócio, estratégia, liderança,
                governança e inteligência organizacional para apoiar empresas que precisam decidir melhor e evoluir
                com consistência.
              </p>
              <p className="lede" style={{ marginBottom: 16, fontSize: 16 }}>
                No último ano, aprofundamos essa base com estudo e formação contínua em desenvolvimento humano,
                neurociência aplicada, inteligência artificial, conselho consultivo, universidade de negócios,
                mentoria e tomada de decisão.
              </p>
              <p className="sobre-final-line">Experiência executiva. Critério para decidir. Método para evoluir.</p>
            </div>
            <div>
              <div
                className="qs-photo"
                style={{ backgroundImage: "url('/imagens/quem-somos-lideranca.jpg')" }}
                role="img"
                aria-label="Fundadores da CRIVO™ em ambiente corporativo"
              />
            </div>
          </div>

          {/* Os Fundadores */}
          <span className="eyebrow eyebrow--terra" style={{ marginTop: 56 }}>
            Os Fundadores
          </span>

          <div className="sobre-founders-grid">
            <div className="sobre-founder-card">
              <strong className="sobre-founder-card__name">Rodrigo Oliveira</strong>
              <span className="sobre-founder-card__role">
                Fundador • Estratégia, Pessoas, Governança e Transformação
              </span>
              <p>
                Executivo com mais de 25 anos de trajetória em ambientes de alta exigência, liderando agendas de
                pessoas, cultura, estratégia, governança e transformação organizacional em grandes empresas no
                Brasil e na América Latina.
              </p>
              <p>
                Une visão de negócio à execução, com experiência em liderança, relações trabalhistas, sucessão,
                integração pós-aquisição e mudanças organizacionais com impacto real.
              </p>
              <p>
                Sua base também se fortalece por estudos e formação em desenvolvimento humano, neurociência
                aplicada, inteligência artificial, mentoria, conselho consultivo, universidade de negócios e tomada
                de decisão.
              </p>
              <div className="chips">
                <span className="chip">{IC.grafico} Visão de negócio</span>
                <span className="chip">{IC.bussola} Estratégia</span>
                <span className="chip">{IC.pessoas} Liderança</span>
                <span className="chip">{IC.escudo} Governança</span>
                <span className="chip">{IC.engrenagem} Transformação organizacional</span>
              </div>
            </div>

            <div className="sobre-founder-card">
              <strong className="sobre-founder-card__name">Viviani Ostan</strong>
              <span className="sobre-founder-card__role">Fundadora • Negócios, Liderança e Performance</span>
              <p>
                Executiva do mercado financeiro, e estratégia de negócios e liderança, com 19 anos de experiência em
                grandes instituições, liderando operações, crescimento, relacionamento estratégico e ambientes de
                alta performance.
              </p>
              <p>
                Conecta vivência executiva, inteligência emocional e desenvolvimento humano para fortalecer
                lideranças com mais clareza, confiança e equilíbrio, com atenção especial à formação de mulheres em
                posições de influência.
              </p>
              <p>
                Sua trajetória também incorpora mentoria, desenvolvimento humano e comportamento, reforçando a base
                humana e estratégica que sustenta a atuação da CRIVO™.
              </p>
              <div className="chips">
                <span className="chip">{IC.grafico} Mercado financeiro</span>
                <span className="chip chip--active">{IC.alvo} Negócios</span>
                <span className="chip">{IC.pessoas} Liderança</span>
                <span className="chip">{IC.escudo} Alta performance</span>
                <span className="chip">{IC.cerebro} Desenvolvimento humano</span>
              </div>
            </div>
          </div>

          {/* Banda final navy: Da experiência executiva à inteligência aplicada */}
          <div className="sobre-founders-band">
            <div className="sobre-founders-band__text">
              Da experiência executiva <span className="terra-text">à inteligência aplicada.</span>
            </div>
            <div className="sobre-founders-band__pillars">
              <div className="sobre-founders-pillar">
                <span className="sobre-founders-pillar__ic">{IC.grafico}</span>
                <span>Visão de negócio</span>
              </div>
              <div className="sobre-founders-pillar">
                <span className="sobre-founders-pillar__ic">{IC.bussola}</span>
                <span>Estratégia</span>
              </div>
              <div className="sobre-founders-pillar">
                <span className="sobre-founders-pillar__ic">{IC.pessoas}</span>
                <span>Liderança</span>
              </div>
              <div className="sobre-founders-pillar">
                <span className="sobre-founders-pillar__ic">{IC.escudo}</span>
                <span>Governança</span>
              </div>
            </div>
          </div>

          <p className="sobre-founders-tagline">
            <span className="rule" aria-hidden="true" />
            Clareza para decidir. Estrutura para agir. Evidência para evoluir.
            <span className="rule" aria-hidden="true" />
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
