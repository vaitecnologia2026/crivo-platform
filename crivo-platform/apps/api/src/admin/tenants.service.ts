import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toTenantSummary } from './tenant.mapper';
import type { TenantStatus } from '@crivo/db';
import type { TenantSummary } from '@crivo/types';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista todas as empresas-cliente (mais recentes primeiro). */
  async list(): Promise<TenantSummary[]> {
    const rows = await this.prisma.admin.tenant.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toTenantSummary);
  }

  async get(id: string): Promise<TenantSummary> {
    const t = await this.prisma.admin.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Empresa não encontrada');
    return toTenantSummary(t);
  }

  /** Bloqueia (SUSPENDED) ou reativa (ACTIVE) — controla o acesso ao login. */
  setStatus(id: string, status: TenantStatus, actor?: AuditActor) {
    return this.update(id, status, actor);
  }

  /** Exclusão LÓGICA (DELETED): reversível, preserva dados. Purge físico é à parte. */
  softDelete(id: string, actor?: AuditActor) {
    return this.update(id, 'DELETED', actor);
  }

  private async update(id: string, status: TenantStatus, actor?: AuditActor): Promise<TenantSummary> {
    const existing = await this.prisma.admin.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa não encontrada');
    const updated = await this.prisma.admin.tenant.update({ where: { id }, data: { status } });
    await this.audit.record({
      action: `tenant.${status === 'ACTIVE' ? 'activate' : status === 'SUSPENDED' ? 'suspend' : 'delete'}`,
      actor,
      target: updated.slug,
      tenantId: updated.organizationId,
    });
    return toTenantSummary(updated);
  }
}
