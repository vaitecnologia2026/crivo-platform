import type { Metadata } from "next";
import { paginaSeo } from "../_site/seo";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { TrilhaSeo } from "../_site/TrilhaSeo";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./sobre.css";

export const metadata: Metadata = paginaSeo({
  titulo: "Sobre a CRIVO™ — quem somos e os fundadores",
  descricao:
    "A CRIVO™ é uma consultoria estratégica de inteligência aplicada à gestão. Conheça nossa missão, visão, valores e a trajetória de Rodrigo Oliveira e Viviani Ostan, fundadores da CRIVO™.",
  caminho: "/sobre",
});

// /sobre — 2 seções das telas finais aprovadas: 19 Quem Somos · 20 Como
// Nasceu / Fundadores. Copy fiel às telas, estrutura fiel ao padrão de
// ../lp/page.tsx (mesma "mão").
export default function SobrePage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ 19 · QUEM SOMOS (mesma estrutura da home) ============ */}
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
              <h1 className="h2">
                Inteligência organizacional.
                <br />
                Decisão com critério.
                <br />
                <span className="terra-text">Evolução com evidência.</span>
              </h1>
              <p className="qs-p">
                A CRIVO™ é uma consultoria estratégica de <strong>inteligência aplicada à gestão</strong>, criada
                para transformar liderança, cultura e governança em maturidade organizacional, execução consistente
                e resultados mensuráveis.
              </p>
              <p className="qs-p">
                Integramos método proprietário, experiência executiva, dados e tecnologia para conectar{" "}
                <strong>diagnóstico, prioridades, plano de ação, evidências e evolução</strong>.
              </p>
              <p className="qs-p">
                Unimos experiência executiva, ciência do comportamento e visão organizacional para fortalecer{" "}
                <strong>decisões, responsabilidades e execução</strong>.
              </p>
              <p className="qs-p">
                Em um contexto marcado por inteligência artificial, novas formas de trabalho e maior complexidade,
                ajudamos organizações a transformar{" "}
                <strong>intenção em rotina, decisão em ação e ação em evolução mensurável</strong>.
              </p>
              <a href="#como-nasceu" className="btn btn--terra" style={{ marginTop: 10 }}>
                Conheça nossa história →
              </a>
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
                  <p>Execução, impacto e evolução sustentada</p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Faixa Missão · Visão · Valores (base da tela 19) */}
        <div className="container" id="mvv" style={{ scrollMarginTop: 96 }}>
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
                Ser referência em inteligência organizacional e desenvolvimento da liderança, integrando pessoas,
                cultura, tecnologia e IA para elevar a qualidade das decisões, da execução e da performance com
                responsabilidade.
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
                  <li>
                    <span>
                      <strong>Clareza</strong> — tornar o complexo compreensível e o essencial visível.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Critério</strong> — decidir com evidências, experiência, contexto e visão de
                      consequências.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Responsabilidade</strong> — assumir escolhas, compromissos, consequências e resultados.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Integridade</strong> — manter coerência entre o que defendemos, decidimos e fazemos.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Governança</strong> — criar estruturas, papéis e controles que sustentem boas decisões.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Humanidade</strong> — colocar tecnologia a serviço das pessoas, preservando julgamento,
                      dignidade e responsabilidade humana.
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Evolução</strong> — aprender, medir, ajustar e melhorar continuamente.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 20 · COMO NASCEU / FUNDADORES ============ */}
      <section id="como-nasceu" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="qs-hero">
          <div
            className="qs-hero__bleed"
            style={{ backgroundImage: "url('/imagens/fundadores.jpeg')" }}
            role="img"
            aria-label="Os fundadores da CRIVO™ no escritório, com a marca ao fundo"
          />
          <div className="container qs-hero__inner">
            <div className="qs-hero__copy">
              <span className="eyebrow eyebrow--terra">Como Nasceu a CRIVO™</span>
              <span className="rule-terra" aria-hidden="true" style={{ margin: "10px 0 18px" }} />
              <h2 className="h2">
                Duas trajetórias.
                <br />
                Um mesmo <span className="terra-text">propósito.</span>
              </h2>
              <p className="qs-p">
                A CRIVO™ nasceu da convergência entre experiência executiva real e uma inquietação comum:
                organizações perdem clareza, coerência e capacidade de execução quando decisões críticas se afastam
                do contexto, das pessoas e da estratégia.
              </p>
              <p className="qs-p">
                Transformamos essa vivência em uma atuação aplicada, unindo visão de negócio, estratégia, liderança,
                governança e inteligência organizacional para apoiar empresas que precisam decidir melhor e evoluir
                com consistência.
              </p>
              <p className="qs-p">
                No último ano, aprofundamos essa base com estudo e formação contínua em desenvolvimento humano,
                neurociência aplicada, inteligência artificial, conselho consultivo, universidade de negócios,
                mentoria e tomada de decisão.
              </p>
              <p className="sobre-final-line">Experiência executiva. Critério para decidir. Método para evoluir.</p>
            </div>
          </div>
        </div>

        <div className="container" id="fundadores" style={{ scrollMarginTop: 96 }}>
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
              {/* §9 — as tags/pílulas inferiores (Estratégia, Liderança,
                  Governança, Mercado Financeiro…) saíram: o card fica com
                  nome, função e mini bio, como o documento pede. */}
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
              {/* §9 — as tags/pílulas inferiores (Estratégia, Liderança,
                  Governança, Mercado Financeiro…) saíram: o card fica com
                  nome, função e mini bio, como o documento pede. */}
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

      {/* §14 — trilha de navegação para os buscadores (BreadcrumbList). */}
      <TrilhaSeo nome="Sobre" caminho="/sobre" />
    </>
  );
}
