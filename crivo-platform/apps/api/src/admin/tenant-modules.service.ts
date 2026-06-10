import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import {
  MODULES,
  planAllowsModule,
  type ModuleCode,
  type Plan,
  type TenantModuleSummary,
} from '@crivo/types';

/**
 * Gestão dos módulos (F4) de cada empresa, pelo super admin (control plane).
 * Escreve em tenant_modules via conexão owner (a escrita é owner-only no
 * rls.sql; o app só lê os módulos da própria empresa). O catálogo de módulos é
 * a fonte única em @crivo/types (MODULES) — o que existe e o minPlan de cada um.
 */
@Injectable()
export class TenantModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Catálogo de módulos + estado (ativo? disponível no plano?) para a empresa. */
  async list(tenantId: string): Promise<TenantModuleSummary[]> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    const active = await this.prisma.admin.tenantModule.findMany({
      where: { tenantId: tenant.organizationId, enabled: true },
      select: { moduleCode: true },
    });
    const enabled = new Set(active.map((m) => m.moduleCode));
    const plan = tenant.plan as Plan;

    return MODULES.map((m) => ({
      code: m.code,
      name: m.name,
      category: m.category,
      minPlan: m.minPlan as Plan,
      availableForPlan: planAllowsModule(plan, m.code),
      enabled: enabled.has(m.code),
    }));
  }

  /** (Des)ativa um módulo. Ativar exige que o plano da empresa o permita. */
  async setEnabled(
    tenantId: string,
    code: string,
    enabled: boolean,
    actor?: AuditActor,
  ): Promise<TenantModuleSummary[]> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    const moduleDef = MODULES.find((m) => m.code === code);
    if (!moduleDef) throw new BadRequestException(`Módulo "${code}" não existe no catálogo`);

    const plan = tenant.plan as Plan;
    if (enabled && !planAllowsModule(plan, code as ModuleCode)) {
      throw new UnprocessableEntityException(
        `O plano ${plan} não permite o módulo "${code}" (mínimo: ${moduleDef.minPlan})`,
      );
    }

    await this.prisma.admin.tenantModule.upsert({
      where: { tenantId_moduleCode: { tenantId: tenant.organizationId, moduleCode: code } },
      create: { tenantId: tenant.organizationId, moduleCode: code, enabled },
      update: { enabled },
    });

    await this.audit.record({
      action: enabled ? 'tenant.module.enable' : 'tenant.module.disable',
      actor,
      target: tenant.slug,
      tenantId: tenant.organizationId,
      meta: { module: code },
    });

    return this.list(tenantId);
  }
}
