import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TenantsService } from './tenants.service';

// Ficha do contrato (Auditoria & Documentos, 28/09/2026): os eventos contract.*
// gravam o alvo (organização ou grupo) em `target`, não em `tenantId`. A trilha
// filtra por esse alvo e devolve o status gravado em `meta`.

function build() {
  const findMany = vi.fn(async () => [
    { id: 'a1', action: 'contract.update', actorEmail: 'c@crivo', target: 'org-1', meta: { status: 'ATIVO' }, at: new Date('2026-09-01T14:20:00Z') },
  ]);
  const prisma = { admin: { auditLog: { findMany } } };
  return { svc: new TenantsService(prisma as never, {} as never), findMany };
}

describe('TenantsService.recentAudit — filtro por alvo', () => {
  it('filtra por target + prefixo e devolve o meta', async () => {
    const { svc, findMany } = build();
    const rows = await svc.recentAudit(100, { target: 'org-1', prefixes: ['contract.'] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { target: 'org-1', OR: [{ action: { startsWith: 'contract.' } }] },
        take: 100,
      }),
    );
    expect(rows[0]).toMatchObject({ action: 'contract.update', meta: { status: 'ATIVO' }, at: '2026-09-01T14:20:00.000Z' });
  });

  it('sem target não filtra por alvo', async () => {
    const { svc, findMany } = build();
    await svc.recentAudit(30);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
