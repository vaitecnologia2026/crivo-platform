import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * O convite ao colaborador saía apenas por existir cadastro importado e a
 * resposta não pertencia a campanha nenhuma — a tela de campanhas prometia
 * "baseline e evolução por ciclo" sem ter como medir. Estes testes prendem:
 * o convite nasce DENTRO de uma campanha aberta, o link é o do convite, e a
 * resposta carrega o ciclo até o motor de coleta.
 */
const { enviado, resolveInstrumentForTenant, usesPsychosocialEngine } = vi.hoisted(() => ({
  enviado: { html: '' },
  resolveInstrumentForTenant: vi.fn(async () => 'diagnostico-organizacional'),
  usesPsychosocialEngine: vi.fn(async () => true),
}));
vi.mock('../common/mailer', () => ({
  mailConfigured: () => true,
  sendMail: vi.fn(async ({ html }: { html: string }) => {
    enviado.html = html;
    return { ok: true as const, provider: 'stub' };
  }),
}));
vi.mock('../common/whatsapp', () => ({
  whatsappConfigured: () => true,
  sendWhatsapp: vi.fn(async () => ({ ok: true as const, provider: 'stub' })),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant,
  usesPsychosocialEngine,
  resolveActiveMethodology: vi.fn(async () => null),
}));

import { CollaboratorsService } from './collaborators.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const COLAB = '22222222-2222-2222-2222-222222222222';
const CICLO = '33333333-3333-3333-3333-333333333333';

function build(opts: { cycleStatus?: string; cycleTenant?: string; invite?: Record<string, unknown> | null } = {}) {
  const colaborador = {
    id: COLAB, tenantId: TENANT, name: 'Maria', phone: '11999990000', sector: 'RH',
    email: 'maria@empresa.com', cpf: '52998224725', token: 'token-legado',
    inviteEmailAt: null, inviteWhatsappAt: null, respondedAt: null, createdAt: new Date(),
  };
  const criados: Record<string, unknown>[] = [];
  const tx = {
    collaborator: {
      findUnique: vi.fn(async () => colaborador),
      update: vi.fn(async () => colaborador),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    assessmentCycle: {
      findUnique: vi.fn(async () => ({
        id: CICLO,
        tenantId: opts.cycleTenant ?? TENANT,
        status: opts.cycleStatus ?? 'OPEN',
      })),
    },
    campaignInvite: {
      findUnique: vi.fn(async () => opts.invite ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        criados.push(data);
        return { id: 'invite-1', ...data, respondedAt: null };
      }),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {
      campaignInvite: { findUnique: vi.fn(async () => null) },
      collaborator: { findUnique: vi.fn(async () => colaborador) },
      organization: { findUnique: vi.fn(async () => ({ name: 'Empresa Teste' })) },
    },
  };
  const psychosocial = {
    submit: vi.fn(async () => ({ ok: true as const, result: { score: 70 } })),
    publicQuestions: vi.fn(async () => [{ id: 1, dimension: 'demandas', text: 'P1' }]),
  };
  const diagnostics = { submitForTenant: vi.fn(async () => ({ ok: true as const, result: { score: 70 } })) };
  const service = new CollaboratorsService(prisma as never, psychosocial as never, diagnostics as never);
  return { service, prisma, tx, psychosocial, diagnostics, criados, colaborador };
}

beforeEach(() => {
  enviado.html = '';
  resolveInstrumentForTenant.mockResolvedValue('diagnostico-organizacional');
  usesPsychosocialEngine.mockResolvedValue(true);
});

describe('convite do colaborador — sempre dentro de uma campanha', () => {
  it('cria o convite no ciclo e envia o link DELE (não o token do colaborador)', async () => {
    const { service, criados } = build();

    const res = await service.sendEmailInvite(TENANT, COLAB, CICLO);

    expect(res.ok).toBe(true);
    expect(criados[0]).toMatchObject({ tenantId: TENANT, cycleId: CICLO, collaboratorId: COLAB });
    const token = criados[0].token as string;
    expect(token).toHaveLength(32); // 16 bytes em hex
    expect(enviado.html).toContain(`/r/${token}`);
    expect(enviado.html).not.toContain('token-legado');
  });

  it('reusa o convite existente daquela campanha (não duplica)', async () => {
    const { service, tx, criados } = build({
      invite: { id: 'invite-1', tenantId: TENANT, cycleId: CICLO, collaboratorId: COLAB, token: 'tk-existente', respondedAt: null },
    });

    await service.sendEmailInvite(TENANT, COLAB, CICLO);

    expect(criados).toHaveLength(0);
    expect(tx.campaignInvite.create).not.toHaveBeenCalled();
    expect(enviado.html).toContain('/r/tk-existente');
  });

  it('campanha fechada não aceita convite novo', async () => {
    const { service } = build({ cycleStatus: 'CLOSED' });
    await expect(service.sendEmailInvite(TENANT, COLAB, CICLO)).rejects.toThrow(BadRequestException);
  });

  it('campanha de outra empresa não é encontrada', async () => {
    const { service } = build({ cycleTenant: '99999999-9999-9999-9999-999999999999' });
    await expect(service.sendEmailInvite(TENANT, COLAB, CICLO)).rejects.toThrow(NotFoundException);
  });
});

describe('resposta pelo link do convite', () => {
  it('leva o ciclo até o motor de coleta (é o que mede a campanha)', async () => {
    const { service, prisma, psychosocial, colaborador } = build();
    prisma.admin.campaignInvite.findUnique = vi.fn(async () => ({
      id: 'invite-1', tenantId: TENANT, cycleId: CICLO, collaboratorId: COLAB,
      token: 'tk', respondedAt: null, collaborator: colaborador,
    })) as never;

    await service.submit('tk', { cpf: '529.982.247-25', answers: [{ questionId: 1, value: 3 }] } as never);

    const chamada = psychosocial.submit.mock.calls[0] as unknown as [string, unknown, unknown, string | null];
    expect(chamada[0]).toBe(TENANT);
    expect(chamada[3]).toBe(CICLO);
  });

  it('link ANTIGO (sem campanha) continua funcionando, sem ciclo', async () => {
    // Convites enviados antes desta mudança não podem morrer.
    const { service, psychosocial } = build();

    await service.submit('token-legado', { cpf: '529.982.247-25', answers: [{ questionId: 1, value: 3 }] } as never);

    const chamada = psychosocial.submit.mock.calls[0] as unknown as [string, unknown, unknown, string | null];
    expect(chamada[3]).toBeNull();
  });
});
