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

      {/* ===================== SOBRE (print Pág. 03): Quem Somos · Como Nasceu · Fundadores ===================== */}
      <section className="section section--light" id="quem-somos">
        <div className="container">
          {/* pílulas de navegação (abas do print) */}
          <div className="sobre-tabs">
            <a href="#quem-somos" className="sobre-tab is-active">Quem Somos</a>
            <a href="#como-nasceu" className="sobre-tab">Como Nasceu</a>
            <a href="#fundadores" className="sobre-tab">Fundadores</a>
          </div>

          <div className="sobre-grid">
            {/* COLUNA PRINCIPAL — Quem Somos */}
            <div className="sobre-main">
              <span className="eyebrow">Quem somos</span>
              <h2 className="h2">Somos uma consultoria estratégica de transformação organizacional.</h2>
              <p className="lede">
                A CRIVO integra o desenvolvimento da liderança, inteligência organizacional, governança e tecnologia
                para transformar sinais invisíveis em clareza, ação e evolução sustentável.
              </p>

              <div className="sobre-cards">
                <article className="sobre-card">
                  <span className="sobre-card__ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M16 5.4a3 3 0 0 1 0 5.6M17 14c2.1.4 3.7 2.3 3.7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </span>
                  <strong>Desenvolvimento da liderança</strong>
                  <p>Fortalecemos lideranças para decidir com critério em contextos de pressão e complexidade.</p>
                </article>
                <article className="sobre-card">
                  <span className="sobre-card__ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <strong>Inteligência organizacional</strong>
                  <p>Transformamos padrões invisíveis em leitura executiva, indicadores e planos de ação.</p>
                </article>
                <article className="sobre-card">
                  <span className="sobre-card__ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <strong>Governança e cultura</strong>
                  <p>Criamos estruturas e rituais que sustentam decisões, ética e responsabilidade.</p>
                </article>
                <article className="sobre-card">
                  <span className="sobre-card__ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </span>
                  <strong>Tecnologia com propósito</strong>
                  <p>Aplicamos IA e tecnologia de forma ética para ampliar clareza, eficiência e impacto.</p>
                </article>
              </div>
            </div>

            {/* COLUNA LATERAL — Como Nasceu + Fundadores */}
            <aside className="sobre-side">
              <div className="sobre-block" id="como-nasceu">
                <span className="sobre-side__h">Como Nasceu</span>
                <p>
                  A CRIVO nasceu da prática executiva e da percepção de que a qualidade das decisões sob pressão molda
                  cultura, performance e resultados.
                </p>
                <p>
                  Transformamos padrões invisíveis de decisão em inteligência aplicável para lideranças que
                  precisam decidir melhor em contextos reais.
                </p>
              </div>

              <div className="sobre-block" id="fundadores">
                <span className="sobre-side__h">Fundadores</span>
                <article className="founder-card">
                  <span className="founder-card__avatar" aria-hidden="true">RO</span>
                  <div className="founder-card__body">
                    <strong>
                      Rodrigo Oliveira <em>Cofundador</em>
                    </strong>
                    <p>
                      Especialista em liderança, cultura e decisão sob pressão. Atuou em transformações complexas em
                      organizações de grande porte, com foco em resultados sustentáveis, execução e pessoas.
                    </p>
                  </div>
                </article>
                <article className="founder-card">
                  <span className="founder-card__avatar" aria-hidden="true">VO</span>
                  <div className="founder-card__body">
                    <strong>
                      Viviani Ostan <em>Cofundadora</em>
                    </strong>
                    <p>
                      Executiva com sólida trajetória em liderança e desenvolvimento de negócios. Atua no
                      fortalecimento de equipes, performance e relações de confiança em ambientes de alta exigência.
                    </p>
                  </div>
                </article>
              </div>
            </aside>
          </div>

          {/* Missão · Visão · Valores (institucional, mantido) */}
          <div className="mvv" id="mvv">
            <article className="mvv-card">
              <span className="mvv-card__tag">Missão</span>
              <p>
                Transformar riscos invisíveis em consciência, ação e evolução organizacional — desenvolvendo lideranças
                capazes de sustentar cultura, decisões, governança e resultados.
              </p>
            </article>
            <article className="mvv-card">
              <span className="mvv-card__tag">Visão</span>
              <p>
                Ser referência em inteligência organizacional e desenvolvimento da liderança para empresas que integram
                pessoas, cultura, tecnologia, decisão e performance de forma sustentável.
              </p>
            </article>
            <article className="mvv-card">
              <span className="mvv-card__tag">Valores</span>
              <p>
                Critério acima de pressão. Evidência acima de opinião. Governança, confidencialidade e responsabilidade
                — com o desenvolvimento humano como base de todo resultado sustentável.
              </p>
            </article>
          </div>
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
