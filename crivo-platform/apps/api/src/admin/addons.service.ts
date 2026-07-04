import { Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, type AddonSummary, type AddonUpsertRequest } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * Adicionais precificados (Caderno Tela 05 · modelo Adicional c/ preço+recorrência).
 * O catálogo é o ModuleCatalog (MODULES); cada módulo pode ganhar um preço de
 * adicional. Usado no contrato (optionalModules) e no faturamento/MRR do dashboard.
 */
@Injectable()
export class AddonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista TODOS os módulos do catálogo, com o preço salvo (0 se não configurado). */
  async list(): Promise<AddonSummary[]> {
    const rows = await this.prisma.admin.addon.findMany();
    const byCode = new Map(rows.map((r) => [r.moduleCode, r]));
    return MODULES.map((m) => {
      const r = byCode.get(m.code);
      return {
        moduleCode: m.code,
        label: r?.label ?? m.name,
        category: m.category,
        monthlyPriceCents: r?.monthlyPriceCents ?? 0,
        setupPriceCents: r?.setupPriceCents ?? 0,
        recurring: r?.recurring ?? true,
        active: r?.active ?? true,
        configured: !!r,
      };
    });
  }

  /** Define o preço/recorrência de um adicional (módulo do catálogo). */
  async upsert(moduleCode: string, dto: AddonUpsertRequest, actor: Actor): Promise<AddonSummary> {
    const m = MODULES.find((x) => x.code === moduleCode);
    if (!m) throw new NotFoundException('Módulo não encontrado no catálogo');

    const data = {
      label: dto.label?.trim() || m.name,
      monthlyPriceCents: Math.max(0, Math.round(dto.monthlyPriceCents ?? 0)),
      setupPriceCents: Math.max(0, Math.round(dto.setupPriceCents ?? 0)),
      recurring: dto.recurring ?? true,
      active: dto.active ?? true,
    };
    const saved = await this.prisma.admin.addon.upsert({
      where: { moduleCode },
      create: { moduleCode, ...data },
      update: data,
    });
    await this.audit.record({ action: 'addon.upsert', actor, target: moduleCode, meta: { monthlyPriceCents: data.monthlyPriceCents } });

    return {
      moduleCode,
      label: saved.label,
      category: m.category,
      monthlyPriceCents: saved.monthlyPriceCents,
      setupPriceCents: saved.setupPriceCents,
      recurring: saved.recurring,
      active: saved.active,
      configured: true,
    };
  }
}
