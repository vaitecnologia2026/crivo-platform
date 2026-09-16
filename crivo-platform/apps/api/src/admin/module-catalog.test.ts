import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MODULES } from '@crivo/types';
import { ModuleCatalogService } from './module-catalog.service';
import { AddonsService } from './addons.service';
import { ProductsService } from './products.service';
import { ContractsService } from './contracts.service';

/**
 * Módulos Técnicos (Super Admin › Catálogo Comercial) + frestas de liberação.
 * O catálogo é derivado de MODULES com join reverso sobre soluções/adicionais;
 * os campos editoriais são informativos e auditados. As frestas: código fora
 * de MODULES não pode mais ser salvo em produto/adicional, e o contrato só
 * liga em tenant_modules o que existe no catálogo.
 */

const ACTOR = { id: 'super', email: 'super@crivo.platform' };
const ORG = '11111111-1111-1111-1111-111111111111';
const TENANT = '22222222-2222-2222-2222-222222222222';
const PRODUCT = '55555555-5555-5555-5555-555555555555';

function catalogPrisma(overrides: Record<string, unknown> = {}) {
  const store = new Map<string, Record<string, unknown>>();
  return {
    store,
    admin: {
      moduleCatalog: {
        findMany: vi.fn(async () => [...store.values()]),
        findUnique: vi.fn(async ({ where }: { where: { code: string } }) => store.get(where.code) ?? null),
        upsert: vi.fn(async ({ where, create, update }: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const cur = store.get(where.code);
          const next = cur ? { ...cur, ...update } : { ...create };
          next.updatedAt = new Date('2026-09-16T12:00:00Z');
          store.set(where.code, next);
          return next;
        }),
      },
      product: {
        findMany: vi.fn(async () => [
          { name: 'CRIVO Organizacional', modules: ['icd', 'lider'], coreModules: ['dashboard'] },
          { name: 'CRIVO Essencial', modules: [], coreModules: ['dashboard', 'campanhas'] },
        ]),
      },
      addon: {
        findMany: vi.fn(async () => [
          { label: 'Pocket Plus', activatedModules: ['pocket', 'icd'] },
          { label: 'Mentoria executiva', activatedModules: [] },
        ]),
      },
      tenantModule: {
        groupBy: vi.fn(async () => [
          { moduleCode: 'dashboard', _count: { _all: 3 } },
          { moduleCode: 'icd', _count: { _all: 2 } },
        ]),
      },
      ...overrides,
    },
  };
}

describe('ModuleCatalogService.list — composição do catálogo', () => {
  it('devolve uma linha por código de MODULES, na ordem do TS, com join reverso e contagem', async () => {
    const prisma = catalogPrisma();
    const audit = { record: vi.fn(async () => undefined) };
    const svc = new ModuleCatalogService(prisma as never, audit as never);
    const rows = await svc.list();

    expect(rows.map((r) => r.code)).toEqual(MODULES.map((m) => m.code));

    const icd = rows.find((r) => r.code === 'icd')!;
    expect(icd.name).toBe('Indicadores ICD');
    expect(icd.productsUsing).toEqual(['CRIVO Organizacional']);
    expect(icd.addonsUsing).toEqual(['Pocket Plus']);
    expect(icd.tenantsEnabled).toBe(2);

    // coreModules também conta como "solução que usa" (CORE libera no contrato).
    const dash = rows.find((r) => r.code === 'dashboard')!;
    expect(dash.productsUsing).toEqual(['CRIVO Organizacional', 'CRIVO Essencial']);
    expect(dash.addonsUsing).toEqual([]);
    expect(dash.tenantsEnabled).toBe(3);

    // Sem linha em module_catalog: editoriais nulos, status ATIVO, zero empresas.
    const govia = rows.find((r) => r.code === 'govia')!;
    expect(govia.description).toBeNull();
    expect(govia.status).toBe('ATIVO');
    expect(govia.tenantsEnabled).toBe(0);
    expect(govia.productsUsing).toEqual([]);
  });

  it('não inventa código: uma linha em module_catalog fora de MODULES não aparece', async () => {
    const prisma = catalogPrisma();
    prisma.store.set('mod-legado', { code: 'mod-legado', description: 'x', status: 'ATIVO' });
    const svc = new ModuleCatalogService(prisma as never, { record: vi.fn() } as never);
    const rows = await svc.list();
    expect(rows.some((r) => (r.code as string) === 'mod-legado')).toBe(false);
  });
});

describe('ModuleCatalogService.update — campos editoriais', () => {
  it('400 para código fora de MODULES', async () => {
    const svc = new ModuleCatalogService(catalogPrisma() as never, { record: vi.fn() } as never);
    await expect(svc.update('mod-ia', { description: 'x' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('faz upsert sincronizando name/category/minPlan do TS e audita só o diff', async () => {
    const prisma = catalogPrisma();
    const audit = { record: vi.fn(async () => undefined) };
    const svc = new ModuleCatalogService(prisma as never, audit as never);

    const saved = await svc.update('pocket', { description: 'Reflexões guiadas', status: 'BETA' }, ACTOR);
    expect(saved.description).toBe('Reflexões guiadas');
    expect(saved.status).toBe('BETA');
    // Espelho do TS, nunca do que veio no body.
    const row = prisma.store.get('pocket')!;
    expect(row.name).toBe('Pocket CRIVO');
    expect(row.category).toBe('lideranca');
    expect(row.minPlan).toBe('EVOLUCAO');

    expect(audit.record).toHaveBeenCalledOnce();
    const entry = (audit.record.mock.calls as unknown as Array<[{ action: string; target: string; meta: { changed: Record<string, unknown> } }]>)[0][0];
    expect(entry.action).toBe('module.catalog.update');
    expect(entry.target).toBe('pocket');
    expect(Object.keys(entry.meta.changed).sort()).toEqual(['description', 'status']);

    // Segundo PUT sem o campo mantém; string vazia limpa.
    const again = await svc.update('pocket', { releaseRule: 'Contrato ATIVO com Pocket', description: '' }, ACTOR);
    expect(again.releaseRule).toBe('Contrato ATIVO com Pocket');
    expect(again.description).toBeNull();
    expect(again.status).toBe('BETA');
  });
});

describe('Frestas de liberação — códigos fora de MODULES', () => {
  it('AddonsService.upsert rejeita activatedModules com código inexistente, listando-o', async () => {
    const prisma = { admin: { addon: { findUnique: vi.fn(async () => null), upsert: vi.fn() } } };
    const svc = new AddonsService(prisma as never, { record: vi.fn() } as never);
    await expect(
      svc.upsert('crivo-plus', { activatedModules: ['icd', 'mod-ia', 'mod-dossie'] }, ACTOR),
    ).rejects.toMatchObject({ message: expect.stringContaining('mod-ia, mod-dossie') });
    expect(prisma.admin.addon.upsert).not.toHaveBeenCalled();
  });

  it('AddonsService.upsert aceita lista vazia (adicional de serviço humano) e códigos válidos', async () => {
    const saved = { moduleCode: 'crivo-plus', label: 'Plus', recurrence: 'MENSAL', statusEx: 'ATIVO', compatibleSolutions: [], activatedModules: ['icd'] };
    const prisma = { admin: { addon: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => saved) } } };
    const svc = new AddonsService(prisma as never, { record: vi.fn(async () => undefined) } as never);
    await expect(svc.upsert('crivo-plus', { label: 'Plus', activatedModules: [] }, ACTOR)).resolves.toBeTruthy();
    await expect(svc.upsert('crivo-plus', { label: 'Plus', activatedModules: ['icd'] }, ACTOR)).resolves.toBeTruthy();
  });

  it('ProductsService.create/update rejeitam modules e coreModules inválidos sem tocar o banco', async () => {
    const prisma = {
      admin: {
        product: {
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn(async () => ({ id: PRODUCT, name: 'X', slug: 'x', modules: [], coreModules: [] })),
        },
      },
    };
    const svc = new ProductsService(prisma as never, { record: vi.fn() } as never);
    await expect(svc.create({ name: 'Novo', modules: ['mod-diag'] } as never, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.update(PRODUCT, { coreModules: ['dashboard', 'mod-base'] } as never, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admin.product.create).not.toHaveBeenCalled();
    expect(prisma.admin.product.update).not.toHaveBeenCalled();
  });

  it('ProductsService.update não valida o que não veio no DTO (registro legado continua editável)', async () => {
    const existing = {
      id: PRODUCT,
      name: 'X',
      slug: 'x',
      modules: ['mod-legado'],
      coreModules: [],
      status: 'DRAFT',
      modalities: [],
      suggestedModules: [],
      suggestedAddons: [],
      compatiblePackages: [],
      supportedOutputs: [],
      allowedAddons: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      admin: {
        product: {
          update: vi.fn(async () => existing),
          findUnique: vi.fn(async () => existing),
        },
      },
    };
    const svc = new ProductsService(prisma as never, { record: vi.fn(async () => undefined) } as never);
    await expect(svc.update(PRODUCT, { name: 'X renomeado' } as never, ACTOR)).resolves.toBeTruthy();
    expect(prisma.admin.product.update).toHaveBeenCalledOnce();
  });
});

describe('ContractsService — contractModuleCodes filtra solução por MODULES', () => {
  it('ao ATIVAR, só códigos do catálogo viram tenant_modules (modules e coreModules)', async () => {
    const created = {
      id: 'c1',
      organizationId: ORG,
      groupId: null,
      productId: PRODUCT,
      solutionIds: [PRODUCT],
      model: 'PONTUAL',
      status: 'ATIVO',
      method: null,
      technicalOutput: 'SEM_INTEGRACAO',
      startDate: null,
      endDate: null,
      accessDays: null,
      rounds: 1,
      maxRespondents: 0,
      maxLeaders: 0,
      optionalModules: ['crivo-plus', 'mod-people'],
      responsible: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      admin: {
        tenant: { findUnique: vi.fn(async () => ({ id: TENANT, organizationId: ORG })) },
        contract: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => created),
          update: vi.fn(),
        },
        product: {
          findMany: vi.fn(async () => [
            // Produto salvo antes da validação, com códigos do protótipo.
            { modules: ['icd', 'mod-ia'], coreModules: ['dashboard', 'mod-dossie'] },
          ]),
        },
        addon: {
          findMany: vi.fn(async () => [{ moduleCode: 'crivo-plus', activatedModules: ['pocket', 'mod-people'] }]),
        },
        tenantModule: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      },
    };
    const svc = new ContractsService(prisma as never, { record: vi.fn(async () => undefined) } as never);
    await svc.upsert(TENANT, { solutionIds: [PRODUCT], status: 'ATIVO', optionalModules: ['crivo-plus', 'mod-people'] } as never, ACTOR);

    const ligados = (prisma.admin.tenantModule.upsert.mock.calls as unknown as Array<[{ create: { moduleCode: string } }]>)
      .map((c) => c[0].create.moduleCode)
      .sort();
    expect(ligados).toEqual(['dashboard', 'icd', 'pocket']);
  });
});
