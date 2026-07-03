import type { Tenant } from '@crivo/db';
import type { Plan, TenantStatus, TenantSummary } from '@crivo/types';

/** Converte o registro Prisma de Tenant no contrato compartilhado (datas em ISO).
 *  `groupName` é resolvido só onde a listagem precisa (F1); quando undefined,
 *  a chave é omitida do JSON e o front preserva o valor anterior. */
export function toTenantSummary(t: Tenant, groupName?: string | null): TenantSummary {
  const summary: TenantSummary = {
    id: t.id,
    organizationId: t.organizationId,
    slug: t.slug,
    name: t.name,
    plan: t.plan as Plan,
    status: t.status as TenantStatus,
    groupId: t.groupId ?? null,
    cnpj: t.cnpj ?? null,
    headquarterType: t.headquarterType ?? null,
    internalResponsible: t.internalResponsible ?? null,
    createdAt: t.createdAt.toISOString(),
  };
  if (groupName !== undefined) summary.groupName = groupName;
  return summary;
}
