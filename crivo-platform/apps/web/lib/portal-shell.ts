import { useSyncExternalStore } from 'react';
import type { ActionPlanData, CampaignSummary, OperationalAlertsResult } from '@crivo/types';
import {
  getOperationalAlerts,
  getToken,
  listActionPlansReadOnly,
  listCampaigns,
  listReportEmissions,
  type ReportEmissionMeta,
} from './api';
import { buildNotifications, type PortalNotification } from './portal-notifications';
import type { SearchRoute } from './portal-search';

/**
 * Estado COMPARTILHADO do shell do portal (barra superior do protótipo Lovable).
 *
 * O shell monta cada tela como uma raiz React separada (mountIsland) e guarda o
 * acesso em variáveis locais do Plataforma — nenhuma ilha enxerga a outra. A
 * barra precisa de estado comum: o sino conta os avisos que a central lista, a
 * busca usa as mesmas fontes, a faixa de contexto mostra a sessão. Por isso um
 * store no nível do módulo (useSyncExternalStore), alimentado pelo Plataforma
 * no login e zerado no logout.
 */

export interface PortalSession {
  /** tenant + usuário (do token) — separa o "lida" de quem divide o aparelho. */
  userKey: string;
  orgName: string | null;
  roleLabel: string | null;
  /** Nomes das soluções contratadas. [] = respondeu sem contrato ativo;
   *  null = não foi possível saber (a chamada falhou). */
  contracted: string[] | null;
  /** Tem o Consolidado do Grupo liberado (módulo 'grupo'). */
  hasGroup: boolean;
}

/** Fontes do sino/central/busca. */
export type PortalSource = 'alerts' | 'plans' | 'emissions' | 'campaigns';

export const SOURCE_LABEL: Record<PortalSource, string> = {
  alerts: 'alertas e travas do plano',
  plans: 'plano de ação',
  emissions: 'relatórios emitidos',
  campaigns: 'campanhas',
};

export interface PortalState {
  session: PortalSession | null;
  /** Sobe a cada login/logout — quem abriu algo "nesta sessão" compara com ele. */
  sessionSeq: number;
  /** Itens que o MENU mostra a este usuário, com o rótulo exibido. null = acesso
   *  não carregado (aí nada é escondido — a API continua gateando). */
  menu: SearchRoute[] | null;
  plans: ActionPlanData[] | null;
  emissions: ReportEmissionMeta[] | null;
  campaigns: CampaignSummary[] | null;
  alerts: OperationalAlertsResult | null;
  /** null = ainda não carregou nesta sessão. */
  notifications: PortalNotification[] | null;
  /** Fontes que FALHARAM na última carga (rede/500) — não é "sem acesso". */
  failed: PortalSource[];
  loading: boolean;
  loadedAt: number;
  readIds: ReadonlySet<string>;
}

const EMPTY: PortalState = {
  session: null,
  sessionSeq: 0,
  menu: null,
  plans: null,
  emissions: null,
  campaigns: null,
  alerts: null,
  notifications: null,
  failed: [],
  loading: false,
  loadedAt: 0,
  readIds: new Set(),
};

let state: PortalState = EMPTY;
/** Sobe a cada início/fim de sessão: resposta de uma sessão anterior é descartada. */
let generation = 0;
/** Fontes que responderam 403 nesta sessão: o papel não lê — não pede de novo
 *  a cada foco (cada 403 vira uma linha de warn no log da API). */
let forbidden = new Set<PortalSource>();
const listeners = new Set<() => void>();

function setState(patch: Partial<PortalState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function getPortalState(): PortalState {
  return state;
}
export function subscribePortal(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function usePortal(): PortalState {
  return useSyncExternalStore(subscribePortal, getPortalState, () => EMPTY);
}

// ── Navegação: as ilhas pedem uma tela ao shell ──────────────────────────────
let navigator: ((route: string) => void) | null = null;
export function setPortalNavigator(fn: ((route: string) => void) | null) {
  navigator = fn;
}
export function portalNavigate(route: string) {
  navigator?.(route);
}

/** O menu mostra esta tela? Sem acesso carregado, não esconde nada. */
export function canSeeRoute(route: string, s: PortalState = state): boolean {
  return !s.menu || s.menu.some((m) => m.route === route);
}

// ── "Lida" no aparelho, por usuário ──────────────────────────────────────────
const READ_KEY = 'crivo_notif_lidas:';
const READ_CAP = 500;

function loadReadIds(userKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY + userKey);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function saveReadIds(userKey: string, ids: ReadonlySet<string>) {
  try {
    // Mantém os mais recentes: o Set preserva a ordem de inserção.
    localStorage.setItem(READ_KEY + userKey, JSON.stringify([...ids].slice(-READ_CAP)));
  } catch {
    /* modo privado / cota — o "lida" vale só nesta aba */
  }
}
/** O que está gravado (outra aba pode ter marcado) + o que esta aba tem. */
function mergedReadIds(userKey: string): Set<string> {
  const out = loadReadIds(userKey);
  for (const id of state.readIds) out.add(id);
  return out;
}

export function markNotificationRead(id: string) {
  const s = state.session;
  if (!s || state.readIds.has(id)) return;
  const next = mergedReadIds(s.userKey);
  next.delete(id);
  next.add(id);
  saveReadIds(s.userKey, next);
  setState({ readIds: next });
}
export function markAllNotificationsRead() {
  const s = state.session;
  if (!s || !state.notifications) return;
  const next = mergedReadIds(s.userKey);
  for (const n of state.notifications) {
    next.delete(n.id); // re-inserir leva o id para o fim (fica entre os mantidos)
    next.add(n.id);
  }
  saveReadIds(s.userKey, next);
  setState({ readIds: next });
}

/** tenantId:sub do JWT — só para separar o "lida" por pessoa; não autentica nada. */
export function sessionKeyFromToken(token: string | null = getToken()): string {
  try {
    const part = token?.split('.')[1];
    if (!part) return 'anon';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json) as { tenantId?: string; sub?: string };
    return p.tenantId && p.sub ? `${p.tenantId}:${p.sub}` : 'anon';
  } catch {
    return 'anon';
  }
}

// ── Sessão ───────────────────────────────────────────────────────────────────
export function startPortalSession(session: PortalSession, menu: SearchRoute[] | null) {
  generation++;
  forbidden = new Set();
  state = { ...EMPTY, session, sessionSeq: generation, menu, readIds: loadReadIds(session.userKey) };
  listeners.forEach((fn) => fn());
  void refreshPortalData();
}

export function endPortalSession() {
  generation++;
  forbidden = new Set();
  setState({ ...EMPTY, sessionSeq: generation });
}

type Loaded<T> = { data: T | null; status: 'ok' | 'forbidden' | 'error' | 'skipped' };

/**
 * Recarrega as fontes do sino/central/busca. Cada fonte só é pedida se a tela
 * dela está no menu deste usuário e se não respondeu 403 antes nesta sessão.
 * 403 = o papel não lê (a fonte some em silêncio); outro erro fica em `failed`,
 * para a central não afirmar "nada pendente" sem ter conseguido olhar.
 * `maxAgeMs` evita recarregar à toa (foco da aba, reabrir a busca).
 */
export async function refreshPortalData(maxAgeMs = 0): Promise<void> {
  if (!state.session || state.loading) return;
  if (maxAgeMs > 0 && state.loadedAt && Date.now() - state.loadedAt < maxAgeMs) return;
  const gen = generation;
  setState({ loading: true });

  const load = <T>(src: PortalSource, want: boolean, call: () => Promise<T>): Promise<Loaded<T>> => {
    if (!want || forbidden.has(src)) return Promise.resolve({ data: null, status: 'skipped' });
    return call().then(
      (data) => ({ data, status: 'ok' as const }),
      (err: unknown) => ({
        data: null,
        status: (err as { status?: number } | null)?.status === 403 ? ('forbidden' as const) : ('error' as const),
      }),
    );
  };
  const plano = canSeeRoute('relatorios') || canSeeRoute('evidencias');
  const [alerts, plans, emissions, campaigns] = await Promise.all([
    load('alerts', plano || canSeeRoute('dashboard'), getOperationalAlerts),
    // Só leitura: a listagem normal dispara a geração automática do plano.
    load('plans', plano, listActionPlansReadOnly),
    load('emissions', canSeeRoute('documentos'), listReportEmissions),
    load('campaigns', canSeeRoute('campanhas'), () => listCampaigns()),
  ]);
  if (gen !== generation) return; // logout ou troca de sessão no meio do caminho

  const all: Array<[PortalSource, Loaded<unknown>]> = [
    ['alerts', alerts],
    ['plans', plans],
    ['emissions', emissions],
    ['campaigns', campaigns],
  ];
  for (const [src, r] of all) if (r.status === 'forbidden') forbidden.add(src);
  const sources = { alerts: alerts.data, plans: plans.data, emissions: emissions.data, campaigns: campaigns.data };
  setState({
    ...sources,
    notifications: buildNotifications(sources, Date.now()),
    failed: all.filter(([, r]) => r.status === 'error').map(([src]) => src),
    loading: false,
    loadedAt: Date.now(),
    // Marcações feitas em outra aba entram na próxima carga.
    readIds: state.session ? mergedReadIds(state.session.userKey) : state.readIds,
  });
}
