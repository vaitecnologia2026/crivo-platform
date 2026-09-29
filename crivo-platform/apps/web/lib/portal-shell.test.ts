import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getOperationalAlerts: vi.fn(),
  listActionPlansReadOnly: vi.fn(),
  listReportEmissions: vi.fn(),
  listCampaigns: vi.fn(),
  getToken: vi.fn(() => null),
}));
vi.mock('./api', () => api);

import {
  canSeeRoute,
  endPortalSession,
  getPortalState,
  markAllNotificationsRead,
  markNotificationRead,
  portalSwitchContext,
  refreshPortalData,
  sessionKeyFromToken,
  setPortalContext,
  setPortalContextSwitcher,
  startPortalSession,
  type PortalSession,
} from './portal-shell';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const sessao = (userKey: string, extra: Partial<PortalSession> = {}): PortalSession => ({
  userKey,
  orgName: 'O2 LEGACY',
  roleLabel: 'Administrador',
  contracted: ['CRIVO Diagnóstico Organizacional'],
  hasGroup: false,
  contexts: ['ORGANIZACAO'],
  context: 'ORGANIZACAO',
  ...extra,
});
// Menus de cada contexto como o shell os monta (visibleMenu).
const menuOrg = [
  { route: 'dashboard', label: 'Visão Geral', group: 'Portal' },
  { route: 'relatorios', label: 'Plano de Evolução', group: 'Portal' },
  { route: 'documentos', label: 'Relatórios e Dossiês', group: 'Portal' },
];
const menuJornada = [
  { route: 'hoje', label: 'Hoje', group: 'Hoje' },
  { route: 'pocket', label: 'Pocket CRIVO', group: 'Decidir' },
  { route: 'lider', label: 'Meu ICD', group: 'Evoluir' },
];
const duasTravas = { alerts: [], locks: [{ kind: 'a', message: '1' }, { kind: 'b', message: '2' }] };
const flush = () => new Promise((r) => setTimeout(r, 0));
const erro = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  store.clear();
  endPortalSession();
  vi.clearAllMocks();
  api.getOperationalAlerts.mockResolvedValue(duasTravas);
  api.listActionPlansReadOnly.mockResolvedValue([]);
  api.listReportEmissions.mockResolvedValue([]);
  api.listCampaigns.mockResolvedValue([]);
});

describe('estado compartilhado do shell (sino, central, busca)', () => {
  it('ao entrar carrega as fontes e monta os avisos — o plano só em leitura', async () => {
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    expect(getPortalState().notifications).toHaveLength(2);
    expect(getPortalState().loading).toBe(false);
    expect(api.listActionPlansReadOnly).toHaveBeenCalledOnce();
  });

  it('só pede a fonte cuja tela o menu mostra', async () => {
    startPortalSession(sessao('t1:u1'), [{ route: 'documentos', label: 'Relatórios e Dossiês', group: 'Portal' }]);
    await flush();
    expect(api.getOperationalAlerts).not.toHaveBeenCalled();
    expect(api.listActionPlansReadOnly).not.toHaveBeenCalled();
    expect(api.listCampaigns).not.toHaveBeenCalled();
    expect(api.listReportEmissions).toHaveBeenCalledOnce();
    expect(canSeeRoute('documentos')).toBe(true);
    expect(canSeeRoute('campanhas')).toBe(false);
  });

  it('403 some em silêncio e não é pedido de novo na mesma sessão', async () => {
    api.getOperationalAlerts.mockRejectedValue(erro(403));
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    expect(getPortalState().failed).toEqual([]);
    expect(getPortalState().notifications).toEqual([]);
    await refreshPortalData();
    expect(api.getOperationalAlerts).toHaveBeenCalledOnce();
    // Nova sessão tenta de novo (outro usuário pode ter o papel).
    startPortalSession(sessao('t1:u2'), null);
    await flush();
    expect(api.getOperationalAlerts).toHaveBeenCalledTimes(2);
  });

  it('falha de verdade (rede/500) fica registrada — não vira "nada pendente"', async () => {
    api.getOperationalAlerts.mockRejectedValue(erro(500));
    api.listCampaigns.mockRejectedValue(erro(0));
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    expect(getPortalState().failed.sort()).toEqual(['alerts', 'campaigns']);
    await refreshPortalData();
    expect(api.getOperationalAlerts).toHaveBeenCalledTimes(2); // erro não é memorizado
  });

  it('"lida" fica no aparelho, separada por pessoa', async () => {
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    const [a] = getPortalState().notifications!;
    markNotificationRead(a.id);
    expect(getPortalState().readIds.has(a.id)).toBe(true);

    startPortalSession(sessao('t1:u2'), null); // outra pessoa no mesmo aparelho
    await flush();
    expect(getPortalState().readIds.size).toBe(0);

    startPortalSession(sessao('t1:u1'), null); // a primeira volta
    await flush();
    expect(getPortalState().readIds.has(a.id)).toBe(true);
  });

  it('marcação feita em outra aba não se perde', async () => {
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    const [a, b] = getPortalState().notifications!;
    store.set('crivo_notif_lidas:t1:u1', JSON.stringify([a.id])); // outra aba
    markNotificationRead(b.id);
    expect(JSON.parse(store.get('crivo_notif_lidas:t1:u1')!)).toEqual([a.id, b.id]);
    expect(getPortalState().readIds.has(a.id)).toBe(true);
  });

  it('marcar todas zera o contador', async () => {
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    markAllNotificationsRead();
    const s = getPortalState();
    expect(s.notifications!.every((n) => s.readIds.has(n.id))).toBe(true);
  });

  it('logout zera tudo, muda o nº da sessão e descarta resposta que chega depois', async () => {
    let solta: (v: unknown) => void = () => {};
    api.getOperationalAlerts.mockReturnValue(new Promise((r) => (solta = r)));
    startPortalSession(sessao('t1:u1'), null);
    const seq = getPortalState().sessionSeq;
    endPortalSession();
    solta(duasTravas);
    await flush();
    expect(getPortalState().session).toBeNull();
    expect(getPortalState().notifications).toBeNull();
    expect(getPortalState().sessionSeq).not.toBe(seq);
  });

  it('não recarrega antes do prazo pedido', async () => {
    startPortalSession(sessao('t1:u1'), null);
    await flush();
    await refreshPortalData(60_000);
    expect(api.getOperationalAlerts).toHaveBeenCalledOnce();
    await refreshPortalData();
    expect(api.getOperationalAlerts).toHaveBeenCalledTimes(2);
  });

  it('troca de contexto troca o menu, o canSeeRoute e o papel exibido — mesma sessão', async () => {
    startPortalSession(sessao('t1:u1', { contexts: ['JORNADA', 'ORGANIZACAO'] }), menuOrg);
    await flush();
    const seq = getPortalState().sessionSeq;
    expect(canSeeRoute('dashboard')).toBe(true);
    expect(canSeeRoute('pocket')).toBe(false);
    expect(getPortalState().notifications).toHaveLength(2);

    setPortalContext('JORNADA', menuJornada, 'Líder');
    await flush();
    const s = getPortalState();
    expect(s.session).toMatchObject({ userKey: 't1:u1', context: 'JORNADA', roleLabel: 'Líder' });
    expect(s.session?.contexts).toEqual(['JORNADA', 'ORGANIZACAO']);
    expect(s.sessionSeq).toBe(seq); // não é outra sessão: a busca aberta não fecha
    expect(canSeeRoute('pocket')).toBe(true);
    expect(canSeeRoute('dashboard')).toBe(false);
    expect(canSeeRoute('relatorios')).toBe(false);
    // Os avisos eram da Organização: não atravessam para a Jornada.
    expect(s.notifications).toEqual([]);

    setPortalContext('ORGANIZACAO', menuOrg, 'Administrador');
    await flush();
    expect(getPortalState().session?.roleLabel).toBe('Administrador');
    expect(canSeeRoute('dashboard')).toBe(true);
    expect(getPortalState().notifications).toHaveLength(2);
  });

  it('na Jornada as fontes do sino (todas da empresa) não são pedidas', async () => {
    startPortalSession(sessao('t1:u1', { contexts: ['JORNADA'], context: 'JORNADA', roleLabel: 'Líder' }), menuJornada);
    await flush();
    expect(api.getOperationalAlerts).not.toHaveBeenCalled();
    expect(api.listActionPlansReadOnly).not.toHaveBeenCalled();
    expect(api.listReportEmissions).not.toHaveBeenCalled();
    expect(api.listCampaigns).not.toHaveBeenCalled();
    expect(getPortalState().notifications).toEqual([]);
    // Nem com o menu ainda não carregado (null), que em tese libera tudo.
    startPortalSession(sessao('t1:u1', { contexts: ['JORNADA'], context: 'JORNADA' }), null);
    await flush();
    expect(api.getOperationalAlerts).not.toHaveBeenCalled();
    expect(api.listCampaigns).not.toHaveBeenCalled();
  });

  it('carga do contexto anterior que chega depois da troca é descartada', async () => {
    let solta: (v: unknown) => void = () => {};
    api.getOperationalAlerts.mockReturnValueOnce(new Promise((r) => (solta = r)));
    startPortalSession(sessao('t1:u1', { contexts: ['JORNADA', 'ORGANIZACAO'] }), menuOrg);
    setPortalContext('JORNADA', menuJornada, 'Líder');
    solta(duasTravas);
    await flush();
    const s = getPortalState();
    expect(s.session?.context).toBe('JORNADA');
    expect(s.alerts).toBeNull();
    expect(s.notifications).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it('sem sessão, a troca de contexto não faz nada', () => {
    setPortalContext('JORNADA', menuJornada, 'Líder');
    expect(getPortalState().session).toBeNull();
    expect(getPortalState().menu).toBeNull();
  });

  it('o seletor pede a troca ao shell registrado (e a nenhum depois de desregistrado)', () => {
    const shell = vi.fn();
    setPortalContextSwitcher(shell);
    portalSwitchContext('JORNADA');
    expect(shell).toHaveBeenCalledWith('JORNADA');
    setPortalContextSwitcher(null);
    portalSwitchContext('ORGANIZACAO');
    expect(shell).toHaveBeenCalledOnce();
  });

  it('chave da pessoa sai do token; token ruim vira "anon"', () => {
    const payload = btoa(JSON.stringify({ sub: 'u9', tenantId: 't9' })).replace(/=+$/, '');
    expect(sessionKeyFromToken(`h.${payload}.s`)).toBe('t9:u9');
    expect(sessionKeyFromToken('lixo')).toBe('anon');
    expect(sessionKeyFromToken(null)).toBe('anon');
  });
});
