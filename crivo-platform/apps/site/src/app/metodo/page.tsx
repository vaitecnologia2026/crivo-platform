import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import { MetodoSection, IcdSection, JornadaSection } from "../_sections/CrivoSections";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Método CRIVO + ICD — Índice de Coerência Decisória",
  description:
    "O Método CRIVO (C-R-I-V-O) e o ICD™ — leitura proprietária da coerência decisória sob pressão, nos eixos Clareza, Critério, Alinhamento e Sustentação.",
};

export default function MetodoPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ===================== PAGE HERO ===================== */}
      <section className="section section--dark page-hero">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Método CRIVO</span>
          <h1 className="display h2--light">
            Um método para <span className="terra-text">decidir, sustentar e evoluir</span>.
          </h1>
          <p className="lede lede--light" style={{ maxWidth: 760 }}>
            Percepção, decisão, rotina, plano de ação, evidências e evolução mensurável — a estrutura C-R-I-V-O e o ICD™,
            a leitura proprietária da coerência decisória da liderança.
          </p>
        </div>
      </section>

      {/* Seções compartilhadas (mesma fonte da Home) */}
      <MetodoSection />
      <IcdSection />
      <JornadaSection />

      {/* ===================== CTA ===================== */}
      <section className="section section--accent">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="h2 h2--light h2--center">Pronto para ler a coerência decisória da sua liderança?</h2>
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
