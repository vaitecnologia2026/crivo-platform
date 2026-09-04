import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';

/**
 * O e-mail é o CANAL do convite: dois cadastros com o mesmo endereço fazem os
 * links de duas pessoas caírem na mesma caixa, e quem abrir primeiro responde
 * no lugar do outro. A identidade continua sendo o CPF — o e-mail é a entrega.
 */
vi.mock('../admin/methodology.service', () => ({
  resolveActiveMethodology: vi.fn(async () => null),
  resolveInstrumentForTenant: vi.fn(async () => 'diagnostico-essencial'),
  usesPsychosocialEngine: vi.fn(async () => false),
}));
vi.mock('../common/mailer', () => ({ mailConfigured: () => true, sendMail: vi.fn() }));
vi.mock('../common/whatsapp', () => ({ whatsappConfigured: () => true, sendWhatsapp: vi.fn() }));

import { CollaboratorsService } from './collaborators.service';

const TENANT = '11111111-1111-1111-1111-111111111111';

/** `existentes` alimenta as duas buscas: por CPF e por e-mail. */
function build(existentes: { id?: string; cpf?: string; email?: string | null; name?: string }[] = []) {
  const tx = {
    collaborator: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if ('cpf' in where) return existentes.find((c) => c.cpf === where.cpf) ?? null;
        const alvo = (where.email as { equals?: string } | undefined)?.equals?.toLowerCase();
        return existentes.find((c) => c.email?.toLowerCase() === alvo) ?? null;
      }),
      findMany: vi.fn(async () => existentes),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'novo', tenantId: TENANT, createdAt: new Date(), respondedAt: null,
        inviteEmailAt: null, inviteWhatsappAt: null, phone: null, sector: null, ...data,
      })),
    },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
  return { service: new CollaboratorsService(prisma as never, {} as never, {} as never), tx };
}

const novo = (email: string) => ({ name: 'Ana', cpf: '529.982.247-25', email });

describe('e-mail único por empresa', () => {
  it('recusa cadastrar com e-mail que já é de outra pessoa', async () => {
    const { service } = build([{ id: 'x', cpf: '11144477735', email: 'chefe@empresa.com', name: 'Margarida' }]);
    await expect(service.create(TENANT, novo('chefe@empresa.com') as never)).rejects.toThrow(ConflictException);
    // A mensagem diz DE QUEM é o e-mail e o que fazer com quem não tem um.
    await expect(service.create(TENANT, novo('chefe@empresa.com') as never)).rejects.toThrow(/Margarida/);
  });

  it('ignora maiúsculas/minúsculas na comparação', async () => {
    const { service } = build([{ id: 'x', cpf: '11144477735', email: 'Chefe@Empresa.com', name: 'Margarida' }]);
    await expect(service.create(TENANT, novo('chefe@empresa.com') as never)).rejects.toThrow(ConflictException);
  });

  it('colaborador SEM e-mail continua sendo aceito', async () => {
    // WhatsApp e link copiado seguem atendendo quem não tem e-mail.
    const { service } = build([{ id: 'x', cpf: '11144477735', email: 'chefe@empresa.com', name: 'Margarida' }]);
    const r = await service.create(TENANT, { name: 'Sem e-mail', cpf: '529.982.247-25' } as never);
    expect(r.name).toBe('Sem e-mail');
  });

  it('importação aponta a LINHA do e-mail repetido e segue com as demais', async () => {
    const { service } = build([]);
    const r = await service.importMany(TENANT, [
      { name: 'Ana', cpf: '529.982.247-25', email: 'time@empresa.com' },
      { name: 'Bruno', cpf: '111.444.777-35', email: 'time@empresa.com' },
      { name: 'Carla', cpf: '123.456.789-09', email: 'carla@empresa.com' },
    ] as never);
    expect(r.created).toBe(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 2 });
    expect(r.errors[0].reason).toContain('E-mail duplicado');
  });
});
