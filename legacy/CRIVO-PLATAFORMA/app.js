// ==========================================================
// CRIVO · Plataforma — Prototype Script
// ==========================================================

// Logger raiz da Plataforma (fallback para console se logger.js ausente).
var log = (window.CRIVO && window.CRIVO.log) ? window.CRIVO.log.create('crivo:plataforma') : console;

(function () {
  var authLog = log.child ? log.child('auth') : log;        // crivo:plataforma:auth
  var routerLog = log.child ? log.child('router') : log;    // crivo:plataforma:router
  var quizLog = log.child ? log.child('quiz') : log;        // crivo:plataforma:quiz
  var chatLog = log.child ? log.child('chat') : log;        // crivo:plataforma:chat

  const login = document.getElementById('login');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!login || !app || !loginForm || !logoutBtn) {
    log.error && log.error('estrutura da plataforma incompleta', {
      login: !!login, app: !!app, loginForm: !!loginForm, logoutBtn: !!logoutBtn
    });
    return;
  }

  // ---------------- LOGIN FLOW ----------------
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Autenticando...';
    btn.disabled = true;
    authLog.info && authLog.info('autenticação iniciada (stub)');
    setTimeout(() => {
      login.classList.remove('is-active');
      app.classList.add('is-active');
      btn.textContent = original;
      btn.disabled = false;
      authLog.info && authLog.info('sessão aberta · rota inicial=dashboard');
      // Re-trigger chart animations
      animateBars();
    }, 700);
  });

  logoutBtn.addEventListener('click', () => {
    app.classList.remove('is-active');
    login.classList.add('is-active');
    authLog.info && authLog.info('sessão encerrada');
    setRoute('dashboard');
  });

  // ---------------- ROUTER ----------------
  const routes = document.querySelectorAll('.route');
  const navItems = document.querySelectorAll('.nav-item[data-route]');
  const bcPath = document.getElementById('bcPath');
  const bcCurrent = document.getElementById('bcCurrent');

  const routeMeta = {
    crm: { path: 'Comercial', current: 'Pipeline de Leads' },
    dashboard: { path: 'Dashboard', current: 'Visão Executiva' },
    icd: { path: 'Indicadores', current: 'Índice de Coerência (ICD)' },
    campanhas: { path: 'Diagnóstico', current: 'Campanhas NR-1' },
    parecer: { path: 'Diagnóstico', current: 'Parecer Consultivo CRIVO' },
    questionario: { path: 'Aplicação', current: 'Questionário NR-1' },
    lider: { path: 'Desenvolvimento', current: 'Área do Líder' },
    biblioteca: { path: 'Desenvolvimento', current: 'Biblioteca & Formação' },
    relatorios: { path: 'Documentos', current: 'Relatórios & Comunicações' },
  };

  function setRoute(name) {
    routes.forEach((r) => r.classList.toggle('is-active', r.dataset.route === name));
    navItems.forEach((n) => n.classList.toggle('is-active', n.dataset.route === name));
    const meta = routeMeta[name];
    if (meta) {
      bcPath.textContent = meta.path;
      bcCurrent.textContent = meta.current;
      routerLog.info && routerLog.info('navegou → ' + meta.path + ' / ' + meta.current);
    } else {
      routerLog.warn && routerLog.warn('rota desconhecida: ' + name);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    animateBars();
  }

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      setRoute(item.dataset.route);
    });
  });

  // Inter-section links (e.g., "ver detalhe →")
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setRoute(link.dataset.routeLink);
    });
  });

  // ---------------- LIKERT (questionnaire) ----------------
  document.querySelectorAll('.likert__opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      const group = opt.parentElement;
      group.querySelectorAll('.likert__opt').forEach((o) => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // ---------------- QUIZ NAV (cosmetic) ----------------
  let step = 7;
  const totalSteps = 25;
  const quizBar = document.querySelector('.quiz__bar-fill');
  const quizStep = document.querySelector('.quiz__step');
  const quizNum = document.querySelector('.quiz__num');
  const quizIndicator = document.querySelector('.quiz__indicator');
  const quizPrev = document.querySelector('.quiz__nav .btn--outline-dark');
  const quizNext = document.querySelector('.quiz__nav .btn--gold');

  function updateQuiz() {
    if (!quizBar) return;
    const pct = (step / totalSteps) * 100;
    quizBar.style.width = pct + '%';
    quizNum.textContent = String(step).padStart(2, '0');
    quizIndicator.textContent = `${step} / ${totalSteps}`;
    quizLog.debug && quizLog.debug('questionário NR-1 · passo ' + step + '/' + totalSteps);
  }

  if (quizPrev) {
    quizPrev.addEventListener('click', () => {
      if (step > 1) { step--; updateQuiz(); }
    });
  }
  if (quizNext) {
    quizNext.addEventListener('click', () => {
      if (step < totalSteps) { step++; updateQuiz(); }
      else { quizLog.info && quizLog.info('questionário NR-1 concluído (' + totalSteps + ' itens)'); }
    });
  }

  // ---------------- CHAT (cosmetic submit) ----------------
  const chatInput = document.querySelector('.chat__input input');
  const chatBtn = document.querySelector('.chat__input .btn');
  const chat = document.querySelector('.chat');

  function addUserMsg(text) {
    if (!chat) return;
    const m = document.createElement('div');
    m.className = 'chat__msg chat__msg--user';
    // textContent evita injeção de HTML a partir do input do usuário
    const bubble = document.createElement('div');
    bubble.className = 'chat__bubble';
    bubble.textContent = text;
    m.appendChild(bubble);
    // Insert before typing indicator if present
    const typing = chat.querySelector('.chat__msg--typing');
    if (typing) chat.insertBefore(m, typing);
    else chat.appendChild(m);
    chat.scrollTop = chat.scrollHeight;
    chatLog.debug && chatLog.debug('mensagem do usuário enviada ao Copiloto (' + text.length + ' chars)');
  }

  if (chatBtn && chatInput) {
    const send = () => {
      const v = chatInput.value.trim();
      if (!v) return;
      addUserMsg(v);
      chatInput.value = '';
    };
    chatBtn.addEventListener('click', send);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
    });
  }

  // ---------------- BAR ANIMATIONS ----------------
  function animateBars() {
    document.querySelectorAll('.route.is-active .kpi__bar > div, .route.is-active .bar__fill, .route.is-active .quiz__bar-fill')
      .forEach((el) => {
        const target = el.style.width;
        el.style.width = '0%';
        requestAnimationFrame(() => {
          setTimeout(() => { el.style.width = target; }, 50);
        });
      });
  }

  // Animate on initial load
  setTimeout(animateBars, 300);
  log.info && log.info('plataforma inicializada · ' + routes.length + ' rotas registradas');
})();
