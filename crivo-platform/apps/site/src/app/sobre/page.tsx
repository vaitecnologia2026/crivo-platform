import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Sobre a CRIVO™ — quem somos, como nascemos e fundadores",
  description:
    "A CRIVO™ é uma consultoria estratégica de transformação organizacional com tecnologia aplicada — método, leitura organizacional, desenvolvimento da liderança e evidências.",
};

export default function SobrePage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Sobre a CRIVO™</span>
          <h1 className="display h2--light">
            Inteligência organizacional e desenvolvimento da <span className="terra-text">liderança</span>.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 760 }}>
            Uma consultoria estratégica de transformação organizacional com tecnologia aplicada. Revelamos sinais
            invisíveis, priorizamos ações, desenvolvemos lideranças e sustentamos a evolução com método, dados, plano de
            ação e evidências.
          </p>
        </div>
      </section>

      {/* ===================== QUEM SOMOS ===================== */}
      <section className="section section--light" id="quem-somos">
        <div className="container split">
          <div className="split__left">
            <span className="eyebrow">Quem somos</span>
            <h2 className="h2">
              Consultoria estratégica de transformação organizacional por meio do desenvolvimento sustentável da
              liderança.
            </h2>
            <p className="lede">
              A CRIVO™ combina método proprietário, leitura organizacional, desenvolvimento da liderança e tecnologia
              aplicada para transformar sinais dispersos em clareza, plano de ação e evolução sustentável — conectando
              liderança, comportamento, cultura, governança, tecnologia, execução e resultado.
            </p>
            <blockquote className="pull-quote pull-quote--center">
              &ldquo;A CRIVO™ transforma sinais invisíveis em clareza, liderança e evolução sustentável.&rdquo;
            </blockquote>
            <div className="lp-photo lp-photo--portrait" aria-hidden="true">
              <span style={{ backgroundImage: "url('/imagens/quem-somos-lideranca.jpg')" }} />
            </div>
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
                <span>Diagnóstico estruturado de riscos organizacionais, fatores psicossociais, custos invisíveis e sinais que afetam clima, performance e continuidade.</span>
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

        <div className="container mvv" id="mvv">
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

      {/* ===================== COMO NASCEU + FUNDADORES ===================== */}
      <section className="section section--dark" id="como-nasceu">
        <div className="container container--narrow">
          <span className="eyebrow eyebrow--terra">Como nasceu a CRIVO™</span>
          <h2 className="h2 h2--light">Da deterioração decisória sob pressão a um método de transformação.</h2>
          <p className="lede lede--light">
            A CRIVO™ nasceu da percepção executiva de que organizações perdem performance, clareza, cultura e
            sustentabilidade quando a qualidade das decisões se deteriora sob pressão. Enquanto o mercado mede sintomas,
            a CRIVO desenvolveu uma camada de inteligência organizacional capaz de transformar padrões invisíveis de
            risco humano em leitura executiva, indicadores, desenvolvimento da liderança e transformação.
          </p>

          <div className="founders" id="fundadores">
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

      {/* ===================== CTA CONTEXTUAL ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <span className="eyebrow eyebrow--terra" style={{ justifyContent: "center" }}>
            Próximo passo
          </span>
          <h2 className="h2 h2--light h2--center">Vamos conversar sobre a sua organização?</h2>
          <p className="lede lede--light" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            Comece por uma leitura preliminar gratuita — confidencial e com resposta de um especialista em até 24h úteis.
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
