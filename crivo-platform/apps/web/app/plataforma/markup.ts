// Gerado de CRIVO-PLATAFORMA/index.html (markup do protótipo, fiel 1:1).
// Renderizado via dangerouslySetInnerHTML; a interatividade vive em PlatEffects.
// A sidebar é GERADA da config única de navegação (F6) — ver nav.config.ts.
import { renderNavHtml } from "./nav.config";

export const PLATFORM_MARKUP = `<!-- ==================== LOGIN ==================== -->
  <div id="login" class="screen screen--login is-active">
    <div class="login__photo" aria-hidden="true"></div>
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
      <span class="login__pill">PORTAL EXECUTIVO</span>
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
          <a href="https://wa.me/5511918531796?text=Ol%C3%A1!%20Esqueci%20minha%20senha%20de%20acesso%20ao%20CRIVO%20e%20preciso%20de%20ajuda%20para%20redefinir." target="_blank" rel="noopener" class="link-gold">Esqueci minha senha</a>
        </div>
        <button type="submit" class="btn btn--gold btn--block">Entrar na plataforma →</button>
        <p class="login__error" id="loginError" role="alert" aria-live="assertive"></p>
      </form>

      <div class="login__footer">
        <span>Não tem acesso?</span>
        <a href="https://wa.me/5511918531796?text=Quero%20falar%20com%20um%20especialista%20CRIVO" target="_blank" rel="noopener" class="link-gold">Falar com a CRIVO</a>
      </div>

      <a href="https://crivolegacy.com.br" class="login__back">← Voltar ao site</a>
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
        <button id="sidebarToggle" class="topbar__menu" type="button" aria-label="Abrir menu" title="Menu">☰</button>
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
          <!-- Sineta: navega ao Dashboard via id notifBtn (wiring do Plataforma.tsx,
               lado do push/FCM); ícone SVG de traço (sem emoji de sistema no produto). -->
          <button class="icon-btn" id="notifBtn" type="button" title="Notificações" aria-label="Notificações">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M6 9.5a6 6 0 1 1 12 0c0 3.8 1.3 5.3 1.9 5.9H4.1c.6-.6 1.9-2.1 1.9-5.9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
              <path d="M10.2 18.4a2 2 0 0 0 3.6 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
            <span class="badge-dot"></span>
          </button>
          <div class="user-chip">
            <div class="user-chip__avatar">RM</div>
            <div>
              <strong>Rafael Moreira</strong>
              <span>Diretor de RH</span>
            </div>
          </div>
          <button class="icon-btn" id="chgPwdBtn" title="Trocar senha">⚿</button>
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

      <!-- ============ GRUPO EMPRESARIAL (F3) ============ -->
      <section class="route" data-route="grupo">
        <div id="grupo-root"></div>
      </section>

      <!-- ============ QUESTIONÁRIO ============ -->
      <section class="route" data-route="questionario">
        <div id="quiz-root"></div>
      </section>

      <!-- ============ ÁREA DO LÍDER ============ -->
      <section class="route" data-route="lider">
        <div id="lider-root"></div>
      </section>

      <section class="route" data-route="decisoes">
        <div id="decisoes-root"></div>
      </section>

      <!-- ============ RELATÓRIOS ============ -->
      <section class="route" data-route="relatorios">
        <div id="relatorios-root"></div>
      </section>

      <!-- ============ DIAGNÓSTICO ESSENCIAL ============ -->
      <section class="route" data-route="essencial">
        <div id="essencial-root"></div>
      </section>

      <!-- ============ CAMPANHAS NR-1 ============ -->
      <section class="route" data-route="campanhas">
        <div id="campanhas-root"></div>
      </section>

      <!-- ============ PARECER CRIVO ============ -->
      <section class="route" data-route="parecer">
        <div id="parecer-root"></div>
      </section>

      <!-- ============ QUESTIONÁRIO PSICOSSOCIAL ============ -->
      <section class="route" data-route="psicossocial">
        <div id="psicossocial-root"></div>
      </section>

      <!-- ============ POCKET CRIVO ============ -->
      <section class="route" data-route="pocket">
        <div id="pocket-root"></div>
      </section>

      <!-- ============ MENTORIAS (placeholder) ============ -->
      <section class="route" data-route="mentorias">
        <div id="mentorias-root"></div>
      </section>

      <!-- ============ PEOPLE ANALYTICS (placeholder) ============ -->
      <section class="route" data-route="analytics">
        <div id="analytics-root"></div>
      </section>

      <!-- ============ CUSTO INVISÍVEL ============ -->
      <section class="route" data-route="custo">
        <div id="custo-root"></div>
      </section>

      <!-- ============ HISTÓRICO & AUDITORIA (placeholder) ============ -->
      <section class="route" data-route="historico">
        <div id="historico-root"></div>
      </section>

      <!-- ============ ORGANIZAÇÃO ============ -->
      <section class="route" data-route="organizacao">
        <div id="organizacao-root"></div>
      </section>

      <!-- ============ USUÁRIOS & EQUIPE ============ -->
      <section class="route" data-route="usuarios">
        <div id="usuarios-root"></div>
      </section>

      <!-- ============ PAPÉIS & PERMISSÕES (#68) ============ -->
      <section class="route" data-route="papeis">
        <div id="papeis-root"></div>
      </section>

      <!-- ============ BIBLIOTECA & CURSOS ============ -->
      <section class="route" data-route="biblioteca">
        <div id="biblioteca-root"></div>
      </section>

    </main>
  </div>`;
