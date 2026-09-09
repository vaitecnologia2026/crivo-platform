import { describe, expect, it, vi } from 'vitest';

/**
 * O lembrete de campanha saía para quem JÁ tinha respondido.
 *
 * Causa: ele media participação em `assessments` (a avaliação de líder do ICD) e
 * mandava para todo USUÁRIO ativo do tenant. A campanha de diagnóstico é
 * respondida pelo COLABORADOR, por CPF, e a participação fica em
 * `campaign_invites.respondedAt` — então `assessments` era sempre 0, a campanha
 * aparecia 100% pendente e o e-mail saía para o usuário do portal, mesmo que ele
 * fosse a mesma pessoa que respondeu como colaborador.
 *
 * Caso real que originou isto: campanha com 7 convites, os 7 respondidos, 0
 * assessments — e o lembrete foi para o único usuário ativo do tenant.
 */

const { sendMail, mailConfigured } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ ok: true, provider: 'smtp' })),
  mailConfigured: vi.fn(() => true),
}));
vi.mock('../common/mailer', () => ({ sendMail, mailConfigured }));

import { IcdService } from './icd.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CICLO = 'ciclo-1';

function build(opts: {
  convites: { respondedAt: Date | null; collaborator: { id: string; name: string; email: string | null } }[];
  assessments?: { leaderId: string }[];
  usuarios?: { id: string; email: string; name: string }[];
}) {
  const tx = {
    assessmentCycle: {
      findUnique: vi.fn(async () => ({
        id: CICLO,
        name: 'ESSENCIAL TESTE',
        description: null,
        status: 'OPEN',
      })),
      update: vi.fn(async () => ({})),
    },
    campaignInvite: { findMany: vi.fn(async () => opts.convites) },
    assessment: { findMany: vi.fn(async () => opts.assessments ?? []) },
    user: { findMany: vi.fn(async () => opts.usuarios ?? []) },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, cb: (t: typeof tx) => unknown) => cb(tx)) };
  const texts = { render: vi.fn(async (_k: string, padrao: string) => padrao) };
  const dispatchPush = vi.fn(async () => undefined);
  const notifications = { isEnabled: vi.fn(async () => true), dispatchPush };
  const service = new IcdService(
    prisma as never, texts as never, notifications as never,
    {} as never, {} as never, {} as never,
  );
  return { service, tx, dispatchPush };
}

function convite(nome: string, email: string | null, respondeu: boolean) {
  return {
    respondedAt: respondeu ? new Date('2026-09-09T15:30:00Z') : null,
    collaborator: { id: `col-${nome}`, name: nome, email },
  };
}

describe('sendCampaignReminders', () => {
  it('não envia nada quando todos os convidados já responderam', async () => {
    const { service, dispatchPush } = build({
      convites: [convite('Ana Ostan', 'ana@x.com', true), convite('Rodrigo Oliveira', 'rodrigo@x.com', true)],
      // O usuário do portal existe e NÃO tem assessment — era exatamente por
      // aqui que o lembrete escapava.
      usuarios: [{ id: 'u1', email: 'rodrigo@x.com', name: 'RODRIGO OLIVEIRA' }],
    });
    const r = await service.sendCampaignReminders(TENANT, CICLO);
    expect(r).toMatchObject({ sent: 0, pending: 0 });
    expect(sendMail).not.toHaveBeenCalled();
    // Sem pendente, o push também não pode chamar ninguém.
    expect(dispatchPush).toHaveBeenCalledWith('icd.lembrete_campanha', expect.objectContaining({ userIds: [] }));
  });

  it('envia só para o convidado que ainda não respondeu', async () => {
    sendMail.mockClear();
    const { service } = build({
      convites: [convite('Ana Ostan', 'ana@x.com', true), convite('Nelson Oliveira', 'nelson@x.com', false)],
      usuarios: [{ id: 'u1', email: 'rodrigo@x.com', name: 'RODRIGO OLIVEIRA' }],
    });
    const r = await service.sendCampaignReminders(TENANT, CICLO);
    expect(r).toMatchObject({ sent: 1, pending: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'nelson@x.com' });
  });

  it('conta o pendente sem e-mail e explica por que ele não recebeu', async () => {
    sendMail.mockClear();
    const { service } = build({
      convites: [convite('Margarida', null, false), convite('Nelson Oliveira', 'nelson@x.com', false)],
    });
    const r = await service.sendCampaignReminders(TENANT, CICLO);
    expect(r.sent).toBe(1);
    expect(r.pending).toBe(2);
    expect(r.reason).toContain('sem e-mail cadastrado');
  });

  it('campanha sem convite algum mantém o caminho histórico do ICD', async () => {
    sendMail.mockClear();
    const { service, dispatchPush } = build({
      convites: [],
      assessments: [{ leaderId: 'u2' }],
      usuarios: [{ id: 'u1', email: 'lider@x.com', name: 'Líder Um' }],
    });
    const r = await service.sendCampaignReminders(TENANT, CICLO);
    expect(r).toMatchObject({ sent: 1, pending: 1 });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'lider@x.com' });
    // Aqui a audiência é usuário do portal, então o push volta a ter destinatário.
    expect(dispatchPush).toHaveBeenCalledWith('icd.lembrete_campanha', expect.objectContaining({ userIds: ['u1'] }));
  });
});
