import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PlatformLeadsService } from './platform-leads.service';

// Homologação 17/09 (jornada, item 2): "consolidar histórico" do lead — uma
// linha do tempo só, montada da trilha de auditoria: eventos com target = lead,
// o intake pelo e-mail e, se convertido, os eventos da empresa/contrato.

const LEAD = 'de490f2f-e338-4860-a672-7a04b309a8a3';

function build(opts: { converted?: boolean; intake?: boolean } = {}) {
  const lead = {
    id: LEAD, email: 'r@x.com', origin: 'lp-diagnostico', diagnosticScore: 35,
    convertedTenantId: opts.converted ? 'ten-1' : null, createdAt: new Date('2026-09-17T12:15:00Z'),
  };
  const rows = [
    ...(opts.intake ? [{ id: 'a1', action: 'lead.intake', actorEmail: null, target: 'r@x.com', meta: { score: 35.4 }, at: new Date('2026-09-17T12:15:14Z') }] : []),
    { id: 'a2', action: 'lead.stage', actorEmail: 'adm@crivo', target: LEAD, meta: { stage: 'PROPOSTA' }, at: new Date('2026-09-17T12:38:00Z') },
    ...(opts.converted
      ? [
          { id: 'a3', action: 'tenant.provision', actorEmail: 'adm@crivo', target: 'essencial-teste', meta: {}, at: new Date('2026-09-17T12:43:10Z') },
          { id: 'a4', action: 'contract.create', actorEmail: 'adm@crivo', target: 'org-1', meta: { status: 'ATIVO' }, at: new Date('2026-09-17T12:43:11Z') },
        ]
      : []),
  ];
  const findMany = vi.fn(async () => rows);
  const prisma = {
    admin: {
      platformLead: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === LEAD ? lead : null)) },
      tenant: { findUnique: vi.fn(async () => ({ slug: 'essencial-teste', organizationId: 'org-1' })) },
      auditLog: { findMany },
    },
  };
  const svc = new PlatformLeadsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  return { svc, findMany };
}

describe('histórico consolidado do lead', () => {
  it('sem intake na trilha, abre com "lead.created" a partir do cadastro', async () => {
    const { svc } = build();
    const h = await svc.history(LEAD);
    expect(h[0]).toMatchObject({ action: 'lead.created', meta: { origin: 'lp-diagnostico', score: 35 } });
    expect(h.map((e) => e.action)).toEqual(['lead.created', 'lead.stage']);
  });

  it('com intake, não duplica a chegada', async () => {
    const { svc } = build({ intake: true });
    expect((await svc.history(LEAD)).map((e) => e.action)).toEqual(['lead.intake', 'lead.stage']);
  });

  it('lead convertido puxa também os eventos da empresa e do contrato', async () => {
    const { svc, findMany } = build({ converted: true, intake: true });
    const h = await svc.history(LEAD);
    expect(h.map((e) => e.action)).toEqual(['lead.intake', 'lead.stage', 'tenant.provision', 'contract.create']);
    const where = (findMany.mock.calls[0] as unknown as [{ where: { OR: unknown[] } }])[0].where;
    expect(where.OR).toEqual(expect.arrayContaining([
      { target: LEAD },
      { action: 'lead.intake', target: 'r@x.com' },
      { action: { startsWith: 'tenant.' }, target: 'essencial-teste' },
      { action: { startsWith: 'contract.' }, target: 'org-1' },
    ]));
  });

  it('lead inexistente → 404', async () => {
    const { svc } = build();
    await expect(svc.history('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});
