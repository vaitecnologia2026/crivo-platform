import { Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, planAllowsModule, type AiGovernanceAdminSummary, type AiReviewDue, type Plan } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { AiGovernanceService, type UseCaseFilters } from '../ai-governance/ai-governance.service';

/** Código do módulo (chip de liberação da seção). */
const GOVIA = 'govia' as const;

/**
 * Módulos › Governança de IA (Super Admin) — acompanhamento, POR EMPRESA, do
 * workspace que o cliente governa no portal. SOMENTE LEITURA: reutiliza as
 * mesmas leituras do AiGovernanceService com o organizationId resolvido de
 * Tenant.id (padrão intelligence/lideranca). A CRIVO acompanha, não decide —
 * decisão humana, cadastro e incidentes são do cliente (req.user do portal).
 * A abertura do painel fica na Auditoria (ai_governance.view).
 */
@Injectable()
export class AiGovernanceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly govia: AiGovernanceService,
  ) {}

  /** Tenant.id (control plane) → organizationId (data plane) + identificação. */
  private async resolve(tenantId: string) {
    // rls-allow: tenants é control-plane; resolve Tenant.id → organizationId (padrão dos controllers admin)
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, organizationId: true, name: true, cnpj: true, slug: true, plan: true },
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant;
  }

  /** KPIs + liberação do módulo 'govia'. Acesso auditado. */
  async summary(tenantId: string, actor: AuditActor): Promise<AiGovernanceAdminSummary> {
    const tenant = await this.resolve(tenantId);
    const orgId = tenant.organizationId;

    // rls-allow: tenant_modules é control-plane (mesma leitura do TenantModulesService.list)
    const active = await this.prisma.admin.tenantModule.findFirst({
      where: { tenantId: orgId, enabled: true, moduleCode: GOVIA },
      select: { moduleCode: true },
    });
    const mod = MODULES.find((m) => m.code === GOVIA);
    const module = {
      code: GOVIA,
      name: mod?.name ?? 'Governança de IA',
      minPlan: (mod?.minPlan ?? 'ENTERPRISE') as Plan,
      availableForPlan: planAllowsModule(tenant.plan as Plan, GOVIA),
      enabled: !!active,
    };

    const summary = await this.govia.summary(orgId);

    await this.audit.record({
      action: 'ai_governance.view',
      actor,
      target: tenant.cnpj ?? tenant.slug,
      tenantId: orgId,
      meta: { tenantId, company: tenant.name },
    });

    return {
      company: { tenantId: tenant.id, organizationId: orgId, name: tenant.name, cnpj: tenant.cnpj ?? null },
      module,
      summary,
    };
  }

  async listUseCases(tenantId: string, filters: UseCaseFilters) {
    const t = await this.resolve(tenantId);
    return this.govia.listUseCases(t.organizationId, filters);
  }

  async getUseCase(tenantId: string, useCaseId: string) {
    const t = await this.resolve(tenantId);
    return this.govia.getUseCase(t.organizationId, useCaseId);
  }

  async listDecisions(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.govia.listDecisions(t.organizationId);
  }

  async listIncidents(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.govia.listIncidents(t.organizationId);
  }

  async listPolicies(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.govia.listPolicies(t.organizationId);
  }

  async reviews(tenantId: string, due: AiReviewDue) {
    const t = await this.resolve(tenantId);
    return this.govia.reviews(t.organizationId, due);
  }
}
