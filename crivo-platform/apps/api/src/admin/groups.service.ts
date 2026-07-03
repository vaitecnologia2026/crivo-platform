import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toTenantSummary } from './tenant.mapper';
import type { BusinessGroupSummary, TenantSummary, TenantStatus } from '@crivo/types';

/**
 * Grupos Empresariais (F1 · Caderno Tela 06 — Grupo → CNPJ → Unidade).
 * Control plane, exclusivo do super admin. O grupo é uma camada leve acima do
 * tenant: cada CNPJ é um tenant próprio (isolamento RLS existente), e o grupo
 * apenas os agrupa para gestão. Visão consolidada autorizada vem nas fases F2/F3.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista os grupos com seus CNPJs (tenants) vinculados. */
  async list(): Promise<BusinessGroupSummary[]> {
    const [groups, tenants] = await Promise.all([
      this.prisma.admin.businessGroup.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.admin.tenant.findMany({
        where: { groupId: { not: null } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, status: true, groupId: true },
      }),
    ]);
    const byGroup = new Map<string, BusinessGroupSummary['tenants']>();
    for (const t of tenants) {
      const arr = byGroup.get(t.groupId!) ?? [];
      arr.push({ id: t.id, name: t.name, slug: t.slug, status: t.status as TenantStatus });
      byGroup.set(t.groupId!, arr);
    }
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      tenants: byGroup.get(g.id) ?? [],
    }));
  }

  /** Cria um grupo empresarial. */
  async create(name: string, actor: AuditActor): Promise<BusinessGroupSummary> {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Informe o nome do grupo.');
    const g = await this.prisma.admin.businessGroup.create({ data: { name: trimmed } });
    await this.audit.record({ action: 'group.create', actor, target: g.id, meta: { name: trimmed } });
    return { id: g.id, name: g.name, createdAt: g.createdAt.toISOString(), tenants: [] };
  }

  /** Renomeia um grupo. */
  async rename(id: string, name: string, actor: AuditActor): Promise<{ ok: true }> {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Informe o nome do grupo.');
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    await this.prisma.admin.businessGroup.update({ where: { id }, data: { name: trimmed } });
    await this.audit.record({ action: 'group.update', actor, target: id, meta: { name: trimmed } });
    return { ok: true };
  }

  /** Remove um grupo — apenas se não houver CNPJs vinculados. */
  async remove(id: string, actor: AuditActor): Promise<{ ok: true }> {
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    const linked = await this.prisma.admin.tenant.count({ where: { groupId: id } });
    if (linked > 0) {
      throw new BadRequestException(
        `Este grupo tem ${linked} empresa(s) vinculada(s). Desvincule antes de excluir.`,
      );
    }
    await this.prisma.admin.businessGroup.delete({ where: { id } });
    await this.audit.record({ action: 'group.delete', actor, target: id, meta: { name: g.name } });
    return { ok: true };
  }

  /** Vincula (ou desvincula, com groupId=null) uma empresa a um grupo. */
  async assignTenant(
    tenantId: string,
    groupId: string | null,
    actor: AuditActor,
  ): Promise<TenantSummary> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');

    let groupName: string | null = null;
    if (groupId) {
      const g = await this.prisma.admin.businessGroup.findUnique({ where: { id: groupId } });
      if (!g) throw new NotFoundException('Grupo não encontrado.');
      groupName = g.name;
    }

    const updated = await this.prisma.admin.tenant.update({
      where: { id: tenantId },
      data: { groupId },
    });
    await this.audit.record({
      action: 'tenant.group.set',
      actor,
      target: tenantId,
      meta: { groupId, groupName },
    });
    return toTenantSummary(updated, groupName);
  }
}
