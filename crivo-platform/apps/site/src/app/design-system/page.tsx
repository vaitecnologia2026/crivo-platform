import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { DsEffects } from "./DsEffects";
import "./ds.css";

export const metadata: Metadata = {
  title: "CRIVO™ · Design System — Decision Intelligence System",
  description:
    "Design System oficial da CRIVO™ — tokens, identidade da marca O Vértice, tipografia, componentes e diretrizes de voz do Decision Intelligence System.",
};

// Plataforma React (apps/web). Configurável por NEXT_PUBLIC_PLATAFORMA_URL
// (ex.: https://app.crivolegacy.com.br). Fallback: preview atual da Vercel.
const PLATAFORMA_URL =
  process.env.NEXT_PUBLIC_PLATAFORMA_URL ?? "https://crivo-web.vercel.app/";

function swatchStyle(c: string): CSSProperties {
  return { ["--c" as string]: c } as CSSProperties;
}

const AZUIS: Array<[string, string]> = [
  ["Azul Profundo", "#0D1F3C"],
  ["Azul Médio", "#1B3A6B"],
  ["Azul Slate", "#2E4D7A"],
  ["Azul Cobalto", "#4A6FA5"],
  ["Azul Claro", "#8BAFD4"],
  ["Azul Gelo", "#C8D9ED"],
];
const NEUTROS: Array<[string, string, boolean?]> = [
  ["Preto Técnico", "#0A0B0D"],
  ["Cinza Escuro", "#3A3A38"],
  ["Prata", "#B8C4D0"],
  ["Cinza Quente", "#D6D2CC"],
  ["Off-White", "#F2F0EC", true],
];
const TERRA: Array<[string, string]> = [
  ["Terra Escura", "#7B4F2E"],
  ["Terra Principal", "#A8693D"],
  ["Terra Dourado", "#C4894A"],
  ["Terra Claro", "#E0B080"],
];

function VerticeMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 44" fill="none" aria-hidden="true">
      <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
      <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
    </svg>
  );
}

export default function DesignSystemPage() {
  return (
    <>
      <DsEffects />

      <div className="ds-shell">
        {/* ===== SIDEBAR NAV ===== */}
        <aside className="ds-nav">
        <a href="#top" className="ds-nav__brand">
          <VerticeMark className="vertice" />
          <span>
            <strong>CRIVO</strong>
            <em>Design System</em>
          </span>
        </a>
        <nav className="ds-nav__links">
          <a href="#principios">Princípios</a>
          <a href="#logo">Logo · O Vértice</a>
          <a href="#cores">Cores</a>
          <a href="#tipografia">Tipografia</a>
          <a href="#botoes">Botões</a>
          <a href="#componentes">Componentes</a>
          <a href="#layout">Espaço · Radius · Sombra</a>
          <a href="#motion">Motion</a>
          <a href="#voz">Voz &amp; Tom</a>
        </nav>
        <div className="ds-nav__foot">
          <span>v1.0 · Brand System V3.0</span>
          <span>O2 Legacy &amp; Consulting</span>
        </div>
      </aside>

      <main className="ds-main" id="top">
        {/* ===== HERO ===== */}
        <header className="ds-hero">
          <div className="ds-hero__bg"></div>
          <div className="ds-hero__inner">
            <span className="ds-eyebrow ds-eyebrow--terra">Decision Intelligence System</span>
            <h1 className="ds-display">Design System</h1>
            <p className="ds-hero__sub">
              A linguagem visual da CRIVO™ — princípios, identidade e componentes que sustentam autoridade, rigor e
              clareza em cada ponto de contato.
            </p>
            <div className="ds-hero__meta">
              <span>
                <strong>Lora</strong> + <strong>Poppins</strong> + <strong>Cormorant</strong>
              </span>
              <span className="ds-dot">·</span>
              <span>Azuis estruturais + Terra + Off-white</span>
            </div>
          </div>
        </header>

        {/* ===== PRINCÍPIOS ===== */}
        <section className="ds-section" id="principios">
          <div className="ds-section__head">
            <span className="ds-eyebrow">01 · Fundamentos</span>
            <h2 className="ds-h2">Cinco princípios inegociáveis.</h2>
          </div>
          <div className="ds-grid ds-grid--3">
            <div className="ds-principle">
              <span className="ds-principle__n">01</span>
              <h3>Base aberta</h3>
              <p>
                O triângulo nunca fecha. O gap central representa um sistema em movimento permanente — recebe inputs,
                processa e eleva.
              </p>
            </div>
            <div className="ds-principle">
              <span className="ds-principle__n">02</span>
              <h3>Terra é acento</h3>
              <p>
                A cor terra aparece só no ponto do vértice, CTAs, sublinhados e bordas de citação. Nunca como fundo
                dominante.
              </p>
            </div>
            <div className="ds-principle">
              <span className="ds-principle__n">03</span>
              <h3>Geometria pura</h3>
              <p>
                Sem arredondamento excessivo, sem decoração. Rigor, precisão e força — registro de gestão de patrimônio
                e consultoria de elite.
              </p>
            </div>
            <div className="ds-principle">
              <span className="ds-principle__n">04</span>
              <h3>Contraste serif/sans</h3>
              <p>
                Lora (serif) nos títulos, Poppins (sans) no corpo. O contraste É a identidade tipográfica — nunca
                substituir.
              </p>
            </div>
            <div className="ds-principle">
              <span className="ds-principle__n">05</span>
              <h3>Rigor, não bem-estar</h3>
              <p>Tom técnico, mensurável, baseado em evidência. Sem coaching, sem motivacional, sem paleta de bem-estar.</p>
            </div>
          </div>
        </section>

        {/* ===== LOGO ===== */}
        <section className="ds-section ds-section--alt" id="logo">
          <div className="ds-section__head">
            <span className="ds-eyebrow">02 · Marca</span>
            <h2 className="ds-h2">O Vértice.</h2>
            <p className="ds-lede">
              Duas linhas ascendentes (clareza + governança) convergindo a um ponto de decisão — o ICD. A base aberta
              mantém o sistema em movimento.
            </p>
          </div>

          <div className="ds-logo-anatomy">
            <svg viewBox="0 0 240 230" fill="none" className="ds-anatomy-svg" aria-hidden="true">
              <line x1="34" y1="178" x2="120" y2="32" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="206" y1="178" x2="120" y2="32" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="34" y1="178" x2="88" y2="178" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="152" y1="178" x2="206" y2="178" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="120" cy="32" r="11" fill="#C4894A" />
              <circle cx="120" cy="32" r="4.8" fill="#F2F0EC" />
              <line x1="120" y1="32" x2="200" y2="20" stroke="rgba(196,137,74,0.5)" strokeWidth="0.75" />
              <text x="204" y="22" fill="#C4894A" fontSize="8" fontFamily="Poppins" letterSpacing="1.5">
                PONTO TERRA · ICD
              </text>
              <line x1="77" y1="105" x2="20" y2="92" stroke="rgba(139,175,212,0.5)" strokeWidth="0.75" />
              <text x="18" y="90" fill="#8BAFD4" fontSize="8" fontFamily="Poppins" textAnchor="end" letterSpacing="1.5">
                VETORES ASCENDENTES
              </text>
              <line x1="120" y1="178" x2="120" y2="208" stroke="rgba(139,175,212,0.5)" strokeWidth="0.75" />
              <text x="120" y="222" fill="#8BAFD4" fontSize="8" fontFamily="Poppins" textAnchor="middle" letterSpacing="1.5">
                BASE ABERTA · MOVIMENTO
              </text>
            </svg>
          </div>

          <h3 className="ds-block-title">Variações de aplicação</h3>
          <div className="ds-logo-grid">
            <div className="ds-logo-card ds-bg-dark">
              <svg viewBox="0 0 110 96" fill="none" className="ds-logo-lockup">
                <g stroke="#F2F0EC">
                  <line x1="14" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="96" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="70" x2="40" y2="70" strokeWidth="2" strokeLinecap="round" />
                  <line x1="70" y1="70" x2="96" y2="70" strokeWidth="2" strokeLinecap="round" />
                </g>
                <circle cx="55" cy="14" r="6" fill="#C4894A" />
                <circle cx="55" cy="14" r="2.6" fill="#F2F0EC" />
                <text x="55" y="88" fontFamily="Cormorant Garamond" fontSize="15" fill="#F2F0EC" textAnchor="middle" letterSpacing="4">
                  CRIVO
                </text>
              </svg>
              <span className="ds-logo-label">Principal · fundo escuro</span>
            </div>
            <div className="ds-logo-card ds-bg-light">
              <svg viewBox="0 0 110 96" fill="none">
                <g stroke="#0D1F3C">
                  <line x1="14" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="96" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="70" x2="40" y2="70" strokeWidth="2" strokeLinecap="round" />
                  <line x1="70" y1="70" x2="96" y2="70" strokeWidth="2" strokeLinecap="round" />
                </g>
                <circle cx="55" cy="14" r="6" fill="#A8693D" />
                <circle cx="55" cy="14" r="2.6" fill="#F2F0EC" />
                <text x="55" y="88" fontFamily="Cormorant Garamond" fontSize="15" fill="#0D1F3C" textAnchor="middle" letterSpacing="4">
                  CRIVO
                </text>
              </svg>
              <span className="ds-logo-label">Fundo claro / off-white</span>
            </div>
            <div className="ds-logo-card ds-bg-slate">
              <svg viewBox="0 0 110 96" fill="none">
                <g stroke="#C8D9ED">
                  <line x1="14" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="96" y1="70" x2="55" y2="14" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="70" x2="40" y2="70" strokeWidth="2" strokeLinecap="round" />
                  <line x1="70" y1="70" x2="96" y2="70" strokeWidth="2" strokeLinecap="round" />
                </g>
                <circle cx="55" cy="14" r="6" fill="#C4894A" />
                <circle cx="55" cy="14" r="2.6" fill="#F2F0EC" />
                <text x="55" y="88" fontFamily="Cormorant Garamond" fontSize="15" fill="#F2F0EC" textAnchor="middle" letterSpacing="4">
                  CRIVO
                </text>
              </svg>
              <span className="ds-logo-label">Institucional · azul médio</span>
            </div>
            <div className="ds-logo-card ds-bg-light">
              <svg viewBox="0 0 90 90" fill="none">
                <g stroke="#0D1F3C">
                  <line x1="14" y1="64" x2="45" y2="16" strokeWidth="2" strokeLinecap="round" />
                  <line x1="76" y1="64" x2="45" y2="16" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="64" x2="33" y2="64" strokeWidth="2" strokeLinecap="round" />
                  <line x1="57" y1="64" x2="76" y2="64" strokeWidth="2" strokeLinecap="round" />
                </g>
                <circle cx="45" cy="16" r="5.5" fill="#A8693D" />
                <circle cx="45" cy="16" r="2.4" fill="#F2F0EC" />
              </svg>
              <span className="ds-logo-label">Símbolo · favicon</span>
            </div>
          </div>

          <div className="ds-dont">
            <h3 className="ds-block-title">O que nunca fazer</h3>
            <ul className="ds-dont-list">
              <li>Fechar o triângulo (perde o significado de sistema em movimento).</li>
              <li>Usar terra como fundo de página ou seção.</li>
              <li>Usar o símbolo sem o ponto terra.</li>
              <li>Substituir Lora por sans-serif nos títulos.</li>
              <li>Misturar com paleta de bem-estar (verde claro, amarelo, laranja pastel).</li>
            </ul>
          </div>
        </section>

        {/* ===== CORES ===== */}
        <section className="ds-section" id="cores">
          <div className="ds-section__head">
            <span className="ds-eyebrow">03 · Sistema cromático</span>
            <h2 className="ds-h2">Paleta.</h2>
          </div>

          <h3 className="ds-block-title">Azuis estruturais — base da identidade</h3>
          <div className="ds-swatches">
            {AZUIS.map(([name, hex]) => (
              <div className="ds-swatch" style={swatchStyle(hex)} key={hex}>
                <span className="ds-swatch__chip"></span>
                <strong>{name}</strong>
                <em>{hex}</em>
              </div>
            ))}
          </div>

          <h3 className="ds-block-title">Neutros sofisticados</h3>
          <div className="ds-swatches">
            {NEUTROS.map(([name, hex, bordered]) => (
              <div className="ds-swatch" style={swatchStyle(hex)} key={hex}>
                <span className={`ds-swatch__chip${bordered ? " ds-swatch__chip--bordered" : ""}`}></span>
                <strong>{name}</strong>
                <em>{hex}</em>
              </div>
            ))}
          </div>

          <h3 className="ds-block-title">Terra — acento · ação · o ponto do vértice</h3>
          <div className="ds-swatches">
            {TERRA.map(([name, hex]) => (
              <div className="ds-swatch" style={swatchStyle(hex)} key={hex}>
                <span className="ds-swatch__chip"></span>
                <strong>{name}</strong>
                <em>{hex}</em>
              </div>
            ))}
          </div>
          <p className="ds-note">
            ⚠ A terra aparece exclusivamente em: ponto do vértice · CTAs · sublinhados de seção · bordas de citação.
            Nunca como fundo dominante.
          </p>
        </section>

        {/* ===== TIPOGRAFIA ===== */}
        <section className="ds-section ds-section--alt" id="tipografia">
          <div className="ds-section__head">
            <span className="ds-eyebrow">04 · Tipografia</span>
            <h2 className="ds-h2">Hierarquia.</h2>
          </div>
          <div className="ds-type-list">
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Display</strong>
                <span>Lora · 500 · clamp 34–62px</span>
              </div>
              <p
                className="ds-type-sample"
                style={{ fontFamily: "var(--crivo-font-display)", fontSize: 48, fontWeight: 500, lineHeight: 1.05 }}
              >
                Decision Intelligence
              </p>
            </div>
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Título de seção</strong>
                <span>Lora · 500 · clamp 27–44px</span>
              </div>
              <p className="ds-type-sample" style={{ fontFamily: "var(--crivo-font-display)", fontSize: 34, fontWeight: 500 }}>
                Empresas crescem até o limite da sua liderança.
              </p>
            </div>
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Citação · voz da marca</strong>
                <span>Lora · italic</span>
              </div>
              <p
                className="ds-type-sample"
                style={{ fontFamily: "var(--crivo-font-display)", fontStyle: "italic", fontSize: 24, color: "var(--crivo-azul-slate)" }}
              >
                &ldquo;Clareza. Coerência. Impacto.&rdquo;
              </p>
            </div>
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Wordmark</strong>
                <span>Cormorant Garamond · +0.22em</span>
              </div>
              <p
                className="ds-type-sample"
                style={{ fontFamily: "var(--crivo-font-word)", fontSize: 34, fontWeight: 500, letterSpacing: "0.22em" }}
              >
                CRIVO
              </p>
            </div>
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Label / navegação</strong>
                <span>Poppins · uppercase · +0.3em</span>
              </div>
              <p
                className="ds-type-sample"
                style={{
                  fontFamily: "var(--crivo-font-body)",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.3em",
                  color: "var(--crivo-terra)",
                }}
              >
                Diagnóstico · ICD · NR-1
              </p>
            </div>
            <div className="ds-type-row">
              <div className="ds-type-spec">
                <strong>Corpo</strong>
                <span>Poppins · 300 · 1.65</span>
              </div>
              <p
                className="ds-type-sample"
                style={{ fontFamily: "var(--crivo-font-body)", fontSize: 16, fontWeight: 300, lineHeight: 1.65, maxWidth: 560 }}
              >
                O CRIVO™ é o único sistema que quantifica a qualidade decisória de uma organização, com métrica
                proprietária e resultado mensurável.
              </p>
            </div>
          </div>
        </section>

        {/* ===== BOTÕES ===== */}
        <section className="ds-section" id="botoes">
          <div className="ds-section__head">
            <span className="ds-eyebrow">05 · Ações</span>
            <h2 className="ds-h2">Botões.</h2>
          </div>
          <div className="ds-btn-demo">
            <div className="ds-btn-cell ds-bg-light">
              <button className="dsb dsb--terra">Solicitar diagnóstico</button>
              <button className="dsb dsb--outline-dark">Falar com especialista</button>
              <span className="ds-logo-label">Sobre claro</span>
            </div>
            <div className="ds-btn-cell ds-bg-dark">
              <button className="dsb dsb--terra">Solicitar diagnóstico</button>
              <button className="dsb dsb--ghost">Falar com especialista</button>
              <span className="ds-logo-label">Sobre escuro</span>
            </div>
          </div>
          <p className="ds-note">
            Microcopy em uppercase, tracking +0.08em. Hover: elevação sutil + sombra terra. Raio 3px (sóbrio).
          </p>
        </section>

        {/* ===== COMPONENTES ===== */}
        <section className="ds-section ds-section--alt" id="componentes">
          <div className="ds-section__head">
            <span className="ds-eyebrow">06 · Componentes</span>
            <h2 className="ds-h2">Biblioteca.</h2>
          </div>
          <div className="ds-grid ds-grid--2">
            <div className="ds-comp">
              <span className="ds-comp__tag">Eyebrow</span>
              <span className="dsx-eyebrow">Decision Intelligence System</span>
            </div>
            <div className="ds-comp">
              <span className="ds-comp__tag">Pills / Tags</span>
              <div className="ds-row-gap">
                <span className="dsx-pill">Em andamento</span>
                <span className="dsx-pill dsx-pill--terra">Mais procurado</span>
                <span className="dsx-pill dsx-pill--alert">Pressão</span>
              </div>
            </div>
            <div className="ds-comp">
              <span className="ds-comp__tag">Score pills (ICD)</span>
              <div className="ds-row-gap">
                <span className="dsx-score dsx-score--high">91</span>
                <span className="dsx-score dsx-score--mid">80</span>
                <span className="dsx-score dsx-score--low">66</span>
              </div>
            </div>
            <div className="ds-comp">
              <span className="ds-comp__tag">Input</span>
              <input className="dsx-input" placeholder="nome@empresa.com.br" />
            </div>
            <div className="ds-comp ds-comp--wide">
              <span className="ds-comp__tag">Card · pilar do método</span>
              <div className="dsx-card">
                <span className="dsx-card__letter">C</span>
                <h4>Consciência</h4>
                <p>Clareza sobre o contexto, as pessoas e as decisões.</p>
              </div>
            </div>
            <div className="ds-comp ds-comp--wide">
              <span className="ds-comp__tag">Citação</span>
              <blockquote className="dsx-quote">
                A CRIVO conecta liderança, comportamento, cultura e execução em uma estrutura integrada.
              </blockquote>
            </div>
          </div>
        </section>

        {/* ===== LAYOUT ===== */}
        <section className="ds-section" id="layout">
          <div className="ds-section__head">
            <span className="ds-eyebrow">07 · Estrutura</span>
            <h2 className="ds-h2">Espaço, raio e sombra.</h2>
          </div>
          <h3 className="ds-block-title">Escala de espaçamento (4pt)</h3>
          <div className="ds-space-demo">
            {[4, 8, 16, 24, 32, 48, 64].map((w) => (
              <div className="ds-space" key={w}>
                <span style={{ width: w }}></span>
                <em>{w}</em>
              </div>
            ))}
          </div>
          <h3 className="ds-block-title">Raio &amp; Sombra</h3>
          <div className="ds-grid ds-grid--4">
            {[2, 4, 6, 10].map((r) => (
              <div className="ds-radius" style={{ borderRadius: r }} key={r}>
                {r}px
              </div>
            ))}
          </div>
          <div className="ds-grid ds-grid--3" style={{ marginTop: 16 }}>
            <div className="ds-shadow" style={{ boxShadow: "var(--crivo-shadow-1)" }}>
              shadow-1
            </div>
            <div className="ds-shadow" style={{ boxShadow: "var(--crivo-shadow-2)" }}>
              shadow-2
            </div>
            <div className="ds-shadow" style={{ boxShadow: "var(--crivo-shadow-3)" }}>
              shadow-3
            </div>
          </div>
        </section>

        {/* ===== MOTION ===== */}
        <section className="ds-section ds-section--alt" id="motion">
          <div className="ds-section__head">
            <span className="ds-eyebrow">08 · Motion</span>
            <h2 className="ds-h2">Movimento com critério.</h2>
            <p className="ds-lede">
              Transições com easeOutExpo <code>cubic-bezier(0.16, 1, 0.3, 1)</code>. O Vértice se desenha no carregamento
              — clareza e governança convergindo ao ponto de decisão.
            </p>
          </div>
          <div className="ds-motion-demo ds-bg-dark">
            <svg viewBox="0 0 240 200" fill="none" className="ds-motion-vertice" aria-hidden="true">
              <line x1="34" y1="158" x2="120" y2="22" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" className="vx-line" />
              <line x1="206" y1="158" x2="120" y2="22" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" className="vx-line" />
              <line x1="34" y1="158" x2="88" y2="158" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" className="vx-line" />
              <line x1="152" y1="158" x2="206" y2="158" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" className="vx-line" />
              <circle cx="120" cy="22" r="11" fill="#C4894A" className="vx-dot" />
              <circle cx="120" cy="22" r="4.8" fill="#F2F0EC" className="vx-dot" />
            </svg>
            <button className="dsb dsb--ghost" id="replayMotion">
              Reproduzir novamente
            </button>
          </div>
        </section>

        {/* ===== VOZ ===== */}
        <section className="ds-section" id="voz">
          <div className="ds-section__head">
            <span className="ds-eyebrow">09 · Verbal</span>
            <h2 className="ds-h2">Voz &amp; Tom.</h2>
          </div>
          <div className="ds-voice">
            <div className="ds-voice__col ds-voice__col--yes">
              <h3>Fala assim</h3>
              <ul>
                <li>Rigoroso · técnico</li>
                <li>Direto · baseado em evidência</li>
                <li>Mensurável · estratégico</li>
                <li>&ldquo;O ICD revela…&rdquo;</li>
                <li>&ldquo;Dados mostram que…&rdquo;</li>
                <li>&ldquo;Resultado quantificável&rdquo;</li>
              </ul>
            </div>
            <div className="ds-voice__col ds-voice__col--no">
              <h3>Não fala assim</h3>
              <ul>
                <li>Empático em excesso</li>
                <li>Genérico · motivacional</li>
                <li>Coaching / &ldquo;cuide-se&rdquo;</li>
                <li>&ldquo;Jornada de bem-estar&rdquo;</li>
                <li>Tom RH tradicional</li>
                <li>&ldquo;Transformação humana&rdquo; (apelo emocional)</li>
              </ul>
            </div>
          </div>
          <p className="ds-note">Referências de registro: Itaú Personnalité · Kinea Investimentos · Hospital Albert Einstein.</p>
        </section>

        <footer className="ds-footer">
          <div className="ds-footer__brand">
            <VerticeMark className="vertice" />
            <span className="ds-footer__word">CRIVO</span>
          </div>
          <p>Design System v1.0 · Decision Intelligence System · O2 Legacy &amp; Consulting</p>
          <p className="ds-footer__links">
            <a href="/lp">Landing Page →</a> &nbsp; <a href={PLATAFORMA_URL}>Plataforma →</a>
          </p>
        </footer>
        </main>
      </div>
    </>
  );
}
