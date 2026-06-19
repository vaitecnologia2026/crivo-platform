import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { PLATAFORMA_URL, WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import { PortalSection, AppSection, EcossistemaSection } from "../_sections/CrivoSections";
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

      {/* Seções compartilhadas (mesma fonte da Home) */}
      <PortalSection />
      <AppSection />
      <EcossistemaSection />

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
