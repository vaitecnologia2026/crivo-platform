// Seções compartilhadas da CRIVO — fonte ÚNICA de verdade.
// Renderizadas tanto na Home (/lp, sequência das 16 seções, print Pág. 01)
// quanto nas páginas dedicadas (/metodo, /plataforma, /solucoes).
// Assim "Híbrido" (Home completa + páginas separadas) não vira duplicação:
// um print futuro corrige a seção aqui e reflete nos dois lugares.

/* ============================================================
   MÉTODO CRIVO (print Pág. 05)
   ============================================================ */
export function MetodoSection() {
  return (
    <section className="section section--light" id="metodo">
      <div className="container">
        <span className="eyebrow">Metodologia</span>
        <h2 className="h2">Método CRIVO: clareza para decidir, sustentar e evoluir.</h2>
        <p className="lede">
          O CRIVO traduz percepção, responsabilidade, integração, valores e organização em prática de liderança,
          qualidade de decisão e evolução cultural mensurável.
        </p>

        <div className="crivo-flow">
          <article className="crivo-step">
            <span className="crivo-step__letter">C</span>
            <h3>Consciência</h3>
            <p>Ler o contexto e reconhecer pressões para ampliar a clareza antes de decidir.</p>
            <span className="crivo-step__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
            </span>
          </article>
          <article className="crivo-step">
            <span className="crivo-step__letter">R</span>
            <h3>Responsabilidade</h3>
            <p>Assumir escolhas, consequências e compromissos de execução.</p>
            <span className="crivo-step__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </span>
          </article>
          <article className="crivo-step">
            <span className="crivo-step__letter">I</span>
            <h3>Integração</h3>
            <p>Conectar pessoas, áreas, comunicação e prioridades com alinhamento.</p>
            <span className="crivo-step__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 18c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.5" /><path d="M16.5 13c2.2.3 4 2.1 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </span>
          </article>
          <article className="crivo-step">
            <span className="crivo-step__letter">V</span>
            <h3>Valores</h3>
            <p>Decidir com critério, propósito e coerência cultural.</p>
            <span className="crivo-step__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </span>
          </article>
          <article className="crivo-step">
            <span className="crivo-step__letter">O</span>
            <h3>Organização</h3>
            <p>Transformar decisões em rotina, plano de ação, acompanhamento e resultado.</p>
            <span className="crivo-step__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M10 5h10M10 12h10M10 19h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M4 5l1.4 1.4L8 4M4 12l1.4 1.4L8 11M4 19l1.4 1.4L8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </article>
        </div>

        <div className="metodo-cycle">
          <span className="metodo-cycle__h">Do método à evolução</span>
          <div className="metodo-cycle__steps">
            <div className="cycle-step">
              <span className="cycle-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.5" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <strong>Qualidade de decisão</strong>
            </div>
            <span className="cycle-arrow" aria-hidden="true">→</span>
            <div className="cycle-step">
              <span className="cycle-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M9 4V3h6v1M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <strong>Plano de ação</strong>
            </div>
            <span className="cycle-arrow" aria-hidden="true">→</span>
            <div className="cycle-step">
              <span className="cycle-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <strong>Rotina e execução</strong>
            </div>
            <span className="cycle-arrow" aria-hidden="true">→</span>
            <div className="cycle-step">
              <span className="cycle-step__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <strong>Evolução mensurável</strong>
            </div>
          </div>
          <p className="metodo-cycle__foot">
            Um ciclo contínuo que fortalece a liderança, sustenta a cultura e gera resultados.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ICD — Índice de Coerência Decisória (print Pág. 06)
   ============================================================ */
export function IcdSection() {
  return (
    <section className="section section--dark" id="icd">
      <div className="container">
        <span className="eyebrow eyebrow--terra" style={{ justifyContent: "center" }}>
          Diferencial proprietário
        </span>
        <h2 className="h2 h2--light h2--center">ICD — Índice de Coerência Decisória</h2>
        <p className="lede lede--light" style={{ textAlign: "center", margin: "0 auto 8px", maxWidth: 900 }}>
          O ICD apoia líderes e organizações na leitura da coerência da decisão sob pressão. Mostra onde a decisão
          ganha ou perde sustentação — para decidir com mais clareza e consistência.
        </p>

        {/* Eixos oficiais do ICD — régua horizontal de 4 eixos (print Pág. 02) */}
        <div className="icd-axes">
          <span className="icd-axes__label">Eixos oficiais do ICD</span>
          <div className="icd-axes__track">
            <article className="icd-node">
              <span className="icd-node__circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" /></svg>
              </span>
              <strong>Clareza</strong>
              <p>Qualidade da leitura do contexto e da situação.</p>
            </article>
            <article className="icd-node">
              <span className="icd-node__circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M6 21h12M5 7h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M5 7l-2.3 5.4a2.8 2.8 0 0 0 4.6 0L5 7ZM19 7l-2.3 5.4a2.8 2.8 0 0 0 4.6 0L19 7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </span>
              <strong>Critério</strong>
              <p>Qualidade dos critérios e da lógica que sustentam a decisão.</p>
            </article>
            <article className="icd-node">
              <span className="icd-node__circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6.5" r="2.6" stroke="currentColor" strokeWidth="1.6" /><circle cx="5" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.6" /><circle cx="19" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.6" /><path d="M8 17.5c0-2.2 1.8-4 4-4s4 1.8 4 4M2 17.5c0-1.7 1.3-3 3-3.1M22 17.5c0-1.7-1.3-3-3-3.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <strong>Alinhamento</strong>
              <p>Coerência entre decisão, pessoas impactadas e propósito.</p>
            </article>
            <article className="icd-node">
              <span className="icd-node__circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </span>
              <strong>Sustentação</strong>
              <p>Capacidade de sustentar a decisão ao longo do tempo e das tensões.</p>
            </article>
          </div>
        </div>

        <div className="grid grid--3 icd-delivers">
          <div className="deliver-card">
            <span className="deliver-card__tag">Para o líder</span>
            <p>Decisões mais coerentes, confiantes e sustentáveis sob pressão.</p>
          </div>
          <div className="deliver-card">
            <span className="deliver-card__tag">Para a empresa</span>
            <p>Decisões alinhadas à estratégia, com mais consistência e previsibilidade.</p>
          </div>
          <div className="deliver-card">
            <span className="deliver-card__tag">Para o RH</span>
            <p>Evidência qualificada para desenvolver líderes e reduzir riscos organizacionais.</p>
          </div>
        </div>

        <p className="icd-tagline">Não é teste de personalidade. É leitura de coerência decisória.</p>

        <div className="cta-inline">
          <a href="/lp#diagnostico" className="btn btn--terra">
            Conhecer o ICD →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   JORNADA CRIVO
   ============================================================ */
export function JornadaSection() {
  return (
    <section className="section section--light" id="jornada">
      <div className="container">
        <span className="eyebrow">A jornada CRIVO</span>
        <h2 className="h2">Do diagnóstico à sustentação da mudança.</h2>
        <p className="lede">
          Uma jornada de transformação clara: leitura inicial, diagnóstico, dashboard, plano de ação, desenvolvimento
          da liderança e evolução contínua — no Portal Executivo e no app CRIVO. O diagnóstico mostra onde atuar; a
          liderança sustenta a mudança na rotina.
        </p>

        <ol className="journey">
          <li className="journey-step"><span className="journey-step__num">01</span><strong>E-book</strong><span>Material técnico de entrada sobre NR-1 e liderança.</span></li>
          <li className="journey-step"><span className="journey-step__num">02</span><strong>Diagnóstico inicial</strong><span>Leitura preliminar gratuita do risco decisório.</span></li>
          <li className="journey-step"><span className="journey-step__num">03</span><strong>Conversa estratégica</strong><span>Análise com um especialista CRIVO.</span></li>
          <li className="journey-step"><span className="journey-step__num">04</span><strong>Diagnóstico contratado</strong><span>Diagnóstico completo e oficial da organização.</span></li>
          <li className="journey-step journey-step--hl"><span className="journey-step__num">05</span><strong>Portal Executivo</strong><span>Acesso logado para gerir o diagnóstico.</span></li>
          <li className="journey-step journey-step--hl"><span className="journey-step__num">06</span><strong>Dashboard</strong><span>ICD, indicadores e mapa de riscos em tempo real.</span></li>
          <li className="journey-step"><span className="journey-step__num">07</span><strong>Plano de ação</strong><span>Estratégia com método, prioridade e prazo.</span></li>
          <li className="journey-step journey-step--hl"><span className="journey-step__num">08</span><strong>App CRIVO</strong><span>Transformação na rotina dos líderes.</span></li>
          <li className="journey-step"><span className="journey-step__num">09</span><strong>Acompanhamento</strong><span>Leitura evolutiva e desenvolvimento contínuo.</span></li>
        </ol>
      </div>
    </section>
  );
}

/* ============================================================
   PORTAL EXECUTIVO
   ============================================================ */
export function PortalSection() {
  return (
    <section className="section section--light" id="portal">
      <div className="container">
        <span className="eyebrow">Portal Executivo</span>
        <h2 className="h2">A visão executiva da sua organização — em uma leitura.</h2>
        <p className="lede">
          Visão organizacional completa, com indicadores, gráficos e mapa de riscos psicossociais. Login seguro,
          plano de ação e evidências — tudo agregado e protegido pela LGPD.
        </p>

        <div className="laptop" role="img" aria-label="Portal Executivo CRIVO: Índice Geral 78, taxa de adesão 84%, fatores psicossociais, áreas críticas e liderança">
          <div className="laptop__screen">
            <div className="dashshot">
              <div className="dashshot__bar" aria-hidden="true">
                <span className="dashshot__brand">CRIVO</span>
                <span className="dashshot__crumb">Portal Executivo · Empresa Demo</span>
                <span className="dashshot__dots"><i /><i /><i /></span>
              </div>
              <div className="dashshot__grid">
                <div className="ds-tile ds-tile--index">
                  <span className="ds-tile__label">Índice Geral CRIVO</span>
                  <p className="ds-index"><strong>78</strong><span>/100</span></p>
                  <span className="ds-pill ds-pill--ok">Saúde organizacional · Boa</span>
                </div>
                <div className="ds-tile ds-tile--wide">
                  <span className="ds-tile__label">Evolução do índice</span>
                  <svg className="ds-line" viewBox="0 0 240 84" preserveAspectRatio="none" aria-hidden="true">
                    <polyline points="4,64 38,58 72,62 106,46 140,50 174,34 208,38 236,22" />
                    <circle cx="236" cy="22" r="3.5" />
                  </svg>
                  <div className="ds-line__axis"><span>jan</span><span>jun</span></div>
                </div>
                <div className="ds-tile">
                  <span className="ds-tile__label">Taxa de adesão</span>
                  <p className="ds-big">84%</p>
                  <span className="ds-tile__sub">Participação geral · +12 p.p.</span>
                </div>
                <div className="ds-tile">
                  <span className="ds-tile__label">Áreas críticas</span>
                  <ul className="ds-areas">
                    <li>Carga de trabalho <em className="ds-tag ds-tag--high">Alto</em></li>
                    <li>Relações de trabalho <em className="ds-tag ds-tag--mid">Médio</em></li>
                    <li>Reconhecimento <em className="ds-tag ds-tag--mid">Médio</em></li>
                  </ul>
                </div>
                <div className="ds-tile">
                  <span className="ds-tile__label">Fatores psicossociais</span>
                  <div className="ds-donut-wrap">
                    <span className="ds-donut" aria-hidden="true" />
                    <ul className="ds-legend">
                      <li><i className="is-high" /> Alto 36%</li>
                      <li><i className="is-mid" /> Médio 48%</li>
                      <li><i className="is-low" /> Baixo 16%</li>
                    </ul>
                  </div>
                </div>
                <div className="ds-tile">
                  <span className="ds-tile__label">Liderança e cultura</span>
                  <div className="ds-meter"><span>Segurança psicológica</span><i style={{ width: "74%" }} /><b>74</b></div>
                  <div className="ds-meter"><span>Coerência de liderança</span><i style={{ width: "71%" }} /><b>71</b></div>
                </div>
              </div>
            </div>
          </div>
          <div className="laptop__base" aria-hidden="true" />
        </div>

        <div className="dash-kpis">
          <div className="dash-kpi">
            <span className="dash-kpi__label">Plano de ação</span>
            <strong className="dash-kpi__num">32</strong>
            <span className="dash-kpi__sub">ações em andamento</span>
            <div className="dash-kpi__bar"><i style={{ width: "64%" }} /></div>
            <span className="dash-kpi__foot">18 concluídas · 14 em andamento · 4 atrasadas</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi__label">Evidências</span>
            <strong className="dash-kpi__num">112</strong>
            <span className="dash-kpi__sub">registradas</span>
            <span className="dash-kpi__foot dash-kpi__foot--up">+18 esta semana</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi__label">Mapa de riscos psicossociais</span>
            <div className="dash-heat" aria-hidden="true">
              {[1, 2, 3, 2, 3, 4, 3, 4, 4].map((c, i) => (
                <span key={i} className={`dash-heat__c dash-heat__c--${c}`} />
              ))}
            </div>
            <span className="dash-kpi__foot">probabilidade × impacto</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi__label">Tendências</span>
            <div className="dash-bars" aria-hidden="true">
              <i style={{ height: "40%" }} /><i style={{ height: "70%" }} /><i style={{ height: "92%" }} />
            </div>
            <span className="dash-kpi__foot">atenção · estável · melhora</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* DASHBOARD EXECUTIVO: fundido no Portal Executivo (print Pág. 04 série nova) —
   o Portal agora é o mockup de dashboard com indicadores, gráficos e mapa de riscos. */

/* ============================================================
   APP CRIVO (print Pág. 09 / ajustado Pág. 04 série nova)
   ============================================================ */
const APP_FEATURES = [
  { nome: "Meu Estado", desc: "Check-in diário da coerência decisória.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h3.5l2-5.5 3.5 11 2-5.5H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>) },
  { nome: "CRIVO Pocket", desc: "Microaprendizados aplicados à liderança.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3.5h10v17l-5-3.5-5 3.5v-17Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9.5 8h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>) },
  { nome: "Radar da Decisão · ICD™", desc: "Leitura contínua da coerência decisória sob pressão.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M12 12l6-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>) },
  { nome: "Simulador de Decisão", desc: "Ensaie decisões difíceis antes de agir.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="6" cy="18" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.6" /><path d="M6 8.3v7.4M6 11h5.5a4 4 0 0 0 4-4V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>) },
  { nome: "Mentor CRIVO", desc: "Apoio reflexivo e operacional à decisão.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v10H10l-4 3v-3H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.5 10.5h7M8.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>) },
  { nome: "Dashboard do Líder", desc: "Acompanhe sua evolução e plano de desenvolvimento.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>) },
  { nome: "Academia CRIVO", desc: "Cursos, trilhas e conteúdos para desenvolver a liderança.", ic: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4 3 9l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>) },
];

export function AppSection() {
  return (
    <section className="section section--dark" id="app">
      <div className="container">
        <div className="split split--app">
          <div className="split__left">
            <span className="eyebrow eyebrow--terra">App CRIVO · página estratégica</span>
            <h2 className="h2 h2--light">A transformação que acontece na rotina do líder.</h2>
            <p className="body--light">
              O App CRIVO é o seu companheiro diário de decisões. Ele conecta diagnóstico, prática e evolução em uma
              experiência simples, reflexiva e orientada a resultados.
            </p>
            <div className="app-features">
              {APP_FEATURES.map((f) => (
                <div className="app-feature" key={f.nome}>
                  <span className="app-feature__ic" aria-hidden="true">{f.ic}</span>
                  <div className="app-feature__body">
                    <strong>{f.nome}</strong>
                    <span>{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="split__right">
            <div className="phone-stage">
              <div className="phone" role="img" aria-label="Tela do App CRIVO: saudação ao líder, índice de coerência 78, Radar da Decisão e Pocket">
                <span className="phone__notch" aria-hidden="true" />
                <div className="phone__screen">
                  <div className="phone__bar" aria-hidden="true">
                    <span>9:41</span>
                    <span className="phone__brand">CRIVO</span>
                    <span className="phone__status" aria-hidden="true">
                      <svg width="30" height="10" viewBox="0 0 31 10" fill="currentColor">
                        <rect x="0" y="6" width="2" height="4" rx=".5" /><rect x="3.5" y="4" width="2" height="6" rx=".5" /><rect x="7" y="2" width="2" height="8" rx=".5" /><rect x="10.5" y="0" width="2" height="10" rx=".5" />
                        <rect x="17" y="1.5" width="11" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1" /><rect x="18.5" y="3" width="6.5" height="4" rx=".5" /><rect x="29.4" y="3.4" width="1.3" height="3.2" rx=".6" />
                      </svg>
                    </span>
                  </div>
                  <div className="phone__greet">
                    <span className="phone__hello">Bom dia, Líder.</span>
                    <span className="phone__date">Como está sua coerência hoje?</span>
                  </div>
                  <div className="phone__state">
                    <div className="phone__ring phone__ring--lg"><strong>78</strong><em>Coerência</em></div>
                    <span className="phone__checkin">Último check-in: hoje, 07:30</span>
                    <span className="phone__btn">Fazer check-in</span>
                  </div>
                  <span className="phone__label">Em destaque</span>
                  <div className="phone__card">
                    <span className="phone__tag">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }}>
                        <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" />
                      </svg>
                      Radar da Decisão
                    </span>
                    <span className="phone__sub">2 sinais críticos detectados</span>
                  </div>
                  <div className="phone__card">
                    <span className="phone__tag">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }}>
                        <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
                      </svg>
                      CRIVO Pocket
                    </span>
                    <span className="phone__sub">Novo microaprendizado disponível</span>
                  </div>
                  <span className="phone__label">Seu plano</span>
                  <div className="phone__card phone__card--plan">
                    <span className="phone__sub">Próximo passo sugerido</span>
                    <span className="phone__tag">Simulador de Decisão →</span>
                  </div>
                  <div className="phone__nav" aria-hidden="true">
                    <span className="is-active">Início</span>
                    <span>Estado</span>
                    <span>Pocket</span>
                    <span>Plano</span>
                    <span>Mais</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="app-callout">
          <span className="app-callout__ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.2l5.8-.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
          <p>
            O App permanece como <strong>página estratégica</strong> — diferencial de valor e a porta de entrada para a
            rotina do líder.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ECOSSISTEMA & RECURSOS (print Pág. 09)
   ============================================================ */
export function EcossistemaSection() {
  return (
    <section className="section section--light" id="ecossistema">
      <div className="container">
        <span className="eyebrow">Ecossistema &amp; Recursos CRIVO</span>
        <h2 className="h2">Recursos que ampliam sua evolução.</h2>
        <p className="lede">
          Conteúdos, trilhas e inteligência prática que fortalecem lideranças e organizam o conhecimento em ação.
        </p>

        <div className="eco-cards">
          <article className="eco-tile eco-tile--featured">
            <span className="eco-tile__badge">Ecossistema · comece por aqui</span>
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 4 3 9l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </span>
            <h3>Academia CRIVO</h3>
            <p>Cursos e formações para líderes e times, com aplicação prática — o coração do desenvolvimento contínuo.</p>
          </article>
          <article className="eco-tile">
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="m10 9.5 5 2.5-5 2.5v-5Z" fill="currentColor"/></svg>
            </span>
            <h3>Conteúdos e vídeos</h3>
            <p>Vídeos, aulas e microconteúdos para aplicar hoje.</p>
          </article>
          <article className="eco-tile">
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/></svg>
            </span>
            <h3>Trilhas e materiais</h3>
            <p>Jornadas e materiais estruturados por tema e nível de liderança.</p>
          </article>
          <article className="eco-tile">
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M13 3v5h5M9.5 13h5M9.5 16.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </span>
            <h3>Artigos e guias</h3>
            <p>Artigos, guias e checklists para uso no dia a dia.</p>
          </article>
          <article className="eco-tile">
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="m16 10 5-3v10l-5-3v-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </span>
            <h3>Webinars / Cases</h3>
            <p>Webinars, casos reais e entrevistas com especialistas.</p>
          </article>
          <article className="eco-tile">
            <span className="eco-tile__ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5M4 19h16M8 16l3.5-4 3 2.5L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <h3>Inteligência contínua</h3>
            <p>Relatórios, análises e insights para decisões cada vez melhores.</p>
          </article>
        </div>

        <p className="eco-foot">
          O Ecossistema e os Recursos tornam o conhecimento acessível, organizado e sempre atualizado.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   SOLUÇÕES — portfólio modular (print Pág. 07)
   ============================================================ */
const IcSearch = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.6" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>);
const IcChart = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M7 20v-6M12 20V6M17 20v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>);
const IcPeople = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M16 5.4a3 3 0 0 1 0 5.6M17 14c2.1.4 3.7 2.3 3.7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>);
const IcCycle = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11a8 8 0 0 1 13.5-5.2L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 13a8 8 0 0 1-13.5 5.2L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 4v4h-4M4 20v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcBuilding = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10 20.5v-3h4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
const IcStar = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.4 9.7l5.8-.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>);
const IcNodes = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" /><path d="M8 6h8M7.6 8l3.4 8M16.4 8l-3.4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
const IcTrendUp = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 7h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcShield = () => (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 3v5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const PORTFOLIO = [
  { ic: <IcSearch />, nome: "Diagnóstico Inicial", tag: "Entrada · Leitura Preliminar", desc: "Leitura rápida de riscos invisíveis, liderança e pontos de atenção. Relatório Preliminar CRIVO™ em até 24h." },
  { ic: <IcChart />, nome: "CRIVO Diagnóstico™", tag: "Diagnóstico Organizacional", desc: "Diagnóstico estruturado com fatores psicossociais, liderança, cultura e evidências. Dashboard e plano de ação." },
  { ic: <IcPeople />, nome: "CRIVO Liderança", tag: "Jornada de Liderança", desc: "Trilhas, mentorias e app (Radar da Decisão, Academia CRIVO) para desenvolver líderes com foco no que importa." },
  { ic: <IcCycle />, nome: "CRIVO Evolução", tag: "Mentoria & Governança", desc: "Mentoria em grupo, governança comportamental e Radar da Decisão evolutivo, com devolutivas estruturadas." },
  { ic: <IcBuilding />, nome: "CRIVO Enterprise", tag: "Transformação Organizacional", desc: "Jornada completa de transformação: PDCA, mentoria, workshops e sustentação. Ideal para M&A e crescimento." },
  { ic: <IcStar />, nome: "CRIVO Advisory", tag: "Conselho Estratégico", desc: "Conselheiro para C-Level e fundadores. Visão estratégica de governança, cultura e sucessão." },
];

const DIFERENCIAIS = [
  { ic: <IcNodes />, titulo: "Visão integrada", desc: "Não tratamos temas isolados. Conectamos liderança, cultura, riscos, dados e performance em um método único." },
  { ic: <IcTrendUp />, titulo: "Base em ciência e dados", desc: "Diagnóstico com evidências psicossociais e comportamentais aplicadas à realidade do negócio." },
  { ic: <IcCycle />, titulo: "Sustentação que gera resultado", desc: "Do plano à rotina: app, dashboards, mentorias e trilhas para manter a evolução e a disciplina organizacional." },
  { ic: <IcShield />, titulo: "Segurança e conformidade", desc: "Plataforma segura, LGPD by design e aderente às exigências da NR-1." },
];

export function PortfolioSection() {
  return (
    <section className="section section--light" id="solucoes">
      <div className="container">
        <span className="eyebrow" style={{ justifyContent: "center" }}>Portfólio modular</span>
        <h2 className="h2 h2--center">Um nível de atuação para cada estágio.</h2>
        <p className="lede" style={{ textAlign: "center", margin: "0 auto 8px", maxWidth: 820 }}>
          Do diagnóstico ao conselho estratégico — cada solução é um degrau da mesma jornada de transformação.
        </p>

        <div className="sol-core">
          <span className="sol-core__pill">Transformação Organizacional</span>
        </div>
        <svg className="sol-bus" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true">
          <path d="M600 0 V14 M100 14 H1100 M100 14 V40 M300 14 V40 M500 14 V40 M700 14 V40 M900 14 V40 M1100 14 V40" />
        </svg>

        <div className="sol-grid">
          {PORTFOLIO.map((p) => (
            <article className="sol-card" key={p.nome}>
              <span className="sol-card__ic" aria-hidden="true">{p.ic}</span>
              <h3>{p.nome}</h3>
              <span className="sol-card__tag">{p.tag}</span>
              <p>{p.desc}</p>
              <a href="/lp#diagnostico" className="sol-card__more">Saiba mais <span aria-hidden="true">→</span></a>
            </article>
          ))}
        </div>

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
  );
}

export function DiferenciaisSection() {
  return (
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
              <span className="dif-col__ic" aria-hidden="true">{d.ic}</span>
              <strong>{d.titulo}</strong>
              <p>{d.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComparativoSection() {
  return (
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
  );
}
