import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, type AddonSummary, type AddonUpsertRequest } from '@crivo/types';
import type { Addon, AddonRecurrence, AddonStatus } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * Catálogo de ADICIONAIS (upsells) — tabela do cliente (mockup 14/07).
 * Um adicional pode ser um módulo do ModuleCatalog precificado (legado) OU um
 * upsell próprio (crivo-plus, mentoria-executiva…). Entra no contrato via
 * Contract.optionalModules e no faturamento/MRR quando recurring=true.
 */
@Injectable()
export class AddonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista o catálogo: registros salvos + módulos do ModuleCatalog ainda sem preço. */
  async list(): Promise<AddonSummary[]> {
    const rows = await this.prisma.admin.addon.findMany({ orderBy: { createdAt: 'asc' } });
    const byCode = new Map(rows.map((r) => [r.moduleCode, r]));
    const fromDb = rows.map((r) => this.toSummary(r));
    // Módulos do catálogo fixo que ainda não viraram registro (painel de preços legado).
    const placeholders = MODULES.filter((m) => !byCode.has(m.code)).map((m) => ({
      moduleCode: m.code,
      label: m.name,
      category: m.category,
      monthlyPriceCents: 0,
      setupPriceCents: 0,
      recurring: true,
      active: true,
      configured: false,
      description: null,
      recurrence: 'MENSAL' as const,
      priceLabel: null,
      compatibleSolutions: [],
      activatedModules: [],
      limitsNote: null,
      dependenciesNote: null,
      releaseRule: null,
      statusEx: 'ATIVO' as const,
    }));
    return [...fromDb, ...placeholders];
  }

  /** Cria/atualiza um adicional. Aceita módulos do catálogo E códigos próprios (slug). */
  async upsert(moduleCode: string, dto: AddonUpsertRequest, actor: Actor): Promise<AddonSummary> {
    const code = moduleCode.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(code)) {
      throw new BadRequestException('Código do adicional inválido (use letras minúsculas, números e hífen)');
    }
    const m = MODULES.find((x) => x.code === code);
    const existing = await this.prisma.admin.addon.findUnique({ where: { moduleCode: code } });
    const fallbackLabel = existing?.label ?? m?.name ?? code;

    const recurrence = (dto.recurrence ?? existing?.recurrence ?? 'MENSAL') as AddonRecurrence;
    const statusEx = (dto.statusEx ?? existing?.statusEx ?? 'ATIVO') as AddonStatus;
    const data = {
      label: dto.label?.trim() || fallbackLabel,
      monthlyPriceCents: Math.max(0, Math.round(dto.monthlyPriceCents ?? existing?.monthlyPriceCents ?? 0)),
      setupPriceCents: Math.max(0, Math.round(dto.setupPriceCents ?? existing?.setupPriceCents ?? 0)),
      // recurring/active seguem derivados p/ manter MRR e painéis legados coerentes.
      recurring: dto.recurring ?? recurrence === 'MENSAL',
      active: dto.active ?? statusEx === 'ATIVO',
      description: dto.description === undefined ? (existing?.description ?? null) : dto.description,
      category: dto.category === undefined ? (existing?.category ?? null) : dto.category,
      recurrence,
      priceLabel: dto.priceLabel === undefined ? (existing?.priceLabel ?? null) : dto.priceLabel,
      compatibleSolutions: dto.compatibleSolutions ?? existing?.compatibleSolutions ?? [],
      activatedModules: dto.activatedModules ?? existing?.activatedModules ?? [],
      limitsNote: dto.limitsNote === undefined ? (existing?.limitsNote ?? null) : dto.limitsNote,
      dependenciesNote: dto.dependenciesNote === undefined ? (existing?.dependenciesNote ?? null) : dto.dependenciesNote,
      releaseRule: dto.releaseRule === undefined ? (existing?.releaseRule ?? null) : dto.releaseRule,
      statusEx,
    };
    const saved = await this.prisma.admin.addon.upsert({
      where: { moduleCode: code },
      create: { moduleCode: code, ...data },
      update: data,
    });
    await this.audit.record({
      action: 'addon.upsert',
      actor,
      target: code,
      meta: { label: data.label, monthlyPriceCents: data.monthlyPriceCents },
    });
    return this.toSummary(saved);
  }

  /** Remove um adicional do catálogo (módulos do ModuleCatalog voltam a "não precificado"). */
  async remove(moduleCode: string, actor: Actor): Promise<{ ok: true }> {
    const existing = await this.prisma.admin.addon.findUnique({ where: { moduleCode } });
    if (!existing) throw new NotFoundException('Adicional não encontrado');
    await this.prisma.admin.addon.delete({ where: { moduleCode } });
    await this.audit.record({ action: 'addon.delete', actor, target: moduleCode, meta: { label: existing.label } });
    return { ok: true };
  }

  private toSummary(r: Addon): AddonSummary {
    const m = MODULES.find((x) => x.code === r.moduleCode);
    return {
      moduleCode: r.moduleCode,
      label: r.label,
      category: r.category ?? m?.category ?? 'adicional',
      monthlyPriceCents: r.monthlyPriceCents,
      setupPriceCents: r.setupPriceCents,
      recurring: r.recurring,
      active: r.active,
      configured: true,
      description: r.description,
      recurrence: r.recurrence,
      priceLabel: r.priceLabel,
      compatibleSolutions: r.compatibleSolutions ?? [],
      activatedModules: r.activatedModules ?? [],
      limitsNote: r.limitsNote,
      dependenciesNote: r.dependenciesNote,
      releaseRule: r.releaseRule,
      statusEx: r.statusEx,
    };
  }
}
