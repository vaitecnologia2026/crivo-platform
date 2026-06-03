/* ==========================================================================
   CRIVO™ — Decision Intelligence System
   OBSERVABILITY · logger hierárquico compartilhado (porte TS de logger.js)
   --------------------------------------------------------------------------
   Duas hierarquias:
     1) SEVERIDADE (crescente):  DEBUG · INFO · WARN · ERROR · SILENT
     2) NAMESPACE  (árvore):     crivo › crivo:lp › crivo:lp:form ...

   SSR-safe (Next.js): funciona no server e no client. Nível em runtime via
   localStorage('CRIVO_LOG_LEVEL'), globalThis.CRIVO_LOG_LEVEL ou setLevel().
   Padrão: DEBUG em localhost/dev, WARN em produção.
   ========================================================================== */

export type LevelName = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";

const LEVELS: Record<LevelName, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SILENT: 99 };
const LABEL: Record<number, LevelName> = { 10: "DEBUG", 20: "INFO", 30: "WARN", 40: "ERROR" };

const BADGE: Record<string, string> = {
  DEBUG: "background:#5C6470;color:#F2F0EC;",
  INFO: "background:#1B3A6B;color:#F2F0EC;",
  WARN: "background:#C4894A;color:#0D1F3C;",
  ERROR: "background:#8E2F2F;color:#F2F0EC;",
};
const BADGE_BASE = "padding:2px 7px;border-radius:3px;font:700 10px/1.4 monospace;letter-spacing:.08em;";
const NS_STYLE = "color:#4A6FA5;font:600 11px/1.4 monospace;";
const DIM_STYLE = "color:#8BAFD4;font:400 10px/1.4 monospace;";

const g: typeof globalThis & {
  CRIVO_LOG_LEVEL?: string;
  process?: { env?: Record<string, string | undefined> };
} = globalThis;
const hasConsole = typeof console !== "undefined";
const supportsCss = hasConsole && typeof document !== "undefined";

function defaultThreshold(): number {
  const host = (typeof location !== "undefined" && location.hostname) || "";
  const proto = (typeof location !== "undefined" && location.protocol) || "";
  const isLocal =
    proto === "file:" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "" ||
    g.process?.env?.NODE_ENV !== "production";
  return isLocal ? LEVELS.DEBUG : LEVELS.WARN;
}

function readPersistedLevel(): number {
  try {
    const stored = typeof localStorage !== "undefined" && localStorage.getItem("CRIVO_LOG_LEVEL");
    if (stored && LEVELS[stored as LevelName] != null) return LEVELS[stored as LevelName];
  } catch {
    /* localStorage indisponível */
  }
  if (typeof g.CRIVO_LOG_LEVEL === "string" && LEVELS[g.CRIVO_LOG_LEVEL as LevelName] != null) {
    return LEVELS[g.CRIVO_LOG_LEVEL as LevelName];
  }
  return defaultThreshold();
}

const state = { threshold: readPersistedLevel() };

function timestamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function methodFor(levelValue: number): (...a: unknown[]) => void {
  if (!hasConsole) return () => {};
  if (levelValue >= LEVELS.ERROR) return console.error.bind(console);
  if (levelValue >= LEVELS.WARN) return console.warn.bind(console);
  if (levelValue >= LEVELS.INFO) return (console.info || console.log).bind(console);
  return (console.debug || console.log).bind(console);
}

export interface Logger {
  readonly namespace: string;
  debug(...args: unknown[]): Logger;
  info(...args: unknown[]): Logger;
  warn(...args: unknown[]): Logger;
  error(...args: unknown[]): Logger;
  child(sub: string): Logger;
  time<T>(label: string, fn?: () => T): T | (() => void);
}

export function createLogger(namespace = "crivo"): Logger {
  function emit(levelName: LevelName, args: unknown[]): void {
    const levelValue = LEVELS[levelName];
    if (levelValue < state.threshold) return; // filtro hierárquico
    const print = methodFor(levelValue);
    if (supportsCss) {
      print(
        `%c${levelName}%c ${namespace} %c${timestamp()}`,
        BADGE_BASE + BADGE[levelName],
        NS_STYLE,
        DIM_STYLE,
        ...args,
      );
    } else {
      print(`[${LABEL[levelValue]}] ${namespace} ${timestamp()} —`, ...args);
    }
  }

  const api: Logger = {
    namespace,
    debug: (...a) => (emit("DEBUG", a), api),
    info: (...a) => (emit("INFO", a), api),
    warn: (...a) => (emit("WARN", a), api),
    error: (...a) => (emit("ERROR", a), api),
    child: (sub) => createLogger(`${namespace}:${sub}`),
    time<T>(label: string, fn?: () => T) {
      const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
      const t0 = now();
      const done = () => api.debug(`${label} concluído em ${(now() - t0).toFixed(1)}ms`);
      if (typeof fn === "function") {
        const r = fn();
        done();
        return r;
      }
      return done;
    },
  };
  return api;
}

export const log = {
  LEVELS,
  create: createLogger,
  getLevel: (): LevelName => LABEL[state.threshold] ?? "SILENT",
  setLevel: (name: LevelName): number | void => {
    if (LEVELS[name] == null) {
      hasConsole && console.warn("[crivo] nível inválido:", name);
      return;
    }
    state.threshold = LEVELS[name];
    try {
      typeof localStorage !== "undefined" && localStorage.setItem("CRIVO_LOG_LEVEL", name);
    } catch {
      /* noop */
    }
    return state.threshold;
  },
};

/** Logger raiz da hierarquia CRIVO. Use `.child('lp')`, `.child('plataforma')`, etc. */
export const logger = createLogger("crivo");
