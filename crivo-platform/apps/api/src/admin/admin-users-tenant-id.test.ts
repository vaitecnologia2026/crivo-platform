import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';

// Homologação 17/09: "Usuários provisionados precisam aparecer corretamente no
// SuperAdmin". A tela manda o id do registro `tenants` (control plane); o
// usuário vive em `users.tenantId` → organizations.id (data plane), que é
// OUTRO uuid. O service devolvia 404 e a empresa aparecia sem usuários.

const ORG = 'dded8882-85a0-4bc0-85e2-01b34d2ec548';
const TENANT = '9a20f262-f191-4eac-92f3-925d9f119819';

function build() {
  const findMany = vi.fn(async ({ where }: { where: { tenantId: string } }) =>
    where.tenantId === ORG
      ? [{ id: 'u1', email: 'r@x', name: 'Rodrigo', role: 'ADMINISTRADOR', active: true, screenAccess: null, createdAt: new Date('2026-09-17T12:43:00Z') }]
      : [],
  );
  const prisma = {
    admin: {
      organization: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === ORG ? { id: ORG } : null)) },
      tenant: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === TENANT ? { organizationId: ORG } : null)) },
      user: { findMany, count: vi.fn(async () => 1) },
    },
  };
  const svc = new AdminUsersService(prisma as any, {} as any, { userLimit: vi.fn(async () => 5) } as any);
  return { svc, findMany };
}

describe('AdminUsersService — id do tenant (control plane) x id da organização', () => {
  it('lista os usuários quando a rota manda o id do registro tenants', async () => {
    const { svc, findMany } = build();
    const rows = await svc.list(TENANT);
    expect(rows.map((r) => r.email)).toEqual(['r@x']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: ORG } }));
  });

  it('continua aceitando o id da organização', async () => {
    const { svc } = build();
    expect((await svc.list(ORG)).length).toBe(1);
  });

  it('assentos também resolvem pelo id do tenant', async () => {
    const { svc } = build();
    expect(await svc.seats(TENANT)).toEqual({ active: 1, max: 5 });
  });

  it('id desconhecido segue 404', async () => {
    const { svc } = build();
    await expect(svc.list('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});
