import { Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, POCKET_QUESTIONS_VERSION, planAllowsModule, type LiderancaAdminSummary, type Plan } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { IcdCyclesService } from '../icd-cycles/icd-cycles.service';
import { PocketService } from '../pocket/pocket.service';
import type { CreateIcdCycleDto } from '../icd-cycles/dto';

/** Os três módulos do programa Liderança (chip de liberação da seção). */
const LIDERANCA_MODULES = ['icd', 'lider', 'pocket'] as const;

/**
 * Módulos › Liderança (Super Admin) — workspace administrativo do programa
 * Liderança (Mapa Executivo / ICD CRIVO™ / CRIVO Pocket™) POR EMPRESA.
 *
 * Nenhuma regra nova: reutiliza IcdCyclesService (list/create/close/official/
 * history/summary) e PocketService.aggregate com o organizationId resolvido de
 * Tenant.id (padrão intelligence.service). Tudo que sai daqui é agregado com
 * supressão n < MIN_LEADERS_FOR_DISCLOSURE — o Super Admin nunca vê ICD de um
 * líder nem reflexão Pocket (Anexo ICD §11 / Anexo Pocket §13). Abrir/fechar
 * ciclo e consultar o painel ficam na Auditoria com o ator (super admin).
 */
@Injectable()
export class LiderancaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cycles: IcdCyclesService,
    private readonly pocket: PocketService,
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

  /** KPIs + liberação dos módulos + agregados do ciclo aberto. Acesso auditado. */
  async summary(tenantId: string, actor: AuditActor): Promise<LiderancaAdminSummary> {
    const tenant = await this.resolve(tenantId);
    const orgId = tenant.organizationId;

    // rls-allow: tenant_modules é control-plane (mesma leitura do TenantModulesService.list)
    const active = await this.prisma.admin.tenantModule.findMany({
      where: { tenantId: orgId, enabled: true, moduleCode: { in: [...LIDERANCA_MODULES] } },
      select: { moduleCode: true },
    });
    const enabled = new Set(active.map((m) => m.moduleCode));
    const plan = tenant.plan as Plan;
    const modules = LIDERANCA_MODULES.flatMap((code) => {
      const m = MODULES.find((x) => x.code === code);
      if (!m) return [];
      return [{
        code: m.code,
        name: m.name,
        minPlan: m.minPlan as Plan,
        availableForPlan: planAllowsModule(plan, code),
        enabled: enabled.has(code),
      }];
    });

    const [icd, pocket] = await Promise.all([this.cycles.summary(orgId), this.pocket.aggregate(orgId)]);

    await this.audit.record({
      action: 'lideranca.view',
      actor,
      target: tenant.cnpj ?? tenant.slug,
      tenantId: orgId,
      meta: { tenantId, company: tenant.name },
    });

    return {
      company: { tenantId: tenant.id, organizationId: orgId, name: tenant.name, cnpj: tenant.cnpj ?? null },
      modules,
      icd,
      pocket,
      pocketQuestionsVersion: POCKET_QUESTIONS_VERSION,
    };
  }

  async listCycles(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.cycles.list(t.organizationId);
  }

  async history(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.cycles.history(t.organizationId);
  }

  /** Resultado oficial do ciclo — `leaders` sempre [] (o service já não expõe). */
  async official(tenantId: string, cycleId: string) {
    const t = await this.resolve(tenantId);
    return this.cycles.official(t.organizationId, cycleId);
  }

  async createCycle(tenantId: string, dto: CreateIcdCycleDto, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const cycle = await this.cycles.create(t.organizationId, dto);
    await this.audit.record({
      action: 'icd.cycle.create',
      actor,
      target: cycle.name,
      tenantId: t.organizationId,
      meta: { cycleId: cycle.id, quarter: cycle.quarter, year: cycle.year, company: t.name },
    });
    return cycle;
  }

  async closeCycle(tenantId: string, cycleId: string, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const cycle = await this.cycles.close(t.organizationId, cycleId);
    await this.audit.record({
      action: 'icd.cycle.close',
      actor,
      target: cycle.name,
      tenantId: t.organizationId,
      meta: { cycleId: cycle.id, company: t.name },
    });
    return cycle;
  }

  async pocketAggregate(tenantId: string, cycleId?: string) {
    const t = await this.resolve(tenantId);
    return this.pocket.aggregate(t.organizationId, cycleId);
  }
}
