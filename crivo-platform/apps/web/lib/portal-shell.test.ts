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
  refreshPortalData,
  sessionKeyFromToken,
  startPortalSession,
  type PortalSession,
} from './portal-shell';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const sessao = (userKey: string): PortalSession => ({
  userKey,
  orgName: 'O2 LEGACY',
  roleLabel: 'Administrador',
  contracted: ['CRIVO Diagnóstico Organizacional'],
  hasGroup: false,
});
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

  it('chave da pessoa sai do token; token ruim vira "anon"', () => {
    const payload = btoa(JSON.stringify({ sub: 'u9', tenantId: 't9' })).replace(/=+$/, '');
    expect(sessionKeyFromToken(`h.${payload}.s`)).toBe('t9:u9');
    expect(sessionKeyFromToken('lixo')).toBe('anon');
    expect(sessionKeyFromToken(null)).toBe('anon');
  });
});
