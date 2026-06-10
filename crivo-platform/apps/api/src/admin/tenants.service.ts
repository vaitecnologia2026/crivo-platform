import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toTenantSummary } from './tenant.mapper';
import type { Plan, TenantStatus } from '@crivo/db';
import {
  MODULES,
  PLAN_LIMITS,
  planAllowsModule,
  type Plan as PlanCode,
  type TenantSummary,
  type UsageSummary,
} from '@crivo/types';

/** Período de metering corrente (YYYY-MM, UTC). */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

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

  /**
   * Troca o plano da empresa e re-sincroniza os módulos para o BASELINE do novo
   * plano: tudo que o plano permite fica ATIVO, o resto DESATIVADO (igual ao
   * provisioning). Previsível — "este plano inclui estes módulos"; o operador
   * refina depois nos toggles. Atualiza Tenant (control plane) e Organization
   * (data plane) na mesma transação owner.
   */
  async setPlan(id: string, plan: Plan, actor?: AuditActor): Promise<TenantSummary> {
    const existing = await this.prisma.admin.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa não encontrada');

    const orgId = existing.organizationId;
    const updated = await this.prisma.admin.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: orgId }, data: { plan } });
      const t = await tx.tenant.update({ where: { id }, data: { plan } });

      for (const m of MODULES) {
        const enabled = planAllowsModule(plan as PlanCode, m.code);
        await tx.tenantModule.upsert({
          where: { tenantId_moduleCode: { tenantId: orgId, moduleCode: m.code } },
          create: { tenantId: orgId, moduleCode: m.code, enabled },
          update: { enabled },
        });
      }
      return t;
    });

    await this.audit.record({
      action: 'tenant.plan.change',
      actor,
      target: updated.slug,
      tenantId: orgId,
      meta: { plan },
    });
    return toTenantSummary(updated);
  }

  /** Uso corrente da empresa (período atual) vs. limites do plano. */
  async usage(id: string): Promise<UsageSummary> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    const plan = tenant.plan as PlanCode;
    const period = currentPeriod();
    const limits = PLAN_LIMITS[plan];

    const counters = await this.prisma.admin.usageCounter.findMany({
      where: { tenantId: tenant.organizationId, period },
    });
    const value = (metric: string) =>
      Number(counters.find((c) => c.metric === metric)?.value ?? 0n);
    // leads é contado direto da tabela (fonte de verdade do limite), não do contador.
    const leadCount = await this.prisma.admin.lead.count({ where: { tenantId: tenant.organizationId } });

    return {
      plan,
      period,
      metrics: [
        { metric: 'leads', value: leadCount, limit: limits.maxLeads },
        { metric: 'active_users', value: value('active_users'), limit: limits.maxUsers },
      ],
    };
  }
}
