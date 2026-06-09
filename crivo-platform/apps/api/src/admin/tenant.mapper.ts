import type { Tenant } from '@crivo/db';
import type { Plan, TenantStatus, TenantSummary } from '@crivo/types';

/** Converte o registro Prisma de Tenant no contrato compartilhado (datas em ISO). */
export function toTenantSummary(t: Tenant): TenantSummary {
  return {
    id: t.id,
    organizationId: t.organizationId,
    slug: t.slug,
    name: t.name,
    plan: t.plan as Plan,
    status: t.status as TenantStatus,
    createdAt: t.createdAt.toISOString(),
  };
}
