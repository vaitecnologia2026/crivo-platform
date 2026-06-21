import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import type { PrismaClient } from '@crivo/db';
import { PLAN_LIMITS, type Plan } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

/** Período de metering corrente (YYYY-MM, UTC). */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Metering (F4): contadores de uso por empresa e enforcement dos limites do
 * plano (PLAN_LIMITS). Os métodos recebem o `tx` já escopado por tenant
 * (forTenant) para que contagem, checagem e escrita fiquem na mesma transação
 * sob RLS — sem condição de corrida com o limite.
 */
@Injectable()
export class MeteringService {
  private readonly logger = new Logger(MeteringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Incrementa um contador para o tenant, abrindo o próprio escopo RLS.
   *  Best-effort: nunca derruba a requisição (usado pelo interceptor). */
  async track(tenantId: string, metric: string, by = 1): Promise<void> {
    try {
      await this.prisma.forTenant(tenantId, (tx) => this.increment(tx, tenantId, metric, by));
    } catch (err) {
      this.logger.warn(`Falha ao contabilizar ${metric} (tenant ${tenantId}): ${String(err)}`);
    }
  }

  /** Lê o plano da empresa (dentro do tenant). Default BASE se ausente. */
  private async planOf(tx: PrismaClient, tenantId: string): Promise<Plan> {
    const org = await tx.organization.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    return (org?.plan ?? 'BASE') as Plan;
  }

  /** Barra (422) se criar mais um lead estouraria o limite do plano. */
  async assertLeadQuota(tx: PrismaClient, tenantId: string): Promise<void> {
    const max = PLAN_LIMITS[await this.planOf(tx, tenantId)].maxLeads;
    if (max === null) return; // ilimitado
    const count = await tx.lead.count();
    if (count >= max) {
      throw new UnprocessableEntityException(
        `Limite do plano atingido: ${max} leads. Faça upgrade para adicionar mais.`,
      );
    }
  }

  /**
   * Limite de usuários ativos da empresa (null = ilimitado). O Produto da
   * empresa (control plane) tem prioridade — é onde o super admin define
   * "quantos usuários a empresa pode criar" (maxUsers; 0 = ilimitado). Sem
   * produto, cai no limite do plano (PLAN_LIMITS).
   */
  async userLimit(tenantId: string): Promise<number | null> {
    // tenant/product são control-plane (owner-only); lê o limite do próprio tenant.
    // rls-allow: organizationId = tenantId da sessão; forTenant não enxerga estas tabelas control-plane.
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { organizationId: tenantId },
      select: { productId: true, plan: true },
    });
    if (tenant?.productId) {
      // rls-allow: product é control-plane (definido pelo super admin); id vem do tenant já resolvido acima.
      const product = await this.prisma.admin.product.findUnique({
        where: { id: tenant.productId },
        select: { maxUsers: true },
      });
      if (product) return product.maxUsers > 0 ? product.maxUsers : null; // 0 = ilimitado
    }
    return PLAN_LIMITS[(tenant?.plan ?? 'BASE') as Plan].maxUsers;
  }

  /** Barra (422) se criar mais um usuário ativo estouraria o limite da empresa. */
  async assertUserQuota(tx: PrismaClient, tenantId: string): Promise<void> {
    const max = await this.userLimit(tenantId);
    if (max === null) return; // ilimitado
    const count = await tx.user.count({ where: { active: true } });
    if (count >= max) {
      throw new UnprocessableEntityException(
        `Limite de usuários atingido: ${max} ativos. Aumente o limite no produto da empresa (Super Admin).`,
      );
    }
  }

  /** Incrementa um contador de uso no período corrente (idempotente por upsert). */
  async increment(tx: PrismaClient, tenantId: string, metric: string, by = 1): Promise<void> {
    const period = currentPeriod();
    await tx.usageCounter.upsert({
      where: { tenantId_metric_period: { tenantId, metric, period } },
      create: { tenantId, metric, period, value: BigInt(by) },
      update: { value: { increment: BigInt(by) } },
    });
  }
}
