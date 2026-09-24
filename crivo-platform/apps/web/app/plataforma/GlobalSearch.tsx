"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { LibraryItemData, UserSummary } from "@crivo/types";
import { listLibrary, listUsers } from "@/lib/api";
import { buildSearchIndex, searchPortal, type SearchEntry, type SearchRoute } from "@/lib/portal-search";
import { canSeeRoute, getPortalState, portalNavigate, refreshPortalData, usePortal } from "@/lib/portal-shell";
import { IconSearch } from "./Icons";
import { NAV } from "./nav.config";

/** Usuários e Academia só entram na busca; recarregam no máximo a cada 5 min. */
const EXTRA_MAX_AGE = 5 * 60 * 1000;
/** As fontes compartilhadas com o sino recarregam ao abrir, se passaram 2 min. */
const SHARED_MAX_AGE = 2 * 60 * 1000;

interface Extra {
  key: string;
  at: number;
  users: UserSummary[] | null;
  library: LibraryItemData[] | null;
}

/** Sem acesso carregado ainda: todas as telas do menu (a API segue gateando). */
const ALL_ROUTES: SearchRoute[] = NAV.flatMap((g) =>
  g.items.filter((i) => i.route && !i.hidden).map((i) => ({ route: i.route!, label: i.label, group: g.title })),
);

/**
 * Tela bloqueante aberta (aceite dos termos LGPD, troca OBRIGATÓRIA de senha —
 * as duas usam .terms-gate): a paleta não abre por cima dela. Senão o atalho
 * mostrava dado do portal antes do aceite/da troca que o gate existe para exigir.
 */
function gateAberto(): boolean {
  return typeof document !== "undefined" && !!document.querySelector(".terms-gate");
}

/** Elemento ainda na página e visível (a tela de onde ele veio pode ter saído). */
function focavel(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el !== document.body && el.isConnected && el.getClientRects().length > 0;
}

/**
 * Busca global — "Buscar no portal… ⌘K" do protótipo Lovable (GlobalSearch),
 * com dado real (lib/portal-search). Ctrl+K / ⌘K abre de qualquer tela; setas
 * navegam, Enter abre a tela do resultado, Esc fecha.
 */
export function GlobalSearch() {
  const portal = usePortal();
  // Sessão (nº) em que a paleta foi aberta: logout fecha, e ela não reabre
  // sozinha no próximo login.
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const extraRef = useRef<Extra | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Quem tinha o foco quando a paleta abriu (Ctrl+K de dentro de uma tela). */
  const returnFocusRef = useRef<Element | null>(null);
  const [isMac] = useState(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent),
  );

  const isOpen = openSeq !== null && openSeq === portal.sessionSeq && !!portal.session;

  const loadExtra = useCallback(() => {
    const key = getPortalState().session?.userKey;
    if (!key) return;
    const cur = extraRef.current;
    if (cur && cur.key === key && Date.now() - cur.at < EXTRA_MAX_AGE) return;
    setLoadingExtra(true);
    void Promise.all([
      canSeeRoute("usuarios") ? listUsers().catch(() => null) : Promise.resolve(null),
      canSeeRoute("biblioteca") ? listLibrary().catch(() => null) : Promise.resolve(null),
    ]).then(([users, library]) => {
      setLoadingExtra(false);
      // Trocou de sessão enquanto carregava: descarta.
      if (getPortalState().session?.userKey !== key) return;
      const next = { key, at: Date.now(), users, library };
      extraRef.current = next;
      setExtra(next);
    });
  }, []);

  const openSearch = useCallback(() => {
    const s = getPortalState();
    if (!s.session || gateAberto()) return;
    returnFocusRef.current = document.activeElement;
    setQuery("");
    setActive(0);
    setOpenSeq(s.sessionSeq);
    void refreshPortalData(SHARED_MAX_AGE);
    loadExtra();
  }, [loadExtra]);

  const close = useCallback(() => setOpenSeq(null), []);

  // Ctrl+K / ⌘K abre e fecha de qualquer tela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "k") return;
      if (!getPortalState().session || gateAberto()) return;
      e.preventDefault();
      if (isOpen) close();
      else openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, openSearch, close]);

  // Aberta: foco no campo e página sem rolar por trás. Fechada: o foco volta a
  // quem o tinha (ou ao botão, se aquele elemento saiu da tela).
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = prev;
      const back = returnFocusRef.current;
      if (focavel(back)) back.focus();
      else trigger?.focus();
    };
  }, [isOpen]);

  const userKey = portal.session?.userKey ?? null;
  const index = useMemo(() => {
    const ext = extra && extra.key === userKey ? extra : null;
    const all = buildSearchIndex({
      routes: portal.menu ?? ALL_ROUTES,
      plans: portal.plans,
      emissions: portal.emissions,
      campaigns: portal.campaigns,
      users: ext?.users ?? null,
      library: ext?.library ?? null,
      notifications: portal.notifications,
    });
    // Resultado que leva a uma tela que este usuário não abre (checklist de
    // telas, papel) não aparece — escolher levaria ao painel, não ao item.
    return all.filter((e) => canSeeRoute(e.route, portal));
  }, [extra, userKey, portal]);

  const groups = useMemo(() => searchPortal(index, query), [index, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  // Posição do 1º resultado de cada grupo na lista corrida (setas/ids).
  const offsets = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const g of groups) {
      out.push(n);
      n += g.entries.length;
    }
    return out;
  }, [groups]);
  const current = flat.length ? Math.min(Math.max(active, 0), flat.length - 1) : 0;

  useEffect(() => {
    if (!isOpen) return;
    document.getElementById(`gs-opt-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, isOpen]);

  const go = (e: SearchEntry) => {
    close();
    portalNavigate(e.route);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length) setActive(Math.min(current + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[current];
      if (hit) go(hit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault(); // o foco fica no campo enquanto a paleta está aberta
    }
  };

  const loading = portal.loading || loadingExtra;
  const total = groups.reduce((n, g) => n + g.total, 0);
  const status =
    flat.length === 0
      ? loading && query
        ? "Carregando…"
        : `Nenhum resultado${query ? ` para ${query}` : ""}.`
      : `${total} resultado${total === 1 ? "" : "s"}.`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-btn"
        onClick={openSearch}
        aria-label="Buscar no portal"
        aria-haspopup="dialog"
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        title={`Buscar no portal (${isMac ? "⌘K" : "Ctrl+K"})`}
      >
        <IconSearch size={15} />
        <span className="search-btn__label">Buscar no portal…</span>
        <kbd className="search-btn__kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="gs-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="gs-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Buscar no portal"
              // Clique em área sem controle não tira o foco do campo — é nele
              // que vivem Esc, setas, Enter e a trava do Tab.
              onMouseDown={(e) => {
                if (e.target !== inputRef.current) e.preventDefault();
              }}
            >
              <div className="gs-input">
                <IconSearch size={16} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  role="combobox"
                  aria-expanded={flat.length > 0}
                  aria-controls={flat.length ? "gs-list" : undefined}
                  aria-autocomplete="list"
                  aria-activedescendant={flat.length ? `gs-opt-${current}` : undefined}
                  aria-label="Campo de busca global"
                  placeholder="Buscar telas, ações, evidências, relatórios, campanhas…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="gs-kbd">Esc</kbd>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {status}
              </p>

              {flat.length === 0 ? (
                <div className="gs-empty">
                  {loading && query ? (
                    "Carregando…"
                  ) : (
                    <>
                      <strong>Nenhum resultado{query ? ` para “${query}”` : ""}.</strong>
                      <span>A busca cobre telas, avisos, ações, evidências, relatórios, campanhas, usuários e Academia.</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="gs-list" id="gs-list" role="listbox" aria-label="Resultados da busca">
                  {groups.map((g, gi) => (
                    <div key={g.category} role="group" aria-labelledby={`gs-h-${gi}`}>
                      <div className="gs-group" id={`gs-h-${gi}`}>
                        {g.category}
                        {g.total > g.entries.length && (
                          <span className="gs-group__more">
                            {g.entries.length} de {g.total} — refine a busca
                          </span>
                        )}
                      </div>
                      {g.entries.map((e, ei) => {
                        const i = offsets[gi] + ei;
                        return (
                          <div
                            key={e.id}
                            id={`gs-opt-${i}`}
                            role="option"
                            aria-selected={i === current}
                            className={`gs-opt${i === current ? " is-active" : ""}`}
                            onMouseMove={() => {
                              if (i !== current) setActive(i);
                            }}
                            onClick={() => go(e)}
                          >
                            <div className="gs-opt__body">
                              <div className="gs-opt__label">{e.label}</div>
                              {e.context && <div className="gs-opt__ctx">{e.context}</div>}
                            </div>
                            <span className="pill pill--sm pill--outline">{e.category}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              <div className="gs-foot" aria-hidden="true">
                <span>
                  <kbd className="gs-kbd">↑</kbd>
                  <kbd className="gs-kbd">↓</kbd> navegar
                </span>
                <span>
                  <kbd className="gs-kbd">Enter</kbd> abrir
                </span>
                <span>
                  <kbd className="gs-kbd">Esc</kbd> fechar
                </span>
                {loading && <span className="gs-foot__status">Atualizando…</span>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
