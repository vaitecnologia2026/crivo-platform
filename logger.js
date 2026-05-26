/* ==========================================================================
   CRIVO™ — Decision Intelligence System
   OBSERVABILITY · logger hierárquico compartilhado (v1.0)
   --------------------------------------------------------------------------
   Carregado por LP, Plataforma e Design System ANTES dos scripts de cada app.
   Funciona em file:// e http(s):// — sem módulos, sem dependências.

   Duas hierarquias de log:
     1) SEVERIDADE (crescente):  DEBUG · INFO · WARN · ERROR · SILENT
     2) NAMESPACE  (árvore):     crivo › crivo:lp › crivo:lp:form ...

   Controle do nível em runtime (qualquer um destes, nesta ordem de prioridade):
     • localStorage.setItem('CRIVO_LOG_LEVEL', 'DEBUG')
     • window.CRIVO_LOG_LEVEL = 'WARN'   (antes deste script)
     • CRIVO.log.setLevel('ERROR')        (a qualquer momento, no console)
   Padrão: DEBUG em localhost/file://, WARN em produção.
   ========================================================================== */
(function (global) {
  'use strict';

  // ── Hierarquia 1 · níveis de severidade ────────────────────────────────
  var LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SILENT: 99 };
  var LABEL  = { 10: 'DEBUG', 20: 'INFO', 30: 'WARN', 40: 'ERROR' };

  // Badge por nível (paleta oficial CRIVO — azul profundo / terra / alerta)
  var BADGE = {
    DEBUG: 'background:#5C6470;color:#F2F0EC;',
    INFO:  'background:#1B3A6B;color:#F2F0EC;',
    WARN:  'background:#C4894A;color:#0D1F3C;',
    ERROR: 'background:#8E2F2F;color:#F2F0EC;'
  };
  var BADGE_BASE = 'padding:2px 7px;border-radius:3px;font:700 10px/1.4 monospace;letter-spacing:.08em;';
  var NS_STYLE   = 'color:#4A6FA5;font:600 11px/1.4 monospace;';
  var DIM_STYLE  = 'color:#8BAFD4;font:400 10px/1.4 monospace;';

  var isBrowserConsole = typeof console !== 'undefined';
  // Todo navegador moderno suporta o formatador %c; só desligamos fora do browser.
  var supportsCss = isBrowserConsole && typeof global.document !== 'undefined';

  function defaultThreshold() {
    var host = (global.location && global.location.hostname) || '';
    var proto = (global.location && global.location.protocol) || '';
    var isLocal = proto === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '';
    return isLocal ? LEVELS.DEBUG : LEVELS.WARN;
  }

  function readPersistedLevel() {
    try {
      var stored = global.localStorage && global.localStorage.getItem('CRIVO_LOG_LEVEL');
      if (stored && LEVELS[stored] != null) return LEVELS[stored];
    } catch (e) { /* localStorage indisponível (file://, privacidade) */ }
    if (typeof global.CRIVO_LOG_LEVEL === 'string' && LEVELS[global.CRIVO_LOG_LEVEL] != null) {
      return LEVELS[global.CRIVO_LOG_LEVEL];
    }
    return defaultThreshold();
  }

  var state = { threshold: readPersistedLevel() };

  function timestamp() {
    var d = new Date();
    function p(n, w) { return String(n).padStart(w || 2, '0'); }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
  }

  function methodFor(levelValue) {
    if (!isBrowserConsole) return function () {};
    if (levelValue >= LEVELS.ERROR) return console.error.bind(console);
    if (levelValue >= LEVELS.WARN)  return console.warn.bind(console);
    if (levelValue >= LEVELS.INFO)  return (console.info || console.log).bind(console);
    return (console.debug || console.log).bind(console);
  }

  // ── Hierarquia 2 · namespaces encadeáveis ──────────────────────────────
  function createLogger(namespace) {
    namespace = namespace || 'crivo';

    function emit(levelName, args) {
      var levelValue = LEVELS[levelName];
      if (levelValue < state.threshold) return;            // filtro hierárquico
      var print = methodFor(levelValue);
      var rest = Array.prototype.slice.call(args);
      if (supportsCss) {
        print(
          '%c' + levelName + '%c ' + namespace + ' %c' + timestamp(),
          BADGE_BASE + BADGE[levelName], NS_STYLE, DIM_STYLE,
          ...rest
        );
      } else {
        print('[' + LABEL[levelValue] + '] ' + namespace + ' ' + timestamp() + ' —', ...rest);
      }
    }

    var api = {
      namespace: namespace,
      debug: function () { emit('DEBUG', arguments); return api; },
      info:  function () { emit('INFO',  arguments); return api; },
      warn:  function () { emit('WARN',  arguments); return api; },
      error: function () { emit('ERROR', arguments); return api; },
      // Cria um logger-filho herdando o namespace pai → hierarquia em árvore
      child: function (sub) { return createLogger(namespace + ':' + sub); },
      // Mede e loga a duração de uma operação
      time: function (label, fn) {
        var t0 = (global.performance && performance.now) ? performance.now() : Date.now();
        var done = function () {
          var t1 = (global.performance && performance.now) ? performance.now() : Date.now();
          api.debug(label + ' concluído em ' + (t1 - t0).toFixed(1) + 'ms');
        };
        if (typeof fn === 'function') { var r = fn(); done(); return r; }
        return done; // uso manual: var end = log.time('x'); ...; end();
      }
    };
    return api;
  }

  // ── API pública ────────────────────────────────────────────────────────
  global.CRIVO = global.CRIVO || {};
  global.CRIVO.log = {
    LEVELS: LEVELS,
    create: createLogger,
    getLevel: function () { return LABEL[state.threshold] || 'SILENT'; },
    setLevel: function (name) {
      if (LEVELS[name] == null) { (isBrowserConsole) && console.warn('[crivo] nível inválido:', name); return; }
      state.threshold = LEVELS[name];
      try { global.localStorage && global.localStorage.setItem('CRIVO_LOG_LEVEL', name); } catch (e) {}
      return state.threshold;
    }
  };

  // Logger raiz da hierarquia
  global.CRIVO.logger = createLogger('crivo');
  global.CRIVO.logger.debug('observability inicializado · nível=' + global.CRIVO.log.getLevel());
})(typeof window !== 'undefined' ? window : this);
