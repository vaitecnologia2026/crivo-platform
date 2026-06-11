import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProductDetail,
  ProductDiagnostic,
  ProductSummary,
  UpsertProductRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * Catálogo de PRODUTOS (control plane, owner-only). O produto é a unidade
 * central do SaaS: define preço, limites, módulos liberados, o instrumento de
 * diagnóstico (perguntas editáveis) e a IA. Ao converter um lead, a empresa é
 * provisionada a partir do produto (FASE 3). Acesso via prisma.admin (owner).
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<ProductSummary[]> {
    const rows = await this.prisma.admin.product.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((p) => this.toSummary(p));
  }

  async get(id: string): Promise<ProductDetail> {
    const p = await this.prisma.admin.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Produto não encontrado');
    return {
      ...this.toSummary(p),
      diagnostic: (p.diagnostic as ProductDiagnostic | null) ?? null,
      aiConfig: (p.aiConfig as ProductDetail['aiConfig']) ?? null,
    };
  }

  async create(dto: UpsertProductRequest, actor: Actor): Promise<ProductDetail> {
    const slug = (dto.slug?.trim() || this.slugify(dto.name)) ?? this.slugify(dto.name);
    const created = await this.prisma.admin.product.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description ?? null,
        status: dto.status ?? 'DRAFT',
        plan: dto.plan ?? null,
        monthlyPriceCents: dto.monthlyPriceCents ?? 0,
        setupPriceCents: dto.setupPriceCents ?? 0,
        maxUsers: dto.maxUsers ?? 0,
        maxLeaders: dto.maxLeaders ?? 0,
        companyType: dto.companyType ?? null,
        modules: (dto.modules ?? []) as object,
        diagnostic: (dto.diagnostic ?? undefined) as object | undefined,
        aiConfig: (dto.aiConfig ?? undefined) as object | undefined,
        isLeadCapture: dto.isLeadCapture ?? false,
      },
    });
    await this.audit.record({ action: 'product.create', actor, target: created.id, meta: { name: created.name } });
    return this.get(created.id);
  }

  async update(id: string, dto: UpsertProductRequest, actor: Actor): Promise<ProductDetail> {
    const existing = await this.prisma.admin.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');
    await this.prisma.admin.product.update({
      where: { id },
      data: {
        slug: dto.slug?.trim() || existing.slug,
        name: dto.name?.trim() ?? existing.name,
        description: dto.description ?? existing.description,
        status: dto.status ?? existing.status,
        plan: dto.plan === undefined ? existing.plan : dto.plan,
        monthlyPriceCents: dto.monthlyPriceCents ?? existing.monthlyPriceCents,
        setupPriceCents: dto.setupPriceCents ?? existing.setupPriceCents,
        maxUsers: dto.maxUsers ?? existing.maxUsers,
        maxLeaders: dto.maxLeaders ?? existing.maxLeaders,
        companyType: dto.companyType ?? existing.companyType,
        modules: (dto.modules ?? (existing.modules as string[])) as object,
        diagnostic: (dto.diagnostic ?? (existing.diagnostic ?? undefined)) as object | undefined,
        aiConfig: (dto.aiConfig ?? (existing.aiConfig ?? undefined)) as object | undefined,
        isLeadCapture: dto.isLeadCapture ?? existing.isLeadCapture,
      },
    });
    await this.audit.record({ action: 'product.update', actor, target: id, meta: { name: dto.name } });
    return this.get(id);
  }

  async remove(id: string, actor: Actor): Promise<{ ok: true }> {
    const existing = await this.prisma.admin.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');
    await this.prisma.admin.product.delete({ where: { id } });
    await this.audit.record({ action: 'product.delete', actor, target: id, meta: { name: existing.name } });
    return { ok: true };
  }

  private toSummary(p: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    status: string;
    plan: string | null;
    monthlyPriceCents: number;
    setupPriceCents: number;
    maxUsers: number;
    maxLeaders: number;
    companyType: string | null;
    modules: unknown;
    diagnostic: unknown;
    isLeadCapture: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ProductSummary {
    const modules = Array.isArray(p.modules) ? (p.modules as string[]) : [];
    const diag = (p.diagnostic as ProductDiagnostic | null) ?? null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      status: p.status as ProductSummary['status'],
      plan: p.plan as ProductSummary['plan'],
      monthlyPriceCents: p.monthlyPriceCents,
      setupPriceCents: p.setupPriceCents,
      maxUsers: p.maxUsers,
      maxLeaders: p.maxLeaders,
      companyType: p.companyType,
      modules,
      isLeadCapture: p.isLeadCapture,
      questionCount: diag?.questions?.length ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
