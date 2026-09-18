import { describe, expect, it, vi } from 'vitest';

/**
 * Homologação 17/09: "Participação nominal do colaborador deve ser protegida."
 * A resposta é anônima, mas o portal dizia "Respondeu · <data>" ao lado do
 * nome. O servidor deixa de mandar quem respondeu: o cadastro sai só com o
 * convite, e a campanha traz a adesão em NÚMERO (`resumo`).
 */
vi.mock('../common/mailer', () => ({
  mailConfigured: () => true,
  sendMail: vi.fn(async () => ({ ok: true as const, provider: 'stub' })),
}));
vi.mock('../common/whatsapp', () => ({ whatsappConfigured: () => false, sendWhatsapp: vi.fn() }));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant: vi.fn(async () => 'diagnostico-essencial'),
  usesPsychosocialEngine: vi.fn(async () => false),
  resolveActiveMethodology: vi.fn(async () => null),
}));

import { CollaboratorsService } from './collaborators.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CICLO = '33333333-3333-3333-3333-333333333333';

function colab(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id, tenantId: TENANT, name, phone: null, sector: 'Financeiro', email: `${id}@x.com`, cpf: '52998224725',
    unit: null, area: null, role: null, shift: null, ghe: 'FIN', manager: null, workModel: null,
    gender: null, birthYear: null, ageBand: null, token: `tk-${id}`,
    inviteEmailAt: null, inviteWhatsappAt: null, respondedAt: null, createdAt: new Date('2026-09-17T10:00:00Z'),
    ...extra,
  };
}

function build() {
  const ana = colab('c1', 'Ana', { inviteEmailAt: new Date('2026-09-17T11:00:00Z'), respondedAt: new Date('2026-09-17T12:00:00Z') });
  const bia = colab('c2', 'Bia', { inviteEmailAt: new Date('2026-09-17T11:00:00Z') });
  const caio = colab('c3', 'Caio');
  const invites = [
    { id: 'i1', tenantId: TENANT, cycleId: CICLO, collaboratorId: 'c1', token: 'ti1', respondedAt: new Date('2026-09-17T12:00:00Z'), sentEmailAt: new Date(), sentWhatsappAt: null },
    { id: 'i2', tenantId: TENANT, cycleId: CICLO, collaboratorId: 'c2', token: 'ti2', respondedAt: null, sentEmailAt: new Date(), sentWhatsappAt: null },
  ];
  const tx = {
    collaborator: { findMany: vi.fn(async () => [ana, bia, caio]), findUnique: vi.fn(async () => ana) },
    assessmentCycle: { findUnique: vi.fn(async () => ({ id: CICLO, tenantId: TENANT, name: 'Campanha 1', sector: null, status: 'OPEN' })) },
    campaignInvite: { findMany: vi.fn(async () => invites) },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
  const service = new CollaboratorsService(prisma as never, {} as never, {} as never);
  return { service, tx };
}

describe('participação nominal protegida', () => {
  it('o cadastro não diz quem respondeu — só o convite', async () => {
    const { service } = build();
    const rows = await service.list(TENANT);
    const ana = rows.find((r) => r.name === 'Ana')!;
    expect(ana.status).toBe('invited');
    expect(ana).not.toHaveProperty('respondedAt');
    expect(JSON.stringify(rows)).not.toMatch(/respond/i);
    expect(rows.find((r) => r.name === 'Caio')!.status).toBe('pending');
  });

  it('a campanha traz a adesão em número, nunca o nome de quem respondeu', async () => {
    const { service } = build();
    const r = await service.participants(TENANT, CICLO);
    expect(r.resumo).toEqual({ cadastrados: 3, convidados: 2, responderam: 1 });
    expect(r.participants.map((p) => [p.name, p.status])).toEqual([
      ['Ana', 'convidado'],
      ['Bia', 'convidado'],
      ['Caio', 'pendente'],
    ]);
    expect(JSON.stringify(r.participants)).not.toMatch(/respond/i);
  });

  it('convite em lote sem ids só vai a quem nunca foi convidado (quem respondeu não recebe)', async () => {
    const { service } = build();
    const spy = vi.spyOn(service, 'sendEmailInvite').mockResolvedValue({ ok: true, provider: 'stub' } as never);
    const r = await service.inviteMany(TENANT, CICLO);
    expect(r.total).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(TENANT, 'c3', CICLO);
  });

  it('reenvio escolhido por id vai mesmo a quem já respondeu — recusar revelaria quem foi', async () => {
    const { service } = build();
    const spy = vi.spyOn(service, 'sendEmailInvite').mockResolvedValue({ ok: true, provider: 'stub' } as never);
    const r = await service.inviteMany(TENANT, CICLO, ['c1']);
    expect(r.enviados).toBe(1);
    expect(spy).toHaveBeenCalledWith(TENANT, 'c1', CICLO);
  });
});
