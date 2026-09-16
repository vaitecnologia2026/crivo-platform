import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MODULES,
  type ModuleCatalogEntry,
  type ModuleCatalogStatus,
  type ModuleCatalogUpdateRequest,
  type ModuleCode,
  type Plan,
} from '@crivo/types';
import type { Plan as DbPlan } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * Módulos Técnicos (Super Admin › Catálogo Comercial). Registro INTERNO das
 * capacidades reutilizáveis que compõem soluções e adicionais — não são
 * vendidos nem têm preço. A lista vem de MODULES (@crivo/types, fonte única:
 * code/name/category/minPlan só mudam por deploy); module_catalog guarda os
 * campos editoriais do protótipo (descrição, dependências, permissões, regra
 * de ativação, status), que são texto informativo e auditado — a liberação
 * para a empresa continua sendo Solução/Adicional → Contrato ATIVO →
 * tenant_modules (contracts.service). Control plane (owner-only).
 */
@Injectable()
export class ModuleCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Catálogo completo: MODULES + campos editoriais + join reverso + empresas ativas. */
  async list(): Promise<ModuleCatalogEntry[]> {
    const [rows, products, addons, enabledByCode] = await Promise.all([
      this.prisma.admin.moduleCatalog.findMany(),
      this.prisma.admin.product.findMany({
        select: { name: true, modules: true, coreModules: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.admin.addon.findMany({
        select: { label: true, activatedModules: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Contagem cross-tenant de propósito: é o Super Admin olhando o parque
      // inteiro ("Empresas com o módulo ativo"), sem expor dado de empresa.
      this.prisma.admin.tenantModule.groupBy({
        by: ['moduleCode'],
        where: { enabled: true },
        _count: { _all: true },
      }),
    ]);
    const rowByCode = new Map(rows.map((r) => [r.code, r]));
    const enabled = new Map(enabledByCode.map((g) => [g.moduleCode, g._count._all]));

    return MODULES.map((m) => {
      const row = rowByCode.get(m.code);
      const productsUsing = products
        .filter((p) => asList(p.modules).includes(m.code) || asList(p.coreModules).includes(m.code))
        .map((p) => p.name);
      const addonsUsing = addons
        .filter((a) => (a.activatedModules ?? []).includes(m.code))
        .map((a) => a.label);
      return {
        code: m.code,
        name: m.name,
        category: m.category,
        minPlan: m.minPlan as Plan,
        description: row?.description ?? null,
        dependenciesNote: row?.dependenciesNote ?? null,
        permissionsNote: row?.permissionsNote ?? null,
        releaseRule: row?.releaseRule ?? null,
        status: (row?.status ?? 'ATIVO') as ModuleCatalogStatus,
        productsUsing,
        addonsUsing,
        tenantsEnabled: enabled.get(m.code) ?? 0,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    });
  }

  /** Atualiza os campos editoriais de um módulo. Código fora de MODULES → 400. */
  async update(code: string, dto: ModuleCatalogUpdateRequest, actor: Actor): Promise<ModuleCatalogEntry> {
    const def = MODULES.find((m) => m.code === code);
    if (!def) {
      throw new BadRequestException(
        `Módulo "${code}" não existe no catálogo. Códigos válidos: ${MODULES.map((m) => m.code).join(', ')}`,
      );
    }
    const existing = await this.prisma.admin.moduleCatalog.findUnique({ where: { code } });
    const editorial = {
      description: pick(dto.description, existing?.description),
      dependenciesNote: pick(dto.dependenciesNote, existing?.dependenciesNote),
      permissionsNote: pick(dto.permissionsNote, existing?.permissionsNote),
      releaseRule: pick(dto.releaseRule, existing?.releaseRule),
      status: (dto.status ?? existing?.status ?? 'ATIVO') as ModuleCatalogStatus,
    };
    // name/category/minPlan sempre do TS: a tabela é espelho, não fonte.
    const sync = { name: def.name, category: def.category, minPlan: def.minPlan as DbPlan };
    await this.prisma.admin.moduleCatalog.upsert({
      where: { code },
      create: { code, ...sync, ...editorial },
      update: { ...sync, ...editorial },
    });

    // Diff só do que mudou de fato — é o que a Auditoria mostra.
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(editorial) as Array<keyof typeof editorial>) {
      const before = existing?.[key] ?? (key === 'status' ? 'ATIVO' : null);
      if (before !== editorial[key]) changed[key] = { from: before, to: editorial[key] };
    }
    await this.audit.record({
      action: 'module.catalog.update',
      actor,
      target: code,
      meta: { name: def.name, changed },
    });

    const all = await this.list();
    return all.find((e) => e.code === (code as ModuleCode)) as ModuleCatalogEntry;
  }
}

/** Campo opcional do PUT: undefined = mantém; null/'' = limpa. */
function pick(next: string | null | undefined, current: string | null | undefined): string | null {
  if (next === undefined) return current ?? null;
  const v = next?.trim();
  return v ? v : null;
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}
