import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WorkforceAdminService } from './workforce.service';

/**
 * Super Admin › Workforce › Blueprints e Pilotos: APROVADO é decisão do CLIENTE
 * (portal, auditada com o ator). Este teste prende que a CRIVO NÃO consegue
 * aprovar um blueprint pelo painel administrativo — nem ao criar, nem ao
 * editar — e que nada é gravado/auditado quando tenta.
 */

const ACTOR = { id: 'adm-1', email: 'consultor@crivo.com' };

function montar() {
  const wf = {
    createPilot: vi.fn(async () => ({ id: 'bp-1', name: 'Blueprint', kind: 'BLUEPRINT', status: 'EM_REVISAO' })),
    updatePilot: vi.fn(async () => ({ id: 'bp-1', name: 'Blueprint', kind: 'BLUEPRINT', status: 'SUSPENSO' })),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { admin: { tenant: { findUnique: vi.fn(async () => ({ id: 't-1', organizationId: 'org-1', name: 'Empresa', cnpj: null, slug: 'empresa', plan: 'ENTERPRISE' })) } } };
  const svc = new WorkforceAdminService(prisma as never, audit as never, wf as never);
  return { svc, wf, audit };
}

describe('WorkforceAdminService — aprovação de blueprint é do cliente', () => {
  it('criar com status APROVADO pelo admin → 400, sem persistir nem auditar', async () => {
    const { svc, wf, audit } = montar();
    await expect(
      svc.createPilot('t-1', { kind: 'BLUEPRINT', name: 'Blueprint', baseline: 'b', indicator: 'i', confidence: 'MEDIA', status: 'APROVADO' }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(wf.createPilot).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('editar para APROVADO pelo admin → 400; outros status (SUSPENSO) passam e são auditados', async () => {
    const { svc, wf, audit } = montar();
    await expect(svc.updatePilot('t-1', 'bp-1', { status: 'APROVADO' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(wf.updatePilot).not.toHaveBeenCalled();

    await svc.updatePilot('t-1', 'bp-1', { status: 'SUSPENSO' }, ACTOR);
    expect(wf.updatePilot).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect((audit.record.mock.calls[0] as unknown[])[0]).toMatchObject({ action: 'workforce.pilot.update', tenantId: 'org-1' });
  });
});
