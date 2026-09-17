import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MODULES,
  planAllowsModule,
  type Plan,
  type SaveWorkSkillsRequest,
  type UpdateWorkPilotRequest,
  type UpsertWorkPilotRequest,
  type UpsertWorkProcessRequest,
  type UpsertWorkTaskRequest,
  type ValidateWorkTaskRequest,
  type WorkTaskFilters,
  type WorkforceAdminSummary,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { WorkforceService, type WorkforceActor } from '../workforce/workforce.service';

/** Código do módulo (chip de liberação da seção). */
const WORKFORCE = 'workforce' as const;

/**
 * Módulos › Workforce Intelligence (Super Admin) — workspace da equipe CRIVO
 * POR EMPRESA sobre os MESMOS models que o cliente lê no portal. Fase 1: o
 * consultor CRIVO alimenta processos/tarefas/skills/pilotos e VALIDA as
 * tarefas (fila EM_VALIDACAO_CRIVO); o cliente decide no portal. Tudo passa
 * pelo WorkforceService com o organizationId resolvido de Tenant.id e escrito
 * sob forTenant (RLS ativa mesmo vindo do control plane — não abre precedente
 * de prisma.admin em tabela de negócio). Toda escrita é auditada workforce.*.
 */
@Injectable()
export class WorkforceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wf: WorkforceService,
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

  private async record(action: string, tenantId: string, actor: AuditActor, target: string, meta: Record<string, unknown>) {
    const t = await this.resolve(tenantId);
    await this.audit.record({ action, actor, target, tenantId: t.organizationId, meta: { tenantId, company: t.name, ...meta } });
  }

  /** KPIs + liberação do módulo 'workforce'. Acesso auditado. */
  async summary(tenantId: string, actor: AuditActor): Promise<WorkforceAdminSummary> {
    const tenant = await this.resolve(tenantId);
    const orgId = tenant.organizationId;

    // rls-allow: tenant_modules é control-plane (mesma leitura do TenantModulesService.list)
    const active = await this.prisma.admin.tenantModule.findFirst({
      where: { tenantId: orgId, enabled: true, moduleCode: WORKFORCE },
      select: { moduleCode: true },
    });
    const mod = MODULES.find((m) => m.code === WORKFORCE);
    const module = {
      code: WORKFORCE,
      name: mod?.name ?? 'Workforce Intelligence',
      minPlan: (mod?.minPlan ?? 'ENTERPRISE') as Plan,
      availableForPlan: planAllowsModule(tenant.plan as Plan, WORKFORCE),
      enabled: !!active,
    };

    const summary = await this.wf.summary(orgId);

    await this.audit.record({
      action: 'workforce.view',
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

  // ── Processos ──

  async listProcesses(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.wf.listProcesses(t.organizationId);
  }

  async processDetail(tenantId: string, processId: string) {
    const t = await this.resolve(tenantId);
    return this.wf.processDetail(t.organizationId, processId);
  }

  async createProcess(tenantId: string, dto: UpsertWorkProcessRequest, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const p = await this.wf.createProcess(t.organizationId, dto);
    await this.record('workforce.process.create', tenantId, actor, p.name, { processId: p.id, area: p.area, aiThresholdPct: p.aiThresholdPct });
    return p;
  }

  async updateProcess(tenantId: string, processId: string, dto: UpsertWorkProcessRequest, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const p = await this.wf.updateProcess(t.organizationId, processId, dto);
    await this.record('workforce.process.update', tenantId, actor, p.name, { processId: p.id, area: p.area, aiThresholdPct: p.aiThresholdPct });
    return p;
  }

  async deleteProcess(tenantId: string, processId: string, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const r = await this.wf.deleteProcess(t.organizationId, processId);
    await this.record('workforce.process.delete', tenantId, actor, processId, { processId });
    return r;
  }

  // ── Tarefas ──

  async listTasks(tenantId: string, filters: WorkTaskFilters) {
    const t = await this.resolve(tenantId);
    return this.wf.listTasks(t.organizationId, filters);
  }

  async getTask(tenantId: string, taskId: string) {
    const t = await this.resolve(tenantId);
    return this.wf.getTask(t.organizationId, taskId);
  }

  async createTask(tenantId: string, dto: UpsertWorkTaskRequest, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const task = await this.wf.createTask(t.organizationId, dto);
    await this.record('workforce.task.create', tenantId, actor, task.code, { taskId: task.id, name: task.name, stage: task.stage });
    return task;
  }

  async updateTask(tenantId: string, taskId: string, dto: UpsertWorkTaskRequest, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const task = await this.wf.updateTask(t.organizationId, taskId, dto);
    await this.record('workforce.task.update', tenantId, actor, task.code, { taskId: task.id, name: task.name, stage: task.stage });
    return task;
  }

  async deleteTask(tenantId: string, taskId: string, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const r = await this.wf.deleteTask(t.organizationId, taskId);
    await this.record('workforce.task.delete', tenantId, actor, taskId, { taskId });
    return r;
  }

  /** Validação CRIVO — a auditoria (workforce.task.validate) é gravada pelo próprio WorkforceService. */
  async validateTask(tenantId: string, taskId: string, dto: ValidateWorkTaskRequest, actor: WorkforceActor) {
    const t = await this.resolve(tenantId);
    return this.wf.validateTask(t.organizationId, taskId, dto, actor);
  }

  // Não há decideTask aqui de propósito: a decisão sobre a tarefa é humana e
  // do CLIENTE (portal, POST /workforce/tasks/:id/decision) — a CRIVO valida.

  // ── Skills ──

  async listSkills(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.wf.listSkills(t.organizationId);
  }

  async saveSkills(tenantId: string, dto: SaveWorkSkillsRequest, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const rows = await this.wf.saveSkills(t.organizationId, dto);
    await this.record('workforce.skills.update', tenantId, actor, `${rows.length} skill(s)`, { skills: rows.map((s) => s.name) });
    return rows;
  }

  // ── Pilotos e blueprints ──

  async listPilots(tenantId: string) {
    const t = await this.resolve(tenantId);
    return this.wf.listPilots(t.organizationId);
  }

  /** APROVADO é decisão do CLIENTE (no portal, auditada com o ator) — a CRIVO não aprova blueprint pelo Super Admin. */
  private static assertNotApproving(status: string | undefined) {
    if (status === 'APROVADO') throw new BadRequestException('A aprovação do blueprint é decisão do cliente, feita no portal.');
  }

  async createPilot(tenantId: string, dto: UpsertWorkPilotRequest, actor: AuditActor) {
    WorkforceAdminService.assertNotApproving(dto.status);
    const t = await this.resolve(tenantId);
    const p = await this.wf.createPilot(t.organizationId, dto);
    await this.record('workforce.pilot.create', tenantId, actor, p.name, { pilotId: p.id, kind: p.kind, status: p.status });
    return p;
  }

  async updatePilot(tenantId: string, pilotId: string, dto: UpdateWorkPilotRequest, actor: AuditActor) {
    WorkforceAdminService.assertNotApproving(dto.status);
    const t = await this.resolve(tenantId);
    const p = await this.wf.updatePilot(t.organizationId, pilotId, dto);
    await this.record('workforce.pilot.update', tenantId, actor, p.name, { pilotId: p.id, kind: p.kind, status: p.status });
    return p;
  }

  async deletePilot(tenantId: string, pilotId: string, actor: AuditActor) {
    const t = await this.resolve(tenantId);
    const r = await this.wf.deletePilot(t.organizationId, pilotId);
    await this.record('workforce.pilot.delete', tenantId, actor, pilotId, { pilotId });
    return r;
  }
}
