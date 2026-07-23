import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatAiDirectives } from './ai-directives';

/**
 * IA da Plataforma — leituras do motor de IA para o Super Admin:
 * consumo (ai_call_logs agregado), logs de chamadas e contextos por cliente
 * (contrato → produto → aiConfig quando allowsCustomAi). Control plane.
 */
@Injectable()
export class AiInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Consumo agregado — padrão: últimos 30 dias. */
  async usage(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = { createdAt: { gte: since } };

    const [calls, okCalls, tokens, byUseCase, byTenantRaw] = await Promise.all([
      this.prisma.admin.aiCallLog.count({ where }),
      this.prisma.admin.aiCallLog.count({ where: { ...where, ok: true } }),
      this.prisma.admin.aiCallLog.aggregate({
        where,
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      }),
      this.prisma.admin.aiCallLog.groupBy({
        by: ['useCase'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      this.prisma.admin.aiCallLog.groupBy({
        by: ['tenantId'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
    ]);

    const errorByUseCase = await this.prisma.admin.aiCallLog.groupBy({
      by: ['useCase'],
      where: { ...where, ok: false },
      _count: { _all: true },
    });
    const errMap = new Map(errorByUseCase.map((e) => [e.useCase, e._count._all]));

    const tenantIds = byTenantRaw.map((t) => t.tenantId).filter((id): id is string => !!id);
    const orgs = tenantIds.length
      ? await this.prisma.admin.organization.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(orgs.map((o) => [o.id, o.name]));

    return {
      days,
      since: since.toISOString(),
      totals: {
        calls,
        okCalls,
        errorCalls: calls - okCalls,
        promptTokens: tokens._sum.promptTokens ?? 0,
        completionTokens: tokens._sum.completionTokens ?? 0,
        totalTokens: tokens._sum.totalTokens ?? 0,
      },
      byUseCase: byUseCase
        .map((u) => ({
          useCase: u.useCase,
          calls: u._count._all,
          errors: errMap.get(u.useCase) ?? 0,
          totalTokens: u._sum.totalTokens ?? 0,
        }))
        .sort((a, b) => b.calls - a.calls),
      byTenant: byTenantRaw
        .map((t) => ({
          tenantId: t.tenantId,
          tenantName: t.tenantId ? (nameOf.get(t.tenantId) ?? '(empresa removida)') : 'Sem empresa (leads da LP)',
          calls: t._count._all,
          totalTokens: t._sum.totalTokens ?? 0,
        }))
        .sort((a, b) => b.calls - a.calls),
    };
  }

  /** Logs de chamadas (mais recentes primeiro; filtros opcionais). */
  async logs(params: { limit?: number; useCase?: string; onlyErrors?: boolean }) {
    // NaN (ex.: ?limit=abc) não é filtrado por `??` e quebraria o Prisma com take:NaN.
    const raw = params.limit;
    const take =
      Number.isFinite(raw) && (raw as number) >= 1 ? Math.min(Math.floor(raw as number), 500) : 100;
    const rows = await this.prisma.admin.aiCallLog.findMany({
      where: {
        ...(params.useCase ? { useCase: params.useCase } : {}),
        ...(params.onlyErrors ? { ok: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((id): id is string => !!id))];
    const orgs = tenantIds.length
      ? await this.prisma.admin.organization.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(orgs.map((o) => [o.id, o.name]));
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      useCase: r.useCase,
      tenantName: r.tenantId ? (nameOf.get(r.tenantId) ?? '(empresa removida)') : null,
      model: r.model,
      ok: r.ok,
      errorReason: r.errorReason,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      latencyMs: r.latencyMs,
    }));
  }

  /**
   * Contextos por cliente — para cada empresa com contrato, mostra se o produto
   * contratado permite IA personalizada e, quando sim, o bloco de diretrizes
   * EXATO que é anexado ao prompt do Copiloto (mesma resolução do runtime).
   */
  async contexts() {
    // Contratos de GRUPO têm organizationId null — fora do escopo de diretivas
    // por empresa (o runtime resolve por organizationId, mesma regra aqui).
    const contracts = await this.prisma.admin.contract.findMany({
      where: { status: { in: ['ATIVO', 'RASCUNHO'] }, organizationId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { organizationId: true, status: true, productId: true },
    });
    const orgIds = [...new Set(contracts.map((c) => c.organizationId!))];
    const orgs = orgIds.length
      ? await this.prisma.admin.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(orgs.map((o) => [o.id, o.name]));
    // 1 linha por empresa: o contrato mais recente prevalece (mesma regra do runtime).
    const seen = new Set<string>();
    const rows: {
      tenantId: string;
      tenantName: string;
      contractStatus: string;
      productName: string | null;
      allowsCustomAi: boolean;
      directives: string;
    }[] = [];
    for (const c of contracts) {
      const orgId = c.organizationId!;
      if (seen.has(orgId)) continue;
      seen.add(orgId);
      let productName: string | null = null;
      let allowsCustomAi = false;
      let directives = '';
      if (c.productId) {
        const product = await this.prisma.admin.product.findUnique({
          where: { id: c.productId },
          select: { name: true, aiConfig: true, allowsCustomAi: true },
        });
        productName = product?.name ?? null;
        allowsCustomAi = !!product?.allowsCustomAi;
        if (product?.allowsCustomAi) directives = formatAiDirectives(product.aiConfig);
      }
      rows.push({
        tenantId: orgId,
        tenantName: nameOf.get(orgId) ?? '(empresa removida)',
        contractStatus: c.status,
        productName,
        allowsCustomAi,
        directives,
      });
    }
    return rows;
  }
}
