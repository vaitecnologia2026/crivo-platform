import type { Metadata } from "next";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { LpEffects } from "../lp/LpEffects";
import "../lp/lp.css";

export const metadata: Metadata = {
  title: "Soluções CRIVO — do Diagnóstico Inicial ao Advisory",
  description:
    "Transformação organizacional como eixo que conecta diagnóstico, liderança, cultura, dados e sustentação. Diagnóstico Inicial, CRIVO Diagnóstico, Liderança, Evolução, Enterprise e Advisory.",
};

/* ícones de traço (stroke) — sem emoji, no estilo da marca */
const IcSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcChart = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 20v-6M12 20V6M17 20v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcPeople = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M16 5.4a3 3 0 0 1 0 5.6M17 14c2.1.4 3.7 2.3 3.7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcCycle = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 11a8 8 0 0 1 13.5-5.2L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 13a8 8 0 0 1-13.5 5.2L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 4v4h-4M4 20v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="3.5" width="14" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10 20.5v-3h4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IcStar = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.4 9.7l5.8-.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IcNodes = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="18" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 6h8M7.6 8l3.4 8M16.4 8l-3.4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IcTrendUp = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcShield = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PORTFOLIO = [
  {
    ic: <IcSearch />,
    nome: "Diagnóstico Inicial",
    tag: "Entrada · Leitura Preliminar",
    desc: "Leitura rápida de riscos invisíveis, liderança e pontos de atenção. Relatório Preliminar CRIVO™ em até 24h.",
  },
  {
    ic: <IcChart />,
    nome: "CRIVO Diagnóstico™",
    tag: "Diagnóstico Organizacional",
    desc: "Diagnóstico estruturado com fatores psicossociais, liderança, cultura e evidências. Dashboard e plano de ação.",
  },
  {
    ic: <IcPeople />,
    nome: "CRIVO Liderança",
    tag: "Jornada de Liderança",
    desc: "Trilhas, mentorias e app (Radar da Decisão, Academia CRIVO) para desenvolver líderes com foco no que importa.",
  },
  {
    ic: <IcCycle />,
    nome: "CRIVO Evolução",
    tag: "Mentoria & Governança",
    desc: "Mentoria em grupo, governança comportamental e Radar da Decisão evolutivo, com devolutivas estruturadas.",
  },
  {
    ic: <IcBuilding />,
    nome: "CRIVO Enterprise",
    tag: "Transformação Organizacional",
    desc: "Jornada completa de transformação: PDCA, mentoria, workshops e sustentação. Ideal para M&A e crescimento.",
  },
  {
    ic: <IcStar />,
    nome: "CRIVO Advisory",
    tag: "Conselho Estratégico",
    desc: "Conselheiro para C-Level e fundadores. Visão estratégica de governança, cultura e sucessão.",
  },
];

const DIFERENCIAIS = [
  {
    ic: <IcNodes />,
    titulo: "Visão integrada",
    desc: "Não tratamos temas isolados. Conectamos liderança, cultura, riscos, dados e performance em um método único.",
  },
  {
    ic: <IcTrendUp />,
    titulo: "Base em ciência e dados",
    desc: "Diagnóstico com evidências psicossociais e comportamentais aplicadas à realidade do negócio.",
  },
  {
    ic: <IcCycle />,
    titulo: "Sustentação que gera resultado",
    desc: "Do plano à rotina: app, dashboards, mentorias e trilhas para manter a evolução e a disciplina organizacional.",
  },
  {
    ic: <IcShield />,
    titulo: "Segurança e conformidade",
    desc: "Plataforma segura, LGPD by design e aderente às exigências da NR-1.",
  },
];

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

      {/* ===================== PORTFÓLIO (print Pág. 07) ===================== */}
      <section className="section section--light" id="solucoes">
        <div className="container">
          <span className="eyebrow" style={{ justifyContent: "center" }}>
            Portfólio modular
          </span>
          <h2 className="h2 h2--center">Um nível de atuação para cada estágio.</h2>
          <p className="lede" style={{ textAlign: "center", margin: "0 auto 8px", maxWidth: 820 }}>
            Do diagnóstico ao conselho estratégico — cada solução é um degrau da mesma jornada de transformação.
          </p>

          {/* núcleo: transformação organizacional como eixo */}
          <div className="sol-core">
            <span className="sol-core__pill">Transformação Organizacional</span>
          </div>
          <svg className="sol-bus" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true">
            <path d="M600 0 V14 M100 14 H1100 M100 14 V40 M300 14 V40 M500 14 V40 M700 14 V40 M900 14 V40 M1100 14 V40" />
          </svg>

          <div className="sol-grid">
            {PORTFOLIO.map((p) => (
              <article className="sol-card" key={p.nome}>
                <span className="sol-card__ic" aria-hidden="true">
                  {p.ic}
                </span>
                <h3>{p.nome}</h3>
                <span className="sol-card__tag">{p.tag}</span>
                <p>{p.desc}</p>
                <a href="/lp#diagnostico" className="sol-card__more">
                  Saiba mais <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>

          {/* agendas estratégicas */}
          <div className="strategic-tags">
            <span className="strategic-tags__eyebrow">Agendas estratégicas</span>
            <div className="strategic-tags__list">
              <span className="strategic-tag">Transformação Cultural</span>
              <span className="strategic-tag">Cultura Adaptável — Pessoas + IA</span>
              <span className="strategic-tag">Governança de IA e Pessoas</span>
              <span className="strategic-tag">Governança Comportamental</span>
              <span className="strategic-tag">Custos Invisíveis</span>
              <span className="strategic-tag">Palestras e Mentorias Executivas</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== DIFERENCIAIS CRIVO (seção própria) ===================== */}
      <section className="section section--dark" id="diferenciais">
        <div className="container">
          <span className="eyebrow eyebrow--terra">Diferenciais CRIVO</span>
          <h2 className="h2 h2--light">O que conecta o que muitas empresas tratam de forma fragmentada.</h2>
          <p className="lede lede--light" style={{ textAlign: "center", margin: "0 auto 8px", maxWidth: 820 }}>
            Liderança, cultura, riscos, dados e performance em um único método — do diagnóstico à sustentação.
          </p>
          <div className="dif-grid">
            {DIFERENCIAIS.map((d) => (
              <article className="dif-col" key={d.titulo}>
                <span className="dif-col__ic" aria-hidden="true">
                  {d.ic}
                </span>
                <strong>{d.titulo}</strong>
                <p>{d.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== COMPARATIVO DETALHADO (leitura premium) ===================== */}
      <section className="section section--light" id="comparativo">
        <div className="container">
          <span className="eyebrow">Comparativo</span>
          <h2 className="h2">CRIVO × abordagens fragmentadas, lado a lado.</h2>
          <p className="lede">
            Para quem quer o detalhe: o que soluções focadas em NR-1 e consultorias pontuais entregam — e o que só a
            CRIVO sustenta em um método integrado.
          </p>

          <div className="compare">
            <table className="compare__table">
              <thead>
                <tr>
                  <th>Capacidade</th>
                  <th>Soluções focadas em NR-1</th>
                  <th>Consultorias pontuais</th>
                  <th className="compare__crivo">CRIVO</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Questionário NR-1</td><td>✓</td><td>✓</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mapeamento de fatores psicossociais</td><td>parcial</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Diagnóstico organizacional estruturado</td><td>—</td><td>✓</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Plano de ação executável (PDCA)</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Dashboard executivo com evolução longitudinal</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Portal Executivo logado e seguro (LGPD)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>App CRIVO de sustentação da rotina</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Desenvolvimento e Trilha de Liderança</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Academia CRIVO (cursos, trilhas, conteúdos)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mentor CRIVO e Simulador de Decisão</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>ICD™ — Índice de Coerência Decisória (métrica proprietária)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Pocket — preparo rápido para decisões e conversas</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Leitura contínua e evolutiva por ciclos</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Mentoria executiva e governança comportamental</td><td>—</td><td>parcial</td><td className="compare__crivo">✓</td></tr>
                <tr><td>Conselho estratégico C-Level (Advisory)</td><td>—</td><td>—</td><td className="compare__crivo">✓</td></tr>
              </tbody>
            </table>
          </div>

          <p className="transition-quote transition-quote--light">
            &ldquo;Não tratamos apenas o risco. Atuamos na liderança que sustenta cultura, decisões e resultados.&rdquo;
          </p>
        </div>
      </section>

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
