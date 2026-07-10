import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./metodo.css";

export const metadata: Metadata = {
  title: "Método CRIVO™ + ICD™ — Índice de Coerência Decisória",
  description:
    "O Método CRIVO™ (Consciência, Responsabilidade, Integração, Valores, Organização) e o ICD™ — índice proprietário que avalia clareza, critério, alinhamento e sustentação nas decisões da liderança.",
};

// Ícone de traço fino para "Critério" (balança) — não existe em IC, mesmo
// estilo dos demais ícones da biblioteca (stroke, viewBox 24, sem preenchimento).
const IC_BALANCA = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3v17M8 20h8M4 7h16M4 7 1.5 12h5L4 7ZM20 7l-2.5 5h5L20 7Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Página /metodo — 2 telas finais aprovadas (ORDEM_TELAS_FINAIS 04 e 05):
// 04 Método CRIVO™ (id="metodo") · 05 ICD™ — Índice de Coerência Decisória
// (id="icd"). Copy literal das telas; sem redesenho.
export default function MetodoPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ 04 · MÉTODO CRIVO™ ============ */}
      <section id="metodo" className="hero hero--1">
        <div className="mt-wrap">
          <div
            className="hero__bleed"
            style={{ backgroundImage: "url('/imagens/metodo-executivos.jpg')" }}
            role="img"
            aria-label="Executiva com tablet e executivo diante do skyline da cidade"
          />
          <div className="container hero__inner mt-inner">
            <div className="hero__copy">
              <span className="eyebrow eyebrow--terra">Método CRIVO™</span>
              <h1 className="display">
                Um método para transformar
                <br />
                leitura em <span className="terra-text">decisão,</span> decisão em
                <br />
                <span className="terra-text">ação</span> e ação em <span className="terra-text">evolução.</span>
              </h1>
              <span className="rule-terra" aria-hidden="true" />
              <p className="hero__sub">
                A CRIVO organiza a jornada da empresa a partir de cinco movimentos que ajudam líderes e equipes a
                interpretar o cenário, assumir responsabilidades, alinhar pessoas, decidir com critério e
                transformar prioridades em execução acompanhada.
              </p>
            </div>
          </div>
        </div>

        <div className="container">
          <div className="mv-title-wrap">
            <span className="mv-title">Os 5 Movimentos do Método CRIVO™</span>
            <span className="rule-terra" aria-hidden="true" />
          </div>

          <div className="mv-band mv-band--5">
            <div className="mv-col">
              <div className="mv-col__head">
                <span className="mv-col__ic">{IC.alvo}</span>
                <div>
                  <span className="mv-col__num">01</span>
                  <div className="mv-col__title">Consciência</div>
                </div>
              </div>
              <p>Ler o contexto, reconhecer pressões e ampliar clareza antes de agir.</p>
            </div>
            <div className="mv-col">
              <div className="mv-col__head">
                <span className="mv-col__ic">{IC.escudo}</span>
                <div>
                  <span className="mv-col__num">02</span>
                  <div className="mv-col__title">Responsabilidade</div>
                </div>
              </div>
              <p>Assumir escolhas, consequências e compromissos de execução.</p>
            </div>
            <div className="mv-col">
              <div className="mv-col__head">
                <span className="mv-col__ic">{IC.pessoas}</span>
                <div>
                  <span className="mv-col__num">03</span>
                  <div className="mv-col__title">Integração</div>
                </div>
              </div>
              <p>Conectar pessoas, áreas, comunicação e prioridades.</p>
            </div>
            <div className="mv-col">
              <div className="mv-col__head">
                <span className="mv-col__ic">{IC_BALANCA}</span>
                <div>
                  <span className="mv-col__num">04</span>
                  <div className="mv-col__title">Valores</div>
                </div>
              </div>
              <p>Decidir com critério, coerência cultural e visão de impacto.</p>
            </div>
            <div className="mv-col">
              <div className="mv-col__head">
                <span className="mv-col__ic">{IC.prancheta}</span>
                <div>
                  <span className="mv-col__num">05</span>
                  <div className="mv-col__title">Organização</div>
                </div>
              </div>
              <p>Transformar decisões em rotina, plano de ação, acompanhamento e evidências.</p>
            </div>
          </div>

          <div className="mv-aid">
            <div className="mv-aid__label">
              <strong>
                O MÉTODO
                <br />
                AJUDA A EMPRESA A:
              </strong>
              <span className="rule-terra" aria-hidden="true" />
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.grafico}</span>
              <p>Identificar sinais que afetam rotina, cultura e resultados.</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.alvo}</span>
              <p>Transformar diagnóstico em prioridades claras.</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.prancheta}</span>
              <p>Estruturar plano de ação com responsáveis, prazos e evidências.</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.balao}</span>
              <p>Apoiar líderes em decisões e conversas relevantes.</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.relogio}</span>
              <p>Acompanhar evolução por ciclos, indicadores e registros.</p>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__bar" aria-hidden="true" />
            <span className="cta-band__big-ic" aria-hidden="true">{IC.alvo}</span>
            <div className="cta-band__text">
              <div className="t">
                Método, dados e tecnologia
                <br />
                para <span className="terra-text">decisões com critério</span>
                <br />e <span className="terra-text">evolução mensurável.</span>
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-light">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 05 · ICD™ — ÍNDICE DE COERÊNCIA DECISÓRIA ============ */}
      <section id="icd" className="hero hero--1">
        <div className="container hero__inner icd-hero__inner">
          <div className="hero__copy">
            <span className="eyebrow eyebrow--terra">ICD™ — Índice de Coerência Decisória</span>
            <h2 className="display">
              Decisões relevantes
              <br />
              também precisam de
              <br />
              <span className="terra-text">clareza, critério e sustentação.</span>
            </h2>
            <span className="rule-terra" aria-hidden="true" />
            <p className="hero__sub">
              O ICD™ é um índice proprietário da CRIVO para apoiar líderes a refletir sobre decisões reais, avaliando
              a coerência entre fatos, critérios, alinhamento, cultura e impactos futuros.
            </p>
          </div>

          <div className="icd-diagram">
            <svg className="icd-diagram__lines" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="icd-diagram__ring" cx="50" cy="50" r="35" />
              <line x1="50" y1="50" x2="50" y2="17" />
              <line x1="50" y1="50" x2="83" y2="50" />
              <line x1="50" y1="50" x2="50" y2="83" />
              <line x1="50" y1="50" x2="17" y2="50" />
              <circle className="icd-diagram__dot" cx="50" cy="17" r="1.4" />
              <circle className="icd-diagram__dot" cx="83" cy="50" r="1.4" />
              <circle className="icd-diagram__dot" cx="50" cy="83" r="1.4" />
              <circle className="icd-diagram__dot" cx="17" cy="50" r="1.4" />
            </svg>
            <div className="icd-diagram__hub">
              <strong>
                Coerência
                <br />
                Decisória
              </strong>
              <span className="rule-terra" aria-hidden="true" />
            </div>
            <div className="icd-diagram__node icd-diagram__node--t">
              <span className="icd-diagram__node-ic">{IC.lupa}</span>
              <b>Clareza</b>
            </div>
            <div className="icd-diagram__node icd-diagram__node--r">
              <span className="icd-diagram__node-ic">{IC_BALANCA}</span>
              <b>Critério</b>
            </div>
            <div className="icd-diagram__node icd-diagram__node--b">
              <span className="icd-diagram__node-ic">{IC.escudo}</span>
              <b>Sustentação</b>
            </div>
            <div className="icd-diagram__node icd-diagram__node--l">
              <span className="icd-diagram__node-ic">{IC.pessoas}</span>
              <b>Alinhamento</b>
            </div>
          </div>

          <blockquote className="icd-quote">Decidir melhor também é uma prática de liderança.</blockquote>
        </div>

        <div className="container">
          <div className="mv-title-wrap">
            <span className="mv-title">Os 4 Eixos do ICD™</span>
            <span className="rule-terra" aria-hidden="true" />
          </div>

          <div className="mv-band mv-band--4">
            <div className="mv-col">
              <span className="mv-col__ic mv-col__ic--terra">{IC.lupa}</span>
              <div className="mv-col__title-only">Clareza</div>
              <p>Ler fatos, contexto e informações relevantes antes de decidir.</p>
            </div>
            <div className="mv-col">
              <span className="mv-col__ic mv-col__ic--terra">{IC_BALANCA}</span>
              <div className="mv-col__title-only">Critério</div>
              <p>Analisar o que importa com discernimento, consistência e responsabilidade.</p>
            </div>
            <div className="mv-col">
              <span className="mv-col__ic mv-col__ic--terra">{IC.pessoas}</span>
              <div className="mv-col__title-only">Alinhamento</div>
              <p>Considerar impactos em pessoas, áreas, cultura e prioridades.</p>
            </div>
            <div className="mv-col">
              <span className="mv-col__ic mv-col__ic--terra">{IC.escudo}</span>
              <div className="mv-col__title-only">Sustentação</div>
              <p>Apoiar decisões executáveis, coerentes e sustentáveis no tempo.</p>
            </div>
          </div>

          <div className="mv-aid">
            <div className="mv-aid__label">
              <strong>
                O ICD™
                <br />
                APOIA LÍDERES A:
              </strong>
              <span className="rule-terra" aria-hidden="true" />
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.alvo}</span>
              <p>Tomar decisões com mais clareza e consistência</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.alerta}</span>
              <p>Reconhecer padrões de decisão e pontos de atenção</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.balao}</span>
              <p>Melhorar comunicação, critério e alinhamento</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.escudo}</span>
              <p>Fortalecer governança comportamental e execução</p>
            </div>
            <div className="mv-aid__item">
              <span className="mv-aid__item-ic">{IC.grafico}</span>
              <p>Acompanhar evolução ao longo do tempo</p>
            </div>
          </div>

          <div className="cta-band">
            <span className="cta-band__bar" aria-hidden="true" />
            <span className="cta-band__big-ic" aria-hidden="true">{IC.alvo}</span>
            <div className="cta-band__text">
              <div className="t">
                Clareza para <span className="terra-text">decidir.</span>
                <br />
                Critério para <span className="terra-text">sustentar.</span>
                <br />
                Inteligência para <span className="terra-text">evoluir.</span>
              </div>
            </div>
            <div className="cta-band__actions">
              <a href="#diagnostico" className="btn btn--terra">
                Gerar MAPA →
              </a>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-light">
                Agendar conversa estratégica →
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
