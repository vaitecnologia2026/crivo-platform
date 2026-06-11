// Gerado de CRIVO-PLATAFORMA/index.html (markup do protótipo, fiel 1:1).
// Renderizado via dangerouslySetInnerHTML; a interatividade vive em PlatEffects.
// A sidebar é GERADA da config única de navegação (F6) — ver nav.config.ts.
import { renderNavHtml } from "./nav.config";

export const PLATFORM_MARKUP = `<!-- ==================== LOGIN ==================== -->
  <div id="login" class="screen screen--login is-active">
    <div class="login__bg"></div>
    <div class="login__panel">
      <div class="login__brand brand__lockup">
        <svg class="vertice" viewBox="0 0 48 44" fill="none" aria-hidden="true">
          <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="24" cy="6" r="3.6" fill="#C4894A"/>
          <circle cx="24" cy="6" r="1.6" fill="#F2F0EC"/>
        </svg>
        <span class="brand__text">
          <span class="brand__name">CRIVO</span>
          <span class="brand__sub">Decision Intelligence</span>
        </span>
      </div>
      <h1 class="login__title">Bem-vindo de volta.</h1>
      <p class="login__sub">Acesse o sistema de coerência decisória, riscos psicossociais e desenvolvimento de liderança.</p>

      <form class="login__form" id="loginForm">
        <div class="field">
          <label for="loginEmail">E-mail corporativo</label>
          <input type="email" id="loginEmail" name="email" placeholder="voce@empresa.com.br" required autocomplete="username" />
        </div>
        <div class="field">
          <label for="loginPassword">Senha</label>
          <input type="password" id="loginPassword" name="password" placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <div class="login__row">
          <label class="check"><input type="checkbox" checked /> Manter conectado</label>
          <a href="#" class="link-gold">Esqueci minha senha</a>
        </div>
        <button type="submit" class="btn btn--gold btn--block">Entrar na plataforma →</button>
        <p class="login__error" id="loginError" role="alert" aria-live="assertive"></p>
      </form>

      <div class="login__footer">
        <span>Não tem acesso?</span>
        <a href="#" class="link-gold">Falar com a CRIVO</a>
      </div>
    </div>
  </div>

  <!-- ==================== APP ==================== -->
  <div id="app" class="screen screen--app">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar__brand brand__lockup">
        <svg class="vertice" viewBox="0 0 48 44" fill="none" aria-hidden="true">
          <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="24" cy="6" r="3.6" fill="#C4894A"/>
          <circle cx="24" cy="6" r="1.6" fill="#F2F0EC"/>
        </svg>
        <span class="brand__text">
          <span class="brand__name">CRIVO</span>
          <span class="brand__sub">Decision Intelligence</span>
        </span>
      </div>

      ${renderNavHtml()}

      <div class="sidebar__footer">
        <div class="org-card">
          <div class="org-card__avatar">EX</div>
          <div>
            <strong>Empresa Exemplo S.A.</strong>
            <span>CRIVO Enterprise</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <main class="main">
      <header class="topbar">
        <div class="topbar__breadcrumb">
          <span class="bc__path" id="bcPath">Dashboard</span>
          <span class="bc__sep">/</span>
          <span class="bc__current" id="bcCurrent">Visão Executiva</span>
        </div>
        <div class="topbar__actions">
          <div class="search">
            <span>⌕</span>
            <input type="text" placeholder="Buscar líder, área, indicador..." />
          </div>
          <button class="icon-btn" title="Notificações">
            <span>🔔</span>
            <span class="badge-dot"></span>
          </button>
          <div class="user-chip">
            <div class="user-chip__avatar">RM</div>
            <div>
              <strong>Rafael Moreira</strong>
              <span>Diretor de RH</span>
            </div>
          </div>
          <button class="icon-btn" id="logoutBtn" title="Sair">↶</button>
        </div>
      </header>

      <!-- ============ DASHBOARD ============ -->
      <section class="route is-active" data-route="dashboard">
        <div id="dash-root"></div>
      </section>

      <!-- ============ ICD ============ -->
      <section class="route" data-route="icd">
        <div id="icd-root"></div>
      </section>

      <!-- ============ QUESTIONÁRIO ============ -->
      <section class="route" data-route="questionario">
        <div id="quiz-root"></div>
      </section>

      <!-- ============ ÁREA DO LÍDER ============ -->
      <section class="route" data-route="lider">
        <div class="route__head">
          <div>
            <h1 class="page-title">Área do Líder</h1>
            <p class="page-sub">Seu plano de desenvolvimento, sessões e a IA de apoio à decisão.</p>
          </div>
          <div class="route__actions">
            <button class="btn btn--outline-dark btn--sm">Agendar mentoria</button>
          </div>
        </div>

        <div class="grid grid--leader">
          <!-- Trilha -->
          <div class="card">
            <div class="card__head">
              <div>
                <h3>Trilha de Desenvolvimento</h3>
                <span class="card__sub">Sua jornada CRIVO — 65% concluído</span>
              </div>
              <span class="pill pill--gold">Mentoria Liderança</span>
            </div>
            <div class="kpi__bar"><div style="width: 65%"></div></div>

            <ul class="trail">
              <li class="trail__item is-done">
                <span class="trail__dot">✓</span>
                <div>
                  <strong>Módulo 1 · Autoconhecimento decisório</strong>
                  <span>Concluído em 14/04</span>
                </div>
              </li>
              <li class="trail__item is-done">
                <span class="trail__dot">✓</span>
                <div>
                  <strong>Módulo 2 · Comunicação sob pressão</strong>
                  <span>Concluído em 02/05</span>
                </div>
              </li>
              <li class="trail__item is-current">
                <span class="trail__dot">3</span>
                <div>
                  <strong>Módulo 3 · Regulação emocional aplicada</strong>
                  <span>Em andamento · 3 sessões restantes</span>
                </div>
                <button class="btn btn--gold btn--sm">Continuar</button>
              </li>
              <li class="trail__item">
                <span class="trail__dot">4</span>
                <div>
                  <strong>Módulo 4 · Coerência estratégica</strong>
                  <span>Liberado em 15/06</span>
                </div>
              </li>
              <li class="trail__item">
                <span class="trail__dot">5</span>
                <div>
                  <strong>Módulo 5 · Decisão em momento de crise</strong>
                  <span>Liberado em 30/06</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- IA Copilot -->
          <div class="card card--copilot">
            <div class="card__head">
              <div>
                <h3>Copiloto CRIVO <span class="badge-ai">IA</span></h3>
                <span class="card__sub">Sua segunda opinião antes de cada decisão difícil.</span>
              </div>
            </div>
            <div class="chat">
              <div class="chat__msg chat__msg--ai">
                <span class="chat__avatar">●</span>
                <div class="chat__bubble">
                  <strong>Copiloto CRIVO</strong>
                  Olá Rafael. Vi que você tem uma reunião difícil agendada para amanhã com o time comercial. Quer pensar junto antes?
                </div>
              </div>
              <div class="chat__msg chat__msg--user">
                <div class="chat__bubble">
                  Sim. Vou ter que comunicar a saída de duas pessoas e a equipe já está sob pressão.
                </div>
              </div>
              <div class="chat__msg chat__msg--ai">
                <span class="chat__avatar">●</span>
                <div class="chat__bubble">
                  <strong>Copiloto CRIVO</strong>
                  Algumas observações pelo seu ICD: você é forte em <em>clareza</em>, mas seu menor índice é em <em>pressão</em> — seu padrão dominante. Sugestões:
                  <ul>
                    <li>Comece pelo contexto antes da decisão — evita a percepção de arbitrariedade.</li>
                    <li>Pause 4 segundos antes de responder perguntas emotivas.</li>
                    <li>Tenha um plano concreto pronto: o time precisa ver caminho, não só notícia.</li>
                  </ul>
                  Quer que eu prepare um roteiro de fala em 3 atos?
                </div>
              </div>
              <div class="chat__msg chat__msg--user">
                <div class="chat__bubble">Sim, prepara.</div>
              </div>
              <div class="chat__msg chat__msg--ai chat__msg--typing">
                <span class="chat__avatar">●</span>
                <div class="chat__bubble">
                  <span class="dots"><span></span><span></span><span></span></span>
                </div>
              </div>
            </div>
            <div class="chat__input">
              <input type="text" placeholder="Pergunte qualquer coisa sobre decisão, conflito ou conversa difícil..." />
              <button class="btn btn--gold btn--sm">Enviar</button>
            </div>
          </div>
        </div>

        <div class="grid grid--3">
          <div class="card card--mini">
            <span class="card__eyebrow">PRÓXIMA SESSÃO</span>
            <h4>Mentoria 1-on-1 · Patricia Lemos</h4>
            <p>Quinta, 22/05 · 14h às 15h30 · Videoconferência</p>
            <a href="#" class="link-gold">Acessar sala →</a>
          </div>
          <div class="card card--mini">
            <span class="card__eyebrow">SEU ICD ATUAL</span>
            <h4>89 <small>/100</small></h4>
            <p>Você está no top 15% da liderança. ▲ +4 pts no último ciclo.</p>
            <a href="#" class="link-gold" data-route-link="icd">Ver detalhe →</a>
          </div>
          <div class="card card--mini">
            <span class="card__eyebrow">MATERIAIS</span>
            <h4>3 novos esta semana</h4>
            <p>Artigo sobre decisão sob pressão, podcast com Reid Hoffman, framework de feedback.</p>
            <a href="#" class="link-gold">Ver biblioteca →</a>
          </div>
        </div>
      </section>

      <!-- ============ RELATÓRIOS ============ -->
      <section class="route" data-route="relatorios">
        <div class="route__head">
          <div>
            <h1 class="page-title">Relatórios & Comunicações</h1>
            <p class="page-sub">Exportações executivas, históricos e avisos da CRIVO.</p>
          </div>
          <div class="route__actions">
            <button class="btn btn--gold btn--sm">Gerar novo relatório</button>
          </div>
        </div>

        <div class="grid grid--2">
          <div class="card">
            <div class="card__head">
              <div>
                <h3>Relatórios disponíveis</h3>
                <span class="card__sub">Documentos prontos para diretoria e auditoria</span>
              </div>
            </div>
            <ul class="reports">
              <li class="report">
                <span class="report__ic">📄</span>
                <div class="report__info">
                  <strong>Diagnóstico NR1 — Ciclo 2026.Q2</strong>
                  <span>Conformidade · 142 páginas · Atualizado 12/05/2026</span>
                </div>
                <button class="btn btn--ghost-dark btn--sm">Baixar PDF</button>
              </li>
              <li class="report">
                <span class="report__ic">📊</span>
                <div class="report__info">
                  <strong>Relatório Executivo — Liderança</strong>
                  <span>Para diretoria · 28 páginas · Atualizado 10/05/2026</span>
                </div>
                <button class="btn btn--ghost-dark btn--sm">Baixar PDF</button>
              </li>
              <li class="report">
                <span class="report__ic">📈</span>
                <div class="report__info">
                  <strong>Evolução do ICD — 6 meses</strong>
                  <span>Comparativo · 18 páginas · Atualizado 08/05/2026</span>
                </div>
                <button class="btn btn--ghost-dark btn--sm">Baixar PDF</button>
              </li>
              <li class="report">
                <span class="report__ic">📋</span>
                <div class="report__info">
                  <strong>Plano de Ação 2026</strong>
                  <span>Tático · 56 páginas · Atualizado 05/05/2026</span>
                </div>
                <button class="btn btn--ghost-dark btn--sm">Baixar PDF</button>
              </li>
              <li class="report">
                <span class="report__ic">🔎</span>
                <div class="report__info">
                  <strong>Auditoria NR1 — Documentação rastreável</strong>
                  <span>Para fiscalização · 84 páginas · Atualizado 01/05/2026</span>
                </div>
                <button class="btn btn--ghost-dark btn--sm">Baixar PDF</button>
              </li>
            </ul>
          </div>

          <div class="card">
            <div class="card__head">
              <div>
                <h3>Avisos em vídeo da CRIVO</h3>
                <span class="card__sub">Comunicações estratégicas para sua liderança</span>
              </div>
              <span class="pill pill--gold">2 novos</span>
            </div>
            <ul class="videos">
              <li class="video">
                <div class="video__thumb">▶</div>
                <div class="video__info">
                  <strong>Atualização NR1 — Maio/2026</strong>
                  <span>5min · Patricia Lemos · Nova</span>
                </div>
              </li>
              <li class="video">
                <div class="video__thumb">▶</div>
                <div class="video__info">
                  <strong>Como interpretar seu ICD trimestral</strong>
                  <span>8min · Time CRIVO · Nova</span>
                </div>
              </li>
              <li class="video">
                <div class="video__thumb">▶</div>
                <div class="video__info">
                  <strong>Caso real — Indústria 800 colaboradores</strong>
                  <span>12min · Estudo de caso</span>
                </div>
              </li>
              <li class="video">
                <div class="video__thumb">▶</div>
                <div class="video__info">
                  <strong>Preparando sua diretoria para a auditoria</strong>
                  <span>15min · Workshop em vídeo</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>


      <!-- ============ CRM · PIPELINE ============ -->
      <section class="route" data-route="crm">
        <div id="crm-root"></div>
      </section>

      <!-- ============ CAMPANHAS NR-1 ============ -->
      <section class="route" data-route="campanhas">
        <div class="route__head">
          <div>
            <h1 class="page-title">Campanhas de Diagnóstico NR-1</h1>
            <p class="page-sub">Crie a campanha, gere os links e acompanhe as respostas em tempo real.</p>
          </div>
          <div class="route__actions">
            <button class="btn btn--gold btn--sm">+ Nova campanha</button>
          </div>
        </div>

        <div class="grid grid--2">
          <div class="card">
            <div class="card__head">
              <div><h3>Campanha ativa · 2026.Q2</h3><span class="card__sub">Encerra em 26/05/2026 · NR-1 + Riscos psicossociais</span></div>
              <span class="pill pill--gold">Em andamento</span>
            </div>
            <div class="camp-progress">
              <div class="camp-progress__top"><strong>68%</strong><span>847 de 1.240 colaboradores responderam</span></div>
              <div class="kpi__bar"><div style="width: 68%"></div></div>
            </div>
            <ul class="camp-sectors">
              <li><span>Operações</span><div class="bar"><div class="bar__fill bar__fill--low" style="width: 82%"></div></div><em>82%</em></li>
              <li><span>Comercial</span><div class="bar"><div class="bar__fill bar__fill--low" style="width: 74%"></div></div><em>74%</em></li>
              <li><span>Financeiro</span><div class="bar"><div class="bar__fill bar__fill--mid" style="width: 55%"></div></div><em>55%</em></li>
              <li><span>Tecnologia</span><div class="bar"><div class="bar__fill bar__fill--mid" style="width: 48%"></div></div><em>48%</em></li>
              <li><span>Marketing</span><div class="bar"><div class="bar__fill bar__fill--high" style="width: 31%"></div></div><em>31%</em></li>
            </ul>
          </div>

          <div class="card">
            <div class="card__head">
              <div><h3>Distribuição de links</h3><span class="card__sub">Geração e envio por canal — anônimo e rastreável por setor</span></div>
            </div>
            <ul class="links-list">
              <li class="link-row"><span class="link-row__ic">◭</span><div><strong>Operações · 320 colaboradores</strong><span>crivo.app/d/op-2q26 · enviado via WhatsApp</span></div><button class="btn btn--ghost-dark btn--sm">Copiar link</button></li>
              <li class="link-row"><span class="link-row__ic">◭</span><div><strong>Comercial · 210 colaboradores</strong><span>crivo.app/d/cm-2q26 · enviado via e-mail</span></div><button class="btn btn--ghost-dark btn--sm">Copiar link</button></li>
              <li class="link-row"><span class="link-row__ic">◭</span><div><strong>Financeiro · 140 colaboradores</strong><span>crivo.app/d/fn-2q26 · reenvio agendado</span></div><button class="btn btn--ghost-dark btn--sm">Copiar link</button></li>
              <li class="link-row"><span class="link-row__ic">◭</span><div><strong>Tecnologia · 180 colaboradores</strong><span>crivo.app/d/tc-2q26 · WhatsApp</span></div><button class="btn btn--ghost-dark btn--sm">Copiar link</button></li>
            </ul>
            <button class="btn btn--outline-dark btn--block" style="margin-top:16px">Disparar lembrete para pendentes</button>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><div><h3>Histórico de campanhas</h3><span class="card__sub">Baseline e evolução por ciclo</span></div></div>
          <table class="data-table">
            <thead><tr><th>Campanha</th><th>Período</th><th>Respondentes</th><th>Adesão</th><th>ICD médio</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td><strong>NR-1 · 2026.Q2</strong></td><td>Mai/2026</td><td>847 / 1.240</td><td>68%</td><td><span class="score-pill score-pill--mid">80</span></td><td><span class="pattern-tag">Ativa</span></td></tr>
              <tr><td><strong>NR-1 · 2026.Q1</strong></td><td>Fev/2026</td><td>1.190 / 1.240</td><td>96%</td><td><span class="score-pill score-pill--mid">76</span></td><td><span class="pattern-tag">Encerrada</span></td></tr>
              <tr><td><strong>Baseline inicial</strong></td><td>Nov/2025</td><td>1.205 / 1.240</td><td>97%</td><td><span class="score-pill score-pill--low">71</span></td><td><span class="pattern-tag">Encerrada</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ PARECER CRIVO ============ -->
      <section class="route" data-route="parecer">
        <div class="route__head">
          <div>
            <h1 class="page-title">Parecer Consultivo CRIVO</h1>
            <p class="page-sub">Os dados são automáticos. A leitura final é de um especialista — não de um algoritmo.</p>
          </div>
          <div class="route__actions">
            <span class="pill pill--gold">Ciclo 2026.Q2</span>
          </div>
        </div>

        <div class="parecer-timeline">
          <div class="pt-step is-done"><span class="pt-dot">✓</span><strong>Dados consolidados</strong><span>847 respostas processadas · indicadores gerados</span></div>
          <div class="pt-step is-current"><span class="pt-dot">●</span><strong>Análise do consultor</strong><span>Patricia Lemos · especialista CRIVO</span></div>
          <div class="pt-step"><span class="pt-dot">3</span><strong>Parecer entregue</strong><span>Previsto para 24/05</span></div>
        </div>

        <div class="grid grid--icd">
          <div class="card">
            <div class="card__head"><div><h3>Indicadores automáticos</h3><span class="card__sub">Gerados pela plataforma — base para o parecer humano</span></div></div>
            <div class="kpi-grid kpi-grid--inset">
              <div class="kpi"><span class="kpi__label">ICD médio</span><strong class="kpi__value">80</strong><div class="kpi__bar"><div style="width:80%"></div></div></div>
              <div class="kpi"><span class="kpi__label">Conformidade NR-1</span><strong class="kpi__value">92<small>%</small></strong><div class="kpi__bar"><div style="width:92%"></div></div></div>
              <div class="kpi"><span class="kpi__label">Padrão dominante</span><strong class="kpi__value pattern-mini">Pressão</strong></div>
              <div class="kpi"><span class="kpi__label">Setores críticos</span><strong class="kpi__value">2</strong></div>
            </div>
          </div>

          <div class="card card--parecer">
            <span class="card__eyebrow">PARECER DO ESPECIALISTA</span>
            <p class="parecer-text">"Os dados indicam coerência decisória acima do benchmark, mas com <strong>concentração de risco na operação</strong>, governada por pressão. A recomendação não é treinar a equipe — é trabalhar a camada de liderança do Turno B, onde a pressão se converte em decisão reativa. Sugiro iniciar pela mentoria de governança comportamental antes do próximo ciclo."</p>
            <div class="parecer-sign">
              <div class="parecer-sign__avatar">PL</div>
              <div><strong>Patricia Lemos</strong><span>Consultora sênior · CRIVO</span></div>
            </div>
            <div class="parecer-actions">
              <button class="btn btn--gold btn--sm">Baixar parecer (PDF)</button>
              <button class="btn btn--outline-dark btn--sm">Agendar devolutiva</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ BIBLIOTECA & CURSOS ============ -->
      <section class="route" data-route="biblioteca">
        <div class="route__head">
          <div>
            <h1 class="page-title">Biblioteca & Formação</h1>
            <p class="page-sub">Cursos, materiais e frameworks para sustentar a liderança no dia a dia.</p>
          </div>
          <div class="route__actions">
            <div class="select-pill"><span>Trilha</span><strong>Liderança ▾</strong></div>
          </div>
        </div>

        <h3 class="block-title">Cursos</h3>
        <div class="course-grid">
          <article class="course-card"><div class="course-card__cover">★</div><div class="course-card__body"><strong>Liderança sob pressão</strong><span>8 aulas · 2h10</span><div class="course-prog"><div style="width:75%"></div></div><em>75% concluído</em></div></article>
          <article class="course-card"><div class="course-card__cover">◈</div><div class="course-card__body"><strong>Tomada de decisão & ICD</strong><span>6 aulas · 1h40</span><div class="course-prog"><div style="width:40%"></div></div><em>40% concluído</em></div></article>
          <article class="course-card"><div class="course-card__cover">◇</div><div class="course-card__body"><strong>Comunicação de liderança</strong><span>10 aulas · 3h00</span><div class="course-prog"><div style="width:100%"></div></div><em>Concluído</em></div></article>
          <article class="course-card"><div class="course-card__cover">▲</div><div class="course-card__body"><strong>Governança emocional</strong><span>7 aulas · 2h25</span><div class="course-prog"><div style="width:0%"></div></div><em>Não iniciado</em></div></article>
          <article class="course-card"><div class="course-card__cover">❖</div><div class="course-card__body"><strong>Cultura & coerência</strong><span>5 aulas · 1h30</span><div class="course-prog"><div style="width:20%"></div></div><em>20% concluído</em></div></article>
          <article class="course-card"><div class="course-card__cover">◭</div><div class="course-card__body"><strong>NR-1 aplicada à liderança</strong><span>4 aulas · 1h05</span><div class="course-prog"><div style="width:100%"></div></div><em>Concluído</em></div></article>
        </div>

        <div class="grid grid--2" style="margin-top:24px">
          <div class="card">
            <div class="card__head"><div><h3>Biblioteca</h3><span class="card__sub">Materiais, frameworks e e-books</span></div></div>
            <ul class="lib-list">
              <li class="lib-row"><span class="lib-ic">▤</span><div><strong>Framework de Decisão sob Pressão</strong><span>PDF · 12 páginas</span></div><button class="btn btn--ghost-dark btn--sm">Abrir</button></li>
              <li class="lib-row"><span class="lib-ic">▤</span><div><strong>Guia NR-1 para Lideranças</strong><span>E-book · 38 páginas</span></div><button class="btn btn--ghost-dark btn--sm">Abrir</button></li>
              <li class="lib-row"><span class="lib-ic">▤</span><div><strong>Mapa do ICD — 5 dimensões</strong><span>Framework · 1 página</span></div><button class="btn btn--ghost-dark btn--sm">Abrir</button></li>
              <li class="lib-row"><span class="lib-ic">▤</span><div><strong>Roteiro de Conversa Difícil em 3 Atos</strong><span>Template · 4 páginas</span></div><button class="btn btn--ghost-dark btn--sm">Abrir</button></li>
            </ul>
          </div>
          <div class="card">
            <div class="card__head"><div><h3>Conteúdo contínuo</h3><span class="card__sub">Novidades da CRIVO esta semana</span></div><span class="pill pill--gold">3 novos</span></div>
            <ul class="lib-list">
              <li class="lib-row"><span class="lib-ic">▶</span><div><strong>Aula ao vivo · Liderança em M&A</strong><span>Gravação · 52 min</span></div><button class="btn btn--ghost-dark btn--sm">Assistir</button></li>
              <li class="lib-row"><span class="lib-ic">▶</span><div><strong>Podcast · Decidir com critério</strong><span>Episódio 14 · 33 min</span></div><button class="btn btn--ghost-dark btn--sm">Ouvir</button></li>
              <li class="lib-row"><span class="lib-ic">▤</span><div><strong>Artigo · Custos invisíveis da pressão</strong><span>Leitura · 6 min</span></div><button class="btn btn--ghost-dark btn--sm">Ler</button></li>
            </ul>
          </div>
        </div>
      </section>

    </main>
  </div>`;
