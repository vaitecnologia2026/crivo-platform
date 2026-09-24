import { describe, expect, it } from 'vitest';
import type { ActionPlanData, CampaignSummary } from '@crivo/types';
import type { ReportEmissionMeta } from './api';
import {
  badgeText,
  buildNotifications,
  stableHash,
  unreadCount,
  type NotificationSources,
} from './portal-notifications';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const DAY = 86_400_000;
const vazio: NotificationSources = { alerts: null, plans: null, emissions: null, campaigns: null };

const plano = (evidencias: Array<{ id: string; title: string; status: string }>): ActionPlanData =>
  ({
    id: 'p1',
    title: 'Plano',
    items: [
      {
        id: 'i1',
        action: 'Revisar escala de pico',
        evidences: evidencias.map((e) => ({ ...e, createdAt: '2026-09-20T10:00:00Z' })),
      },
    ],
  }) as unknown as ActionPlanData;

const emissao = (id: string, createdAt: string): ReportEmissionMeta =>
  ({ id, title: 'Dossiê Técnico', emissionNumber: 1, createdAt, generatedBy: 'ana@x.com' }) as ReportEmissionMeta;

const campanha = (over: Partial<CampaignSummary>): CampaignSummary =>
  ({ id: 'c1', name: 'Ciclo 2026.2', status: 'OPEN', endsAt: null, respondidos: 3, convidados: 10, ...over }) as CampaignSummary;

describe('central de notificações (dado real derivado)', () => {
  it('sem fonte nenhuma não inventa aviso', () => {
    expect(buildNotifications(vazio, NOW)).toEqual([]);
  });

  it('alerta e trava de /alerts viram aviso com id estável; trava é crítica', () => {
    const alerts = {
      alerts: [{ kind: 'acao-atrasada', severity: 'high' as const, message: 'Ação "X" está atrasada.' }],
      locks: [{ kind: 'sem-prazo', message: 'Ação "Y" sem prazo definido.' }],
    };
    const a = buildNotifications({ ...vazio, alerts }, NOW);
    const b = buildNotifications({ ...vazio, alerts }, NOW + DAY);
    expect(a.map((n) => n.id)).toEqual(b.map((n) => n.id));
    expect(a).toHaveLength(2);
    expect(a.find((n) => n.kind === 'Trava')).toMatchObject({ severity: 'high', route: 'relatorios' });
    expect(a.map((n) => n.id)).toContain(`alerta:acao-atrasada:${stableHash('Ação "X" está atrasada.')}`);
  });

  it('mudou a situação (outra contagem), muda o id — o aviso volta como novo', () => {
    const msg = (n: number) => ({
      alerts: [{ kind: 'sugestoes-pendentes', severity: 'info' as const, message: `${n} sugestão(ões) aguardando.` }],
      locks: [],
    });
    const [a] = buildNotifications({ ...vazio, alerts: msg(3) }, NOW);
    const [b] = buildNotifications({ ...vazio, alerts: msg(4) }, NOW);
    expect(a.id).not.toBe(b.id);
  });

  it('baixa adesão leva à tela de campanhas', () => {
    const alerts = { alerts: [{ kind: 'baixa-adesao', severity: 'warn' as const, message: 'adesão baixa' }], locks: [] };
    expect(buildNotifications({ ...vazio, alerts }, NOW)[0].route).toBe('campanhas');
  });

  it('só evidência REJEITADA avisa, apontando a ação', () => {
    const plans = [
      plano([
        { id: 'e1', title: 'Ata', status: 'REJEITADA' },
        { id: 'e2', title: 'Foto', status: 'APROVADA' },
        { id: 'e3', title: 'Lista', status: 'ENVIADA' },
      ]),
    ];
    const out = buildNotifications({ ...vazio, plans }, NOW);
    expect(out).toHaveLength(1);
    // Sem data: o portal só conhece a do envio, não a da rejeição.
    expect(out[0]).toMatchObject({ id: 'evidencia-rejeitada:e1', route: 'evidencias', severity: 'warn', at: null });
    expect(out[0].detail).toContain('Revisar escala de pico');
  });

  it('evidência rejeitada sai do aviso quando houve reenvio depois ou a ação encerrou', () => {
    const comReenvio = plano([{ id: 'e1', title: 'Ata', status: 'REJEITADA' }]);
    comReenvio.items[0].evidences.push({
      id: 'e2',
      title: 'Ata corrigida',
      status: 'ENVIADA',
      createdAt: '2026-09-22T10:00:00Z',
    } as ActionPlanData['items'][number]['evidences'][number]);
    expect(buildNotifications({ ...vazio, plans: [comReenvio] }, NOW)).toEqual([]);

    const concluida = plano([{ id: 'e1', title: 'Ata', status: 'REJEITADA' }]);
    (concluida.items[0] as { status: string }).status = 'CONCLUIDA';
    expect(buildNotifications({ ...vazio, plans: [concluida] }, NOW)).toEqual([]);

    // Envio ANTERIOR à rejeitada não resolve nada.
    const anterior = plano([{ id: 'e1', title: 'Ata', status: 'REJEITADA' }]);
    anterior.items[0].evidences.push({
      id: 'e0',
      title: 'Rascunho',
      status: 'APROVADA',
      createdAt: '2026-09-01T10:00:00Z',
    } as ActionPlanData['items'][number]['evidences'][number]);
    expect(buildNotifications({ ...vazio, plans: [anterior] }, NOW).map((n) => n.id)).toEqual(['evidencia-rejeitada:e1']);
  });

  it('duas ações com o mesmo texto não repetem id (Organização e GHE)', () => {
    const msg = 'Ação "Revisar escala" sem prazo definido.';
    const out = buildNotifications(
      { ...vazio, alerts: { alerts: [], locks: [{ kind: 'sem-prazo', message: msg }, { kind: 'sem-prazo', message: msg }] } },
      NOW,
    );
    expect(new Set(out.map((n) => n.id)).size).toBe(2);
    expect(out[1].id).toBe(`${out[0].id}#2`);
  });

  it('relatório emitido avisa por 30 dias', () => {
    const emissions = [
      emissao('r1', new Date(NOW - 2 * DAY).toISOString()),
      emissao('r2', new Date(NOW - 31 * DAY).toISOString()),
    ];
    const out = buildNotifications({ ...vazio, emissions }, NOW);
    expect(out.map((n) => n.id)).toEqual(['emissao:r1']);
    expect(out[0].route).toBe('documentos');
  });

  it('campanha aberta avisa a 7 dias do fim e depois do prazo; fechada, sem prazo ou longe não', () => {
    const iso = (d: number) => new Date(NOW + d * DAY).toISOString();
    const campaigns = [
      campanha({ id: 'a', endsAt: iso(3) }),
      campanha({ id: 'b', endsAt: iso(10) }),
      campanha({ id: 'c', endsAt: iso(-2) }),
      campanha({ id: 'd', endsAt: iso(2), status: 'CLOSED' }),
      campanha({ id: 'e', endsAt: null }),
      campanha({ id: 'f', endsAt: new Date(NOW + 3_600_000).toISOString() }),
      campanha({ id: 'g', endsAt: new Date(NOW - 3_600_000).toISOString() }),
    ];
    const out = buildNotifications({ ...vazio, campaigns }, NOW);
    const titulos = Object.fromEntries(out.map((n) => [n.id.split(':')[1], n.title]));
    expect(Object.keys(titulos).sort()).toEqual(['a', 'c', 'f', 'g']);
    expect(titulos.a).toContain('encerra em 3 dias');
    expect(titulos.c).toContain('passou do prazo');
    expect(titulos.f).toContain('menos de 24 horas');
    // Venceu há uma hora: não é "encerra hoje", é prazo vencido.
    expect(titulos.g).toContain('passou do prazo');
  });

  it('prorrogou a campanha, o aviso volta como novo', () => {
    const iso = (d: number) => new Date(NOW + d * DAY).toISOString();
    const [a] = buildNotifications({ ...vazio, campaigns: [campanha({ endsAt: iso(2) })] }, NOW);
    const [b] = buildNotifications({ ...vazio, campaigns: [campanha({ endsAt: iso(5) })] }, NOW);
    expect(a.id).not.toBe(b.id);
  });

  it('ordena por gravidade e, no mesmo nível, o mais recente primeiro', () => {
    const out = buildNotifications(
      {
        ...vazio,
        alerts: { alerts: [{ kind: 'sugestoes-pendentes', severity: 'info', message: 'm' }], locks: [{ kind: 'sem-prazo', message: 'l' }] },
        emissions: [emissao('velha', new Date(NOW - 5 * DAY).toISOString()), emissao('nova', new Date(NOW - DAY).toISOString())],
      },
      NOW,
    );
    expect(out.map((n) => n.severity)).toEqual(['high', 'info', 'info', 'info']);
    const info = out.filter((n) => n.id.startsWith('emissao'));
    expect(info.map((n) => n.id)).toEqual(['emissao:nova', 'emissao:velha']);
  });

  it('contador de não lidas e texto do sino', () => {
    const list = buildNotifications(
      { ...vazio, alerts: { alerts: [], locks: [{ kind: 'a', message: '1' }, { kind: 'b', message: '2' }] } },
      NOW,
    );
    expect(unreadCount(list, new Set())).toBe(2);
    expect(unreadCount(list, new Set([list[0].id]))).toBe(1);
    expect(badgeText(0)).toBe('');
    expect(badgeText(7)).toBe('7');
    expect(badgeText(12)).toBe('9+');
  });
});
