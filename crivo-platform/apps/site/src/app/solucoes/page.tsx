import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import { PortfolioSection, DiferenciaisSection, ComparativoSection } from "../_sections/CrivoSections";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Soluções CRIVO — do Diagnóstico Inicial ao Advisory",
  description:
    "Transformação organizacional como eixo que conecta diagnóstico, liderança, cultura, dados e sustentação. Diagnóstico Inicial, CRIVO Diagnóstico, Liderança, Evolução, Enterprise e Advisory.",
};

export default function SolucoesPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Soluções &amp; Serviços</span>
          <h1 className="display h2--light">
            Soluções para <span className="terra-text">cada momento</span> da organização.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 820 }}>
            Transformação organizacional como eixo que conecta diagnóstico, liderança, cultura, dados e sustentação —
            para gerar resultados consistentes e duradouros.
          </p>
        </div>
      </section>

      {/* Seções compartilhadas (mesma fonte da Home) */}
      <PortfolioSection />
      <DiferenciaisSection />
      <ComparativoSection />

      {/* ===================== CTA ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="h2 h2--light h2--center">Qual é o momento da sua organização?</h2>
          <p className="lede lede--light" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            O diagnóstico inicial gratuito indica o nível de serviço ideal — confidencial, com resposta em até 24h úteis.
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
