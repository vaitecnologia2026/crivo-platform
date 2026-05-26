// =========================================
// CRIVO — Landing Page Script
// =========================================

// Logger raiz da LP (cai para console se logger.js não tiver carregado).
var log = (window.CRIVO && window.CRIVO.log) ? window.CRIVO.log.create('crivo:lp') : console;

(function () {
  var flog = log.child ? log.child('form') : log;        // crivo:lp:form
  var navlog = log.child ? log.child('nav') : log;        // crivo:lp:nav
  var revlog = log.child ? log.child('reveal') : log;     // crivo:lp:reveal

  // ---------- WhatsApp mask ----------
  const wpp = document.getElementById('whatsapp');
  if (wpp) {
    wpp.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        v = `(${v}`;
      }
      e.target.value = v;
    });
  }

  // ---------- Anti-Gmail/Hotmail on corporate email ----------
  const emailField = document.getElementById('email');
  if (emailField) {
    emailField.addEventListener('blur', (e) => {
      const v = e.target.value.toLowerCase();
      const blocked = ['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com', '@uol.com.br', '@bol.com.br'];
      const hit = blocked.find((d) => v.endsWith(d));
      if (hit) {
        flog.warn && flog.warn('e-mail não-corporativo bloqueado:', hit);
        e.target.setCustomValidity('Por favor, use um e-mail corporativo (com domínio da sua empresa).');
        e.target.reportValidity();
      } else {
        e.target.setCustomValidity('');
      }
    });
  }

  // ---------- Form submit ----------
  const form = document.getElementById('leadForm');
  const success = document.getElementById('formSuccess');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = 'Enviando seu pré-diagnóstico...';
      btn.disabled = true;
      flog.info && flog.info('pré-diagnóstico submetido', { empresa: (form.querySelector('#empresa') || {}).value });

      // Stub — substituir por POST real para CRM/Endpoint
      setTimeout(() => {
        form.reset();
        btn.textContent = original;
        btn.disabled = false;
        if (success) {
          success.classList.add('is-visible');
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        flog.info && flog.info('lead registrado (stub) · pronto para POST ao CRM');
      }, 1200);
    });
  } else {
    flog.debug && flog.debug('formulário de diagnóstico não encontrado nesta página');
  }

  // ---------- Smooth scroll active state on nav ----------
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 40) {
        nav.style.background = 'rgba(10, 14, 26, 0.95)';
        nav.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
      } else {
        nav.style.background = 'rgba(10, 14, 26, 0.85)';
        nav.style.boxShadow = 'none';
      }
    }, { passive: true });
  } else {
    navlog.warn && navlog.warn('elemento #nav ausente — efeito de scroll desativado');
  }

  // ---------- Reveal-on-scroll com stagger ----------
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealSel = [
    '.pain-card', '.metodo-card', '.product-card', '.deliver-card', '.icd-step',
    '.frente', '.ladder__step', '.nr1-col', '.feature', '.faq details',
    '.compare', '.trilha', '.data-wall'
  ].join(',');

  if (!reduce) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );

    var revealEls = document.querySelectorAll(revealSel);
    revealEls.forEach(function (el) {
      el.classList.add('reveal');
      observer.observe(el);
    });

    // Stagger: aplica delay incremental a irmãos diretos dentro de um grid
    document.querySelectorAll('.pain-grid, .metodo-grid, .product-grid, .icd-how, .icd-delivers, .ladder, .feature-grid').forEach(function (grid) {
      Array.prototype.slice.call(grid.children).forEach(function (child, i) {
        if (child.classList.contains('reveal')) {
          child.style.transitionDelay = (i * 0.08) + 's';
        }
      });
    });
    revlog.debug && revlog.debug('reveal-on-scroll ativo · ' + revealEls.length + ' elementos observados');
  } else {
    revlog.info && revlog.info('prefers-reduced-motion ativo — animações de reveal desativadas');
  }

  log.info && log.info('landing page inicializada');
})();

// ---------- E-book lead magnet form ----------
(function () {
  var elog = log.child ? log.child('ebook') : log;       // crivo:lp:ebook
  var form = document.getElementById('ebookForm');
  var ok = document.getElementById('ebookSuccess');
  if (!form) { elog.debug && elog.debug('formulário de e-book ausente'); return; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.textContent = 'Enviando...';
    btn.disabled = true;
    elog.info && elog.info('lead de e-book capturado (stub)');
    setTimeout(function () {
      form.reset();
      btn.textContent = original;
      btn.disabled = false;
      if (ok) ok.classList.add('is-visible');
    }, 1000);
  });
})();
