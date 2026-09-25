import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TenantsService } from './tenants.service';

// Grupos e Empresas-cliente no modelo do protótipo (25/09/2026): a listagem
// traz, por empresa, usuários, admins, módulos, unidades e aceite LGPD. Os
// dados do portal usam o organizationId como tenantId — nunca o tenant.id.

function build() {
  const tenant = {
    id: 'tenant-1', organizationId: 'org-1', slug: 'massa', name: 'Massa Ouro', plan: 'BASE', status: 'ACTIVE',
    groupId: 'g1', cnpj: null, headquarterType: null, internalResponsible: null,
    consentAnonymized: false, consentBenchmark: false, consentCase: false, consentLogo: false, consentTestimonial: false,
    createdAt: new Date('2026-06-05T12:00:00Z'),
  };
  const semDados = { ...tenant, id: 'tenant-2', organizationId: 'org-2', slug: 'nova', name: 'Nova', groupId: null };
  const userGroupBy = vi.fn(async (args: { where: Record<string, unknown> }) => {
    if ('termsAcceptedAt' in args.where) return [{ tenantId: 'org-1', _count: { _all: 1 } }];
    if (args.where.role === 'ADMIN') return [{ tenantId: 'org-1', _count: { _all: 2 } }];
    return [{ tenantId: 'org-1', _count: { _all: 12 } }, { tenantId: 'tenant-2', _count: { _all: 99 } }];
  });
  const prisma = {
    admin: {
      tenant: { findMany: vi.fn(async () => [tenant, semDados]) },
      businessGroup: { findMany: vi.fn(async () => [{ id: 'g1', name: 'Grupo Exemplo' }]) },
      user: { groupBy: userGroupBy },
      tenantModule: { groupBy: vi.fn(async () => [{ tenantId: 'org-1', _count: { _all: 7 } }]) },
      unit: {
        findMany: vi.fn(async () => [
          { tenantId: 'org-1', name: 'CD Jundiaí' },
          { tenantId: 'org-1', name: 'Matriz SP' },
        ]),
      },
    },
  };
  return new TenantsService(prisma as never, {} as never);
}

describe('TenantsService.list — contadores por empresa', () => {
  it('conta pelo organizationId e devolve os números do painel', async () => {
    const [massa, nova] = await build().list();
    expect(massa.groupName).toBe('Grupo Exemplo');
    expect(massa.stats).toEqual({
      usersCount: 12,
      adminUsersCount: 2,
      modulesEnabled: 7,
      unitsCount: 2,
      unitNames: ['CD Jundiaí', 'Matriz SP'],
      termsAccepted: true,
    });
    // tenant-2 tem 99 usuários gravados sob o tenant.id — não pode contar.
    expect(nova.stats).toEqual({
      usersCount: 0, adminUsersCount: 0, modulesEnabled: 0, unitsCount: 0, unitNames: [], termsAccepted: false,
    });
  });
});
