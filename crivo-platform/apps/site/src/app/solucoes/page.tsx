import type { Metadata } from "next";
import { LpEffects } from "../lp/LpEffects";
import { SiteNav } from "../_site/SiteNav";
import { SiteFooter } from "../_site/SiteFooter";
import { WHATSAPP_ESPECIALISTA } from "../_site/site.config";
import { IC } from "../_site/icons";
import "../lp/lp.css";
import "./solucoes.css";

export const metadata: Metadata = {
  title: "Soluções CRIVO™ — Mapa Executivo, Diagnóstico, Liderança e Advisory",
  description:
    "Navegue pelas soluções CRIVO™ e entenda quando usar, o que entrega e qual o próximo passo para a sua empresa: Mapa Executivo, Diagnóstico, Gestão da Rotina, Liderança, Evolução, Enterprise e Advisory.",
};

// Ícones de traço adicionais (mesmo estilo de ../_site/icons.tsx), específicos
// desta página — não usados em outras rotas, por isso não foram para o IC global.
const ICX = {
  calendario: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  diamante: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 22 12 12 22 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M2 12h20M12 2v20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  ),
  predios: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="5" height="11" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="5" width="5" height="16" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17" y="13" width="4" height="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  ciclo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.9-5.4M20 12a8 8 0 0 1-13.9 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  integracao: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="12" r="6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="12" r="6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  maleta: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const SOL_TABS = [
  { id: "mapa-executivo", num: "01", label: "Mapa Executivo" },
  { id: "diagnostico-sol", num: "02", label: "Diagnóstico" },
  { id: "gestao-da-rotina", num: "03", label: "Gestão da Rotina" },
  { id: "lideranca", num: "04", label: "Liderança" },
  { id: "evolucao", num: "05", label: "Evolução" },
  { id: "enterprise", num: "06", label: "Enterprise" },
  { id: "advisory", num: "07", label: "Advisory" },
];

function SolTabs({ current }: { current: string }) {
  return (
    <nav className="sol-tabs" aria-label="Soluções CRIVO™">
      {SOL_TABS.map((t) => (
        <a key={t.id} href={`#${t.id}`} className={t.id === current ? "is-active" : ""}>
          <span className="sol-tabs__num">{t.num}</span>
          <span className="sol-tabs__label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function SolucoesPage() {
  return (
    <>
      <LpEffects />
      <SiteNav />

      {/* ============ HERO DA PÁGINA (tela 09) ============ */}
      <section className="section section--light" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div className="sol-hero__inner">
            <div>
              <span className="eyebrow eyebrow--terra">Soluções CRIVO™</span>
              <h1 className="h2">
                Aprofunde a jornada
                <br />
                CRIVO <span className="terra-text">por solução.</span>
              </h1>
              <span className="rule-terra" aria-hidden="true" />
              <p className="lede" style={{ marginBottom: 0 }}>
                Navegue pelas soluções e entenda quando usar, o que entrega e qual próximo passo para a sua empresa.
              </p>
            </div>
            <div className="sol-illus" aria-hidden="true">
              <svg viewBox="0 0 480 260" fill="none">
                <path
                  d="M20 210 C 90 210, 90 150, 160 150 S 230 90, 300 90 S 370 40, 460 40"
                  stroke="#1B3A6B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.55"
                />
                <path
                  d="M20 230 C 90 230, 120 190, 190 190 S 260 150, 330 150 S 400 110, 460 90"
                  stroke="#C4671D"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="1 8"
                  opacity="0.6"
                />
                <circle cx="160" cy="150" r="6" fill="#C4671D" />
                <circle cx="300" cy="90" r="6" fill="#1B3A6B" />
                <circle cx="460" cy="40" r="7" fill="#C4671D" />
              </svg>
              <div className="sol-illus__card sol-illus__card--1">
                {IC.grafico} Indicadores
              </div>
              <div className="sol-illus__card sol-illus__card--2">
                {IC.prancheta} Plano de ação
              </div>
            </div>
          </div>

          {/* ============ 01 · MAPA EXECUTIVO (tela 09) ============ */}
          <div id="mapa-executivo">
            <SolTabs current="mapa-executivo" />

            <div className="sol-block">
              <div className="solu-card">
                <div className="solu-card__main">
                  <span className="solu-card__icon">{IC.alvo}</span>
                  <h3>Mapa Executivo CRIVO™</h3>
                  <span className="solu-card__sub">Clareza inicial para orientar o próximo passo.</span>
                  <p>
                    Uma leitura executiva preliminar para identificar prioridades, riscos invisíveis e oportunidades
                    de avanço em liderança, cultura, rotina, fatores psicossociais e preparação para IA.
                  </p>
                  <div className="solu-card__ctas">
                    <a href="#diagnostico" className="btn btn--terra">
                      Gerar MAPA Executivo →
                    </a>
                    <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                      Agendar conversa estratégica →
                    </a>
                  </div>
                </div>
                <div className="solu-card__col">
                  <span className="solu-card__col-ic">{ICX.calendario}</span>
                  <h4>Quando usar</h4>
                  <span className="rule-terra" aria-hidden="true" />
                  <ul className="checks">
                    <li>{IC.check} Primeiro contato com a CRIVO</li>
                    <li>{IC.check} Momento de crescimento ou pressão</li>
                    <li>{IC.check} Necessidade de clareza executiva</li>
                  </ul>
                </div>
                <div className="solu-card__col">
                  <span className="solu-card__col-ic">{IC.prancheta}</span>
                  <h4>O que entrega</h4>
                  <span className="rule-terra" aria-hidden="true" />
                  <ul className="checks">
                    <li>{IC.check} Leitura preliminar</li>
                    <li>{IC.check} Prioridades de atenção</li>
                    <li>{IC.check} Relatório inicial + e-book</li>
                  </ul>
                </div>
                <div className="solu-card__col">
                  <span className="solu-card__col-ic">{IC.seta}</span>
                  <h4>Próximo passo</h4>
                  <span className="rule-terra" aria-hidden="true" />
                  <ul className="checks">
                    <li>{IC.check} Gerar MAPA</li>
                    <li>{IC.check} Receber devolutiva</li>
                    <li>{IC.check} Definir rota de avanço</li>
                  </ul>
                </div>
              </div>

              <div className="sol-side">
                <h4>Da leitura inicial à rota de avanço.</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul>
                  <li><span className="sol-side__ic">{IC.lupa}</span>Contexto</li>
                  <li><span className="sol-side__ic">{IC.prancheta}</span>Prioridades</li>
                  <li><span className="sol-side__ic">{IC.alerta}</span>Riscos invisíveis</li>
                  <li><span className="sol-side__ic">{IC.balao}</span>Devolutiva</li>
                  <li><span className="sol-side__ic">{IC.seta}</span>Próximo passo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 02 · DIAGNÓSTICO (tela 10) ============ */}
      <section id="diagnostico-sol" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="diagnostico-sol" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{IC.lupa}</span>
                <h3>Diagnóstico CRIVO™</h3>
                <span className="solu-card__sub">Leitura estruturada para riscos, cultura, liderança e rotina.</span>
                <p>Base de dados, evidências e plano de ação para orientar decisões e prioridades.</p>

                <div className="sol-nr1">
                  <span className="sol-nr1__badge">NR-1</span>
                  <div>
                    <strong>Também atende à NR-1</strong>
                    <span>Apoia identificação, avaliação, controle e monitoramento dos fatores psicossociais.</span>
                  </div>
                </div>

                <div className="solu-card__ctas">
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--terra">
                    Solicitar diagnóstico →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Riscos ou sinais recorrentes</li>
                  <li>{IC.check} Prioridades pouco claras</li>
                  <li>{IC.check} Necessidade de dados e evidências</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Diagnóstico estruturado</li>
                  <li>{IC.check} Base de dados por fatores críticos</li>
                  <li>{IC.check} Prioridades e plano de ação</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Solicitar diagnóstico</li>
                  <li>{IC.check} Analisar riscos e prioridades</li>
                  <li>{IC.check} Definir plano de acompanhamento</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Diagnóstico para gestão contínua</h4>
              <span className="sol-side__lead">Dados e evidências para decisões.</span>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{IC.prancheta}</span><span><span className="sol-side__code">PLAN</span>Planejar</span></li>
                <li><span className="sol-side__ic">{IC.engrenagem}</span><span><span className="sol-side__code">DO</span>Executar</span></li>
                <li><span className="sol-side__ic">{IC.grafico}</span><span><span className="sol-side__code">CHECK</span>Acompanhar</span></li>
                <li><span className="sol-side__ic">{IC.seta}</span><span><span className="sol-side__code">ACT</span>Ajustar</span></li>
              </ul>
              <p className="sol-side__flow">Dados → Evidências → Decisões → Resultados</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 03 · GESTÃO DA ROTINA (tela 11) ============ */}
      <section id="gestao-da-rotina" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="gestao-da-rotina" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{IC.engrenagem}</span>
                <h3>Gestão da Rotina CRIVO™</h3>
                <span className="solu-card__sub">Execução com cadência, responsáveis, prazos e evidências.</span>
                <p>
                  Um sistema de acompanhamento para transformar prioridades em rotina executiva, organizar decisões,
                  reduzir ruídos e sustentar a execução com clareza e consistência.
                </p>
                <div className="solu-card__ctas">
                  <a href="#diagnostico" className="btn btn--terra">
                    Organizar execução →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Muitas prioridades em aberto</li>
                  <li>{IC.check} Execução sem cadência</li>
                  <li>{IC.check} Planos sem acompanhamento</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Rituais de gestão</li>
                  <li>{IC.check} Plano de ação estruturado</li>
                  <li>{IC.check} Indicadores e evidências</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Organizar execução</li>
                  <li>{IC.check} Definir responsáveis</li>
                  <li>{IC.check} Acompanhar ciclos</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Da prioridade à execução acompanhada.</h4>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{IC.alvo}</span>Prioridades</li>
                <li><span className="sol-side__ic">{IC.pessoas}</span>Responsáveis</li>
                <li><span className="sol-side__ic">{ICX.calendario}</span>Rituais</li>
                <li><span className="sol-side__ic">{IC.documento}</span>Evidências</li>
                <li><span className="sol-side__ic">{ICX.ciclo}</span>Ciclos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 04 · LIDERANÇA (tela 12) ============ */}
      <section id="lideranca" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="lideranca" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{IC.pessoas}</span>
                <h3>Liderança CRIVO™</h3>
                <span className="solu-card__sub">Desenvolvimento aplicado para decisões, conversas e execução.</span>
                <p>
                  Trilhas e práticas para fortalecer líderes na tomada de decisão, comunicação, alinhamento, gestão
                  de conflitos, sustentação de cultura e responsabilidade sobre resultados.
                </p>
                <div className="solu-card__ctas">
                  <a href="#diagnostico" className="btn btn--terra">
                    Desenvolver lideranças →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Lideranças sob pressão</li>
                  <li>{IC.check} Conversas difíceis e desalinhamento</li>
                  <li>{IC.check} Cultura precisa virar prática</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Trilhas aplicadas</li>
                  <li>{IC.check} Rituais de liderança</li>
                  <li>{IC.check} Práticas para decisão e alinhamento</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Desenvolver lideranças</li>
                  <li>{IC.check} Definir trilha</li>
                  <li>{IC.check} Acompanhar aplicação</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Da decisão individual à liderança sustentada.</h4>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{IC.alvo}</span>Decisões</li>
                <li><span className="sol-side__ic">{IC.balao}</span>Conversas</li>
                <li><span className="sol-side__ic">{IC.pessoas}</span>Alinhamento</li>
                <li><span className="sol-side__ic">{IC.escudo}</span>Cultura</li>
                <li><span className="sol-side__ic">{IC.grafico}</span>Execução</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 05 · EVOLUÇÃO (tela 13) ============ */}
      <section id="evolucao" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="evolucao" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{IC.grafico}</span>
                <h3>Evolução CRIVO™</h3>
                <span className="solu-card__sub">Plano vivo, ciclos, indicadores e evidências.</span>
                <p>
                  Acompanhamento executivo para medir avanços, ajustar rotas, consolidar aprendizados e sustentar a
                  evolução com dados, registros e decisões acompanhadas.
                </p>
                <div className="solu-card__ctas">
                  <a href="#diagnostico" className="btn btn--terra">
                    Acompanhar evolução →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Transformação em andamento</li>
                  <li>{IC.check} Planos que precisam evoluir</li>
                  <li>{IC.check} Necessidade de indicadores e evidências</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Ciclos de acompanhamento</li>
                  <li>{IC.check} Indicadores de evolução</li>
                  <li>{IC.check} Registros e aprendizados</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Acompanhar evolução</li>
                  <li>{IC.check} Ajustar rotas</li>
                  <li>{IC.check} Sustentar resultados</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Da execução ao aprendizado contínuo.</h4>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{ICX.ciclo}</span>Ciclos</li>
                <li><span className="sol-side__ic">{IC.grafico}</span>Indicadores</li>
                <li><span className="sol-side__ic">{IC.documento}</span>Evidências</li>
                <li><span className="sol-side__ic">{IC.engrenagem}</span>Ajustes</li>
                <li><span className="sol-side__ic">{IC.alvo}</span>Resultados</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 06 · ENTERPRISE (tela 14) ============ */}
      <section id="enterprise" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="enterprise" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{ICX.predios}</span>
                <h3>CRIVO Enterprise™</h3>
                <span className="solu-card__sub">
                  Transformação em escala com método, dados, governança e execução acompanhada.
                </span>
                <p>
                  Uma jornada integrada para empresas complexas que precisam conectar diagnóstico, liderança,
                  cultura, indicadores, plano de ação e evolução em múltiplas áreas, unidades ou frentes
                  estratégicas.
                </p>
                <div className="solu-card__ctas">
                  <a href="#diagnostico" className="btn btn--terra">
                    Estruturar transformação →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Empresas com múltiplas áreas ou unidades</li>
                  <li>{IC.check} Transformação cultural ou organizacional</li>
                  <li>{IC.check} Necessidade de governança e escala</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Arquitetura integrada da jornada</li>
                  <li>{IC.check} Indicadores e evidências por frente</li>
                  <li>{IC.check} Ritmo executivo de acompanhamento</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Estruturar transformação</li>
                  <li>{IC.check} Definir frentes prioritárias</li>
                  <li>{IC.check} Implantar governança de evolução</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Da complexidade à execução coordenada.</h4>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{IC.lupa}</span>Diagnóstico</li>
                <li><span className="sol-side__ic">{IC.escudo}</span>Governança</li>
                <li><span className="sol-side__ic">{IC.grafico}</span>Indicadores</li>
                <li><span className="sol-side__ic">{IC.documento}</span>Plano de ação</li>
                <li><span className="sol-side__ic">{IC.seta}</span>Evolução</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 07 · ADVISORY (tela 15) ============ */}
      <section id="advisory" className="section section--light" style={{ paddingTop: 0 }}>
        <div className="container">
          <SolTabs current="advisory" />

          <div className="sol-block">
            <div className="solu-card">
              <div className="solu-card__main">
                <span className="solu-card__icon">{IC.bussola}</span>
                <h3>CRIVO Advisory™</h3>
                <span className="solu-card__sub">
                  Aconselhamento executivo para decisões críticas de crescimento, sucessão, governança e
                  transformação.
                </span>
                <p>
                  Uma frente consultiva para sócios, fundadores, conselhos, CEOs e executivos que precisam decidir
                  com critério em momentos de alta complexidade, pressão ou mudança estratégica.
                </p>
                <div className="solu-card__ctas">
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--terra">
                    Solicitar advisory estratégico →
                  </a>
                  <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--outline-dark">
                    Agendar conversa estratégica →
                  </a>
                </div>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{ICX.calendario}</span>
                <h4>Quando usar</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Decisões críticas de alta gestão</li>
                  <li>{IC.check} Crescimento, sucessão ou expansão</li>
                  <li>{IC.check} Mudanças com impacto cultural e organizacional</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.prancheta}</span>
                <h4>O que entrega</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Leitura estratégica do contexto</li>
                  <li>{IC.check} Cenários e critérios de decisão</li>
                  <li>{IC.check} Recomendações executivas</li>
                </ul>
              </div>
              <div className="solu-card__col">
                <span className="solu-card__col-ic">{IC.seta}</span>
                <h4>Próximo passo</h4>
                <span className="rule-terra" aria-hidden="true" />
                <ul className="checks">
                  <li>{IC.check} Solicitar advisory estratégico</li>
                  <li>{IC.check} Definir tema crítico</li>
                  <li>{IC.check} Conduzir agenda executiva</li>
                </ul>
              </div>
            </div>

            <div className="sol-side">
              <h4>Critério para decisões de alto impacto.</h4>
              <span className="rule-terra" aria-hidden="true" />
              <ul>
                <li><span className="sol-side__ic">{IC.lupa}</span>Contexto</li>
                <li><span className="sol-side__ic">{IC.bussola}</span>Cenários</li>
                <li><span className="sol-side__ic">{IC.prancheta}</span>Critérios</li>
                <li><span className="sol-side__ic">{IC.alvo}</span>Decisão</li>
                <li><span className="sol-side__ic">{IC.escudo}</span>Sustentação</li>
              </ul>
            </div>
          </div>

          {/* ============ CRIVO Plus™ — banda final única (rodapé, tela 09/15) ============ */}
          <div className="sol-plus">
            <div>
              <span className="sol-plus__icon">{ICX.diamante}</span>
              <h3>CRIVO Plus™</h3>
              <span className="sol-plus__sub">
                Projetos especiais para desafios complexos de gestão, cultura, dados e transformação.
              </span>
              <p>
                Quando a empresa precisa ir além da jornada padrão, a CRIVO estrutura frentes sob medida com
                diagnóstico, governança, evidências e acompanhamento executivo.
              </p>
              <a href={WHATSAPP_ESPECIALISTA} target="_blank" rel="noopener" className="btn btn--terra">
                Conversar sobre CRIVO Plus →
              </a>
            </div>
            <div className="sol-plus__grid">
              <div className="sol-plus__item">{IC.escudo} Governança de IA e Pessoas</div>
              <div className="sol-plus__item">{IC.pessoas} Workforce Planning</div>
              <div className="sol-plus__item">{IC.grafico} People Analytics</div>
              <div className="sol-plus__item">{IC.alvo} Radar de Custos Invisíveis</div>
              <div className="sol-plus__item">{IC.pessoas} Transformação Cultural</div>
              <div className="sol-plus__item">{IC.pessoas} Sucessão e Empresas Familiares</div>
              <div className="sol-plus__item">{ICX.integracao} M&amp;A e Integração</div>
              <div className="sol-plus__item">{ICX.maleta} Profissionalização da Gestão</div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
