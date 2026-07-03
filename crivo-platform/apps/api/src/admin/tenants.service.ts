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

  /** Lista todas as empresas-cliente (mais recentes primeiro), com o nome do grupo (F1). */
  async list(): Promise<TenantSummary[]> {
    const [rows, groups] = await Promise.all([
      this.prisma.admin.tenant.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.admin.businessGroup.findMany({ select: { id: true, name: true } }),
    ]);
    const groupNames = new Map(groups.map((g) => [g.id, g.name]));
    return rows.map((t) => toTenantSummary(t, t.groupId ? (groupNames.get(t.groupId) ?? null) : null));
  }

  /** Visão geral da plataforma (KPIs do control plane). */
  async overview() {
    const tenants = await this.prisma.admin.tenant.findMany({ orderBy: { createdAt: 'desc' } });
    const byStatus: Record<string, number> = { ACTIVE: 0, SUSPENDED: 0, DELETED: 0 };
    const byPlan: Record<string, number> = { BASE: 0, EVOLUCAO: 0, ENTERPRISE: 0, ADVISORY: 0 };
    for (const t of tenants) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPlan[t.plan] = (byPlan[t.plan] ?? 0) + 1;
    }
    const [totalUsers, activeUsers, totalLeads] = await Promise.all([
      this.prisma.admin.user.count(),
      this.prisma.admin.user.count({ where: { active: true } }),
      this.prisma.admin.lead.count(),
    ]);
    return {
      totalTenants: tenants.length,
      byStatus,
      byPlan,
      totalUsers,
      activeUsers,
      totalLeads,
      recentTenants: tenants.slice(0, 5).map((t) => toTenantSummary(t)),
    };
  }

  /** Trilha de auditoria das ações de plataforma (mais recentes primeiro). */
  async recentAudit(limit = 30) {
    const rows = await this.prisma.admin.auditLog.findMany({
      orderBy: { at: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorEmail: r.actorEmail,
      target: r.target,
      at: r.at.toISOString(),
    }));
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

  /** Cadastro do CNPJ (Caderno Tela 06 · Incluir): CNPJ, matriz/filial, responsável interno. */
  async setProfile(
    id: string,
    input: { cnpj?: string | null; headquarterType?: string | null; internalResponsible?: string | null },
    actor?: AuditActor,
  ): Promise<TenantSummary> {
    const existing = await this.prisma.admin.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Empresa não encontrada');
    const data: { cnpj?: string | null; headquarterType?: string | null; internalResponsible?: string | null } = {};
    if (input.cnpj !== undefined) data.cnpj = input.cnpj?.replace(/\D/g, '') || null;
    if (input.headquarterType !== undefined) {
      const v = input.headquarterType?.toUpperCase() || null;
      data.headquarterType = v === 'MATRIZ' || v === 'FILIAL' ? v : null;
    }
    if (input.internalResponsible !== undefined) {
      data.internalResponsible = input.internalResponsible?.trim() || null;
    }
    const updated = await this.prisma.admin.tenant.update({ where: { id }, data });
    await this.audit.record({
      action: 'tenant.profile.update',
      actor,
      target: updated.slug,
      tenantId: existing.organizationId,
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

    // leads e usuários ativos são contados direto da tabela (fonte de verdade
    // dos limites). api_calls vem do contador acumulado do período (metering).
    const leadCount = await this.prisma.admin.lead.count({ where: { tenantId: tenant.organizationId } });
    const activeUsers = await this.prisma.admin.user.count({
      where: { tenantId: tenant.organizationId, active: true },
    });
    const apiCalls = await this.prisma.admin.usageCounter.findUnique({
      where: { tenantId_metric_period: { tenantId: tenant.organizationId, metric: 'api_calls', period } },
    });

    return {
      plan,
      period,
      metrics: [
        { metric: 'leads', value: leadCount, limit: limits.maxLeads },
        { metric: 'active_users', value: activeUsers, limit: limits.maxUsers },
        { metric: 'api_calls', value: Number(apiCalls?.value ?? 0n), limit: null },
      ],
    };
  }
}
