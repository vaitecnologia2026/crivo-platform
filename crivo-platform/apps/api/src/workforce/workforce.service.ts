import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORK_DECISIONS,
  WORK_DECISION_TO_STAGE,
  WORK_RISKS,
  WORK_TASK_STAGES,
  WORKFORCE_SCENARIOS,
  type DecideWorkTaskRequest,
  type SaveWorkSkillsRequest,
  type UpdateWorkPilotRequest,
  type UpsertWorkPilotRequest,
  type UpsertWorkProcessRequest,
  type UpsertWorkTaskRequest,
  type ValidateWorkTaskRequest,
  type WorkDecision,
  type WorkPilotData,
  type WorkProcessData,
  type WorkProcessDetail,
  type WorkRisk,
  type WorkSkillData,
  type WorkTaskData,
  type WorkTaskFilters,
  type WorkTaskStage,
  type WorkforceScenario,
  type WorkforceSummary,
} from '@crivo/types';
import type { PrismaClient } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin/audit.service';

/** Quem decide no portal (req.user) ou valida no Super Admin (PlatformAdmin). */
export interface WorkforceActor {
  id: string;
  name: string;
  email: string;
}

/** Linha crua da tarefa (+ nome do processo quando a query inclui). */
type TaskRow = {
  id: string; code: string; processId: string; role: string; area: string; name: string;
  input: string; output: string; volumePerMonth: number; durationMin: number; criticality: string;
  aiPotential: number; humanEssentiality: number; risk: string; readiness: number; scenario: string;
  scenarioCurrent: string | null; scenarioAssisted: string | null; scenarioRedesigned: string | null;
  origin: string; stage: string; validationNote: string | null; validatedAt: Date | null;
  validatedByName: string | null; decision: string | null; decisionNote: string | null;
  decidedByUserId: string | null; decidedByName: string | null; decidedAt: Date | null;
  createdAt: Date; updatedAt: Date;
  process?: { name: string } | null;
};
type ProcessRow = {
  id: string; name: string; area: string; unitId: string | null; aiThresholdPct: number;
  createdAt: Date; updatedAt: Date;
  tasks?: Array<{ aiPotential: number; scenario: string; risk: string; stage: string }>;
};
type SkillRow = { id: string; name: string; current: number; target: number; updatedAt: Date };
type PilotRow = {
  id: string; processId: string | null; kind: string; name: string; baseline: string; indicator: string;
  result: string; confidence: string; status: string; createdAt: Date; updatedAt: Date;
  process?: { name: string } | null;
};

/** Ordem de severidade para o "maior risco" de um processo. */
const RISK_RANK: Record<WorkRisk, number> = { BAIXO: 0, MEDIO: 1, ALTO: 2 };
const TASK_INCLUDE = { process: { select: { name: true } } } as const;
const PROCESS_INCLUDE = { tasks: { select: { aiPotential: true, scenario: true, risk: true, stage: true } } } as const;

/**
 * Workforce Intelligence (módulo 'workforce') — UM serviço para os dois lados.
 * Todo método recebe o tenantId EXPLÍCITO: o portal passa o da sessão; o Super
 * Admin (Módulos › Workforce Intelligence) passa o organizationId resolvido de
 * Tenant.id e escreve pelos MESMOS métodos, sempre sob forTenant (RLS ativa
 * mesmo vindo do control plane).
 *
 * Regras que vivem aqui (e não na tela):
 *  - cobertura de IA por processo = % de tarefas com aiPotential ≥ limiar DO
 *    PROCESSO (aiThresholdPct, editável) — nunca um limiar fixo no código;
 *  - os percentuais são julgamentos informados: nenhum motor de pontuação nem
 *    IA é consultado para preencher ou "corrigir" potencial/prontidão;
 *  - a validação CRIVO só acontece sobre tarefas EM_VALIDACAO_CRIVO, exige nota
 *    e é auditada (workforce.task.validate);
 *  - a decisão do cliente só acontece sobre tarefas já validadas (ou
 *    re-decisão de tarefa DECIDIDA), grava quem/quando na linha e audita
 *    (workforce.task.decision); DEVOLVER manda a tarefa de volta à fila CRIVO;
 *  - o código T-NN é sequencial por empresa e nunca reaproveita número.
 */
@Injectable()
export class WorkforceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Visão geral ──────────────────────────────────────────────────────

  async summary(tenantId: string): Promise<WorkforceSummary> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [processes, tasks, skills, pilots] = await Promise.all([
        tx.workProcess.count(),
        tx.workTask.findMany({ select: { stage: true, risk: true, scenario: true, decision: true, area: true } }),
        tx.workSkill.count(),
        tx.workPilot.findMany({ select: { status: true, kind: true } }),
      ]);
      const byStage = zero(WORK_TASK_STAGES) as Record<WorkTaskStage, number>;
      const byRisk = zero(WORK_RISKS) as Record<WorkRisk, number>;
      const byScenario = zero(WORKFORCE_SCENARIOS) as Record<WorkforceScenario, number>;
      const byDecision = zero(WORK_DECISIONS) as Record<WorkDecision, number>;
      const areas = new Set<string>();
      for (const t of tasks) {
        byStage[t.stage as WorkTaskStage] += 1;
        byRisk[t.risk as WorkRisk] += 1;
        byScenario[t.scenario as WorkforceScenario] += 1;
        if (t.decision) byDecision[t.decision as WorkDecision] += 1;
        areas.add(t.area);
      }
      return {
        processes,
        tasks: tasks.length,
        skills,
        pilots: {
          total: pilots.length,
          inProgress: pilots.filter((p) => p.status === 'EM_ANDAMENTO').length,
          concluded: pilots.filter((p) => p.status === 'CONCLUIDO').length,
          blueprints: pilots.filter((p) => p.kind === 'BLUEPRINT').length,
        },
        byStage,
        byRisk,
        byScenario,
        byDecision,
        areas: [...areas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      };
    });
  }

  // ── Processos ────────────────────────────────────────────────────────

  async listProcesses(tenantId: string): Promise<WorkProcessData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.workProcess.findMany({ orderBy: [{ area: 'asc' }, { name: 'asc' }], include: PROCESS_INCLUDE });
      return rows.map((r) => this.toProcess(r));
    });
  }

  async createProcess(tenantId: string, dto: UpsertWorkProcessRequest): Promise<WorkProcessData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.workProcess.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          area: dto.area.trim(),
          unitId: dto.unitId ?? null,
          // Sem valor informado fica o default do CAMPO (schema) — não um número solto aqui.
          ...(dto.aiThresholdPct !== undefined ? { aiThresholdPct: dto.aiThresholdPct } : {}),
        },
        include: PROCESS_INCLUDE,
      });
      return this.toProcess(row);
    });
  }

  async updateProcess(tenantId: string, id: string, dto: UpsertWorkProcessRequest): Promise<WorkProcessData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workProcess.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Processo não encontrado.');
      const row = await tx.workProcess.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          area: dto.area.trim(),
          unitId: dto.unitId === undefined ? existing.unitId : dto.unitId,
          aiThresholdPct: dto.aiThresholdPct ?? existing.aiThresholdPct,
        },
        include: PROCESS_INCLUDE,
      });
      return this.toProcess(row);
    });
  }

  async deleteProcess(tenantId: string, id: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workProcess.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Processo não encontrado.');
      await tx.workProcess.delete({ where: { id } });
      return { ok: true } as const;
    });
  }

  /** Processo + suas tarefas (linhas do "Detalhamento por processo" / CSV). */
  async processDetail(tenantId: string, id: string): Promise<WorkProcessDetail> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.workProcess.findUnique({ where: { id }, include: PROCESS_INCLUDE });
      if (!row) throw new NotFoundException('Processo não encontrado.');
      const tasks = await tx.workTask.findMany({ where: { processId: id }, orderBy: { code: 'asc' }, include: TASK_INCLUDE });
      return { process: this.toProcess(row), tasks: tasks.map((t) => this.toTask(t)) };
    });
  }

  // ── Tarefas ──────────────────────────────────────────────────────────

  async listTasks(tenantId: string, filters: WorkTaskFilters = {}): Promise<WorkTaskData[]> {
    const where: Record<string, unknown> = {};
    if (filters.area) where.area = filters.area;
    if (filters.processId) where.processId = filters.processId;
    if (filters.risk && (WORK_RISKS as readonly string[]).includes(filters.risk)) where.risk = filters.risk;
    if (filters.stage && (WORK_TASK_STAGES as readonly string[]).includes(filters.stage)) where.stage = filters.stage;
    if (filters.scenario && (WORKFORCE_SCENARIOS as readonly string[]).includes(filters.scenario)) where.scenario = filters.scenario;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.workTask.findMany({ where, orderBy: { code: 'asc' }, include: TASK_INCLUDE });
      return rows.map((r) => this.toTask(r));
    });
  }

  async getTask(tenantId: string, id: string): Promise<WorkTaskData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.workTask.findUnique({ where: { id }, include: TASK_INCLUDE });
      if (!row) throw new NotFoundException('Tarefa não encontrada.');
      return this.toTask(row);
    });
  }

  async createTask(tenantId: string, dto: UpsertWorkTaskRequest): Promise<WorkTaskData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const process = await tx.workProcess.findUnique({ where: { id: dto.processId }, select: { id: true } });
      if (!process) throw new NotFoundException('Processo não encontrado.');
      const code = await this.nextCode(tx);
      const row = await tx.workTask.create({
        data: {
          tenantId,
          code,
          ...this.taskFields(dto),
          stage: dto.stage ?? 'RASCUNHO',
        },
        include: TASK_INCLUDE,
      });
      return this.toTask(row);
    });
  }

  async updateTask(tenantId: string, id: string, dto: UpsertWorkTaskRequest): Promise<WorkTaskData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workTask.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Tarefa não encontrada.');
      if (dto.processId !== existing.processId) {
        const process = await tx.workProcess.findUnique({ where: { id: dto.processId }, select: { id: true } });
        if (!process) throw new NotFoundException('Processo não encontrado.');
      }
      // Estágio pós-validação (VALIDADO_CRIVO/DECIDIDO) só muda por validação ou
      // decisão — a edição preserva. RASCUNHO ↔ EM_VALIDACAO_CRIVO pode ir e voltar.
      const editable = existing.stage === 'RASCUNHO' || existing.stage === 'EM_VALIDACAO_CRIVO';
      const row = await tx.workTask.update({
        where: { id },
        data: {
          ...this.taskFields(dto),
          stage: editable ? dto.stage ?? existing.stage : existing.stage,
        },
        include: TASK_INCLUDE,
      });
      return this.toTask(row);
    });
  }

  async deleteTask(tenantId: string, id: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workTask.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Tarefa não encontrada.');
      await tx.workTask.delete({ where: { id } });
      return { ok: true } as const;
    });
  }

  /**
   * Validação CRIVO (Super Admin). Só tarefas EM_VALIDACAO_CRIVO; nota
   * obrigatória (o DTO valida o formato; aqui vale a REGRA: vazio não valida).
   * VALIDADO → VALIDADO_CRIVO (limpa decisão anterior: nova rodada de decisão);
   * DEVOLVIDO → volta a RASCUNHO com a nota para quem cadastrou.
   */
  async validateTask(tenantId: string, id: string, dto: ValidateWorkTaskRequest, actor: WorkforceActor): Promise<WorkTaskData> {
    const note = (dto.note ?? '').trim();
    if (!note) throw new BadRequestException('A validação CRIVO exige uma nota — ela fica na tarefa e na auditoria.');
    const result = dto.result ?? 'VALIDADO';

    const out = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workTask.findUnique({ where: { id }, select: { id: true, code: true, name: true, stage: true } });
      if (!existing) throw new NotFoundException('Tarefa não encontrada.');
      if (existing.stage !== 'EM_VALIDACAO_CRIVO') {
        throw new BadRequestException('Só tarefas na fila "Validação CRIVO" podem ser validadas ou devolvidas.');
      }
      const validated = result === 'VALIDADO';
      const row = await tx.workTask.update({
        where: { id },
        data: {
          stage: validated ? 'VALIDADO_CRIVO' : 'RASCUNHO',
          validationNote: note,
          validatedAt: validated ? new Date() : null,
          validatedByName: validated ? actor.name || actor.email : null,
          ...(validated ? { decision: null, decisionNote: null, decidedByUserId: null, decidedByName: null, decidedAt: null } : {}),
        },
        include: TASK_INCLUDE,
      });
      return { existing, row };
    });

    await this.audit.record({
      action: 'workforce.task.validate',
      actor: { id: actor.id, email: actor.email },
      target: out.existing.code,
      tenantId,
      meta: { taskId: id, code: out.existing.code, name: out.existing.name, result, from: out.existing.stage, to: out.row.stage, note },
    });
    return this.toTask(out.row);
  }

  /**
   * Decisão humana do cliente. Só sobre tarefa já VALIDADO_CRIVO (ou nova
   * decisão sobre uma DECIDIDA). Grava decisão + quem/quando na linha, muda o
   * estágio conforme WORK_DECISION_TO_STAGE e audita com o ator.
   */
  async decideTask(tenantId: string, id: string, dto: DecideWorkTaskRequest, actor: WorkforceActor): Promise<WorkTaskData> {
    const stage = WORK_DECISION_TO_STAGE[dto.decision];
    if (!stage) throw new BadRequestException('Decisão inválida.');
    const note = (dto.note ?? '').trim() || null;

    const out = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workTask.findUnique({ where: { id }, select: { id: true, code: true, name: true, stage: true, decision: true } });
      if (!existing) throw new NotFoundException('Tarefa não encontrada.');
      if (existing.stage !== 'VALIDADO_CRIVO' && existing.stage !== 'DECIDIDO') {
        throw new BadRequestException('A decisão só é registrada sobre tarefas já validadas pela CRIVO.');
      }
      const row = await tx.workTask.update({
        where: { id },
        data: {
          stage,
          decision: dto.decision,
          decisionNote: note,
          decidedByUserId: actor.id,
          decidedByName: actor.name || actor.email,
          decidedAt: new Date(),
        },
        include: TASK_INCLUDE,
      });
      return { existing, row };
    });

    await this.audit.record({
      action: 'workforce.task.decision',
      actor: { id: actor.id, email: actor.email },
      target: out.existing.code,
      tenantId,
      meta: {
        taskId: id,
        code: out.existing.code,
        name: out.existing.name,
        decision: dto.decision,
        previousDecision: out.existing.decision,
        from: out.existing.stage,
        to: stage,
        note,
      },
    });
    return this.toTask(out.row);
  }

  // ── Skills ───────────────────────────────────────────────────────────

  async listSkills(tenantId: string): Promise<WorkSkillData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.workSkill.findMany({ orderBy: { name: 'asc' } });
      return rows.map((r) => this.toSkill(r));
    });
  }

  /** Substitui o conjunto: upsert por nome (único por empresa) e remove quem não veio. */
  async saveSkills(tenantId: string, dto: SaveWorkSkillsRequest): Promise<WorkSkillData[]> {
    const seen = new Set<string>();
    const items = (dto.skills ?? []).map((s) => ({ name: s.name.trim(), current: s.current, target: s.target })).filter((s) => {
      if (!s.name || seen.has(s.name.toLowerCase())) return false;
      seen.add(s.name.toLowerCase());
      return true;
    });
    return this.prisma.forTenant(tenantId, async (tx) => {
      const names = items.map((s) => s.name);
      await tx.workSkill.deleteMany({ where: { name: { notIn: names } } });
      for (const s of items) {
        await tx.workSkill.upsert({
          where: { tenantId_name: { tenantId, name: s.name } },
          create: { tenantId, ...s },
          update: { current: s.current, target: s.target },
        });
      }
      const rows = await tx.workSkill.findMany({ orderBy: { name: 'asc' } });
      return rows.map((r) => this.toSkill(r));
    });
  }

  // ── Pilotos e blueprints ─────────────────────────────────────────────

  async listPilots(tenantId: string): Promise<WorkPilotData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.workPilot.findMany({ orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], include: TASK_INCLUDE });
      return rows.map((r) => this.toPilot(r));
    });
  }

  async createPilot(tenantId: string, dto: UpsertWorkPilotRequest): Promise<WorkPilotData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (dto.processId) {
        const p = await tx.workProcess.findUnique({ where: { id: dto.processId }, select: { id: true } });
        if (!p) throw new NotFoundException('Processo não encontrado.');
      }
      const row = await tx.workPilot.create({
        data: {
          tenantId,
          processId: dto.processId ?? null,
          kind: dto.kind,
          name: dto.name.trim(),
          baseline: dto.baseline.trim(),
          indicator: dto.indicator.trim(),
          result: dto.result?.trim() ?? '',
          confidence: dto.confidence,
          status: dto.status ?? 'EM_ANDAMENTO',
        },
        include: TASK_INCLUDE,
      });
      return this.toPilot(row);
    });
  }

  async updatePilot(tenantId: string, id: string, dto: UpdateWorkPilotRequest): Promise<WorkPilotData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workPilot.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Piloto não encontrado.');
      if (dto.processId) {
        const p = await tx.workProcess.findUnique({ where: { id: dto.processId }, select: { id: true } });
        if (!p) throw new NotFoundException('Processo não encontrado.');
      }
      const row = await tx.workPilot.update({
        where: { id },
        data: {
          processId: dto.processId === undefined ? existing.processId : dto.processId,
          kind: dto.kind ?? existing.kind,
          name: dto.name === undefined ? existing.name : dto.name.trim(),
          baseline: dto.baseline === undefined ? existing.baseline : dto.baseline.trim(),
          indicator: dto.indicator === undefined ? existing.indicator : dto.indicator.trim(),
          result: dto.result === undefined ? existing.result : dto.result.trim(),
          confidence: dto.confidence ?? existing.confidence,
          status: dto.status ?? existing.status,
        },
        include: TASK_INCLUDE,
      });
      return this.toPilot(row);
    });
  }

  async deletePilot(tenantId: string, id: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.workPilot.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Piloto não encontrado.');
      await tx.workPilot.delete({ where: { id } });
      return { ok: true } as const;
    });
  }

  // ── Internos ─────────────────────────────────────────────────────────

  /** Próximo "T-NN" da empresa: maior número já usado + 1 (nunca reaproveita). */
  private async nextCode(tx: PrismaClient): Promise<string> {
    const rows = await tx.workTask.findMany({ select: { code: true } });
    let max = 0;
    for (const r of rows) {
      const m = /^T-(\d+)$/.exec(r.code);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `T-${String(max + 1).padStart(2, '0')}`;
  }

  private taskFields(dto: UpsertWorkTaskRequest) {
    return {
      processId: dto.processId,
      role: dto.role.trim(),
      area: dto.area.trim(),
      name: dto.name.trim(),
      input: dto.input.trim(),
      output: dto.output.trim(),
      volumePerMonth: dto.volumePerMonth,
      durationMin: dto.durationMin,
      criticality: dto.criticality,
      aiPotential: dto.aiPotential,
      humanEssentiality: dto.humanEssentiality,
      risk: dto.risk,
      readiness: dto.readiness,
      scenario: dto.scenario,
      scenarioCurrent: dto.scenarioCurrent?.trim() || null,
      scenarioAssisted: dto.scenarioAssisted?.trim() || null,
      scenarioRedesigned: dto.scenarioRedesigned?.trim() || null,
      origin: dto.origin,
    };
  }

  private toProcess(r: ProcessRow): WorkProcessData {
    const tasks = r.tasks ?? [];
    const byStage = zero(WORK_TASK_STAGES) as Record<WorkTaskStage, number>;
    const byScenario = new Map<string, number>();
    let highest: WorkRisk | null = null;
    let covered = 0;
    for (const t of tasks) {
      byStage[t.stage as WorkTaskStage] += 1;
      byScenario.set(t.scenario, (byScenario.get(t.scenario) ?? 0) + 1);
      const risk = t.risk as WorkRisk;
      if (!highest || RISK_RANK[risk] > RISK_RANK[highest]) highest = risk;
      // Cobertura = tarefas com potencial ≥ limiar DO PROCESSO (não hardcode).
      if (t.aiPotential >= r.aiThresholdPct) covered += 1;
    }
    let dominant: WorkforceScenario | null = null;
    let dominantCount = 0;
    // Empate: vence a ordem da taxonomia (determinístico), não a ordem de inserção.
    for (const s of WORKFORCE_SCENARIOS) {
      const n = byScenario.get(s) ?? 0;
      if (n > dominantCount) { dominant = s; dominantCount = n; }
    }
    return {
      id: r.id,
      name: r.name,
      area: r.area,
      unitId: r.unitId,
      aiThresholdPct: r.aiThresholdPct,
      tasksCount: tasks.length,
      aiCoveragePct: tasks.length ? Math.round((covered / tasks.length) * 100) : null,
      dominantScenario: dominant,
      highestRisk: highest,
      byStage,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toTask(t: TaskRow): WorkTaskData {
    return {
      id: t.id,
      code: t.code,
      processId: t.processId,
      processName: t.process?.name ?? '',
      role: t.role,
      area: t.area,
      name: t.name,
      input: t.input,
      output: t.output,
      volumePerMonth: t.volumePerMonth,
      durationMin: t.durationMin,
      criticality: t.criticality as WorkTaskData['criticality'],
      aiPotential: t.aiPotential,
      humanEssentiality: t.humanEssentiality,
      risk: t.risk as WorkRisk,
      readiness: t.readiness,
      scenario: t.scenario as WorkforceScenario,
      scenarioCurrent: t.scenarioCurrent,
      scenarioAssisted: t.scenarioAssisted,
      scenarioRedesigned: t.scenarioRedesigned,
      origin: t.origin as WorkTaskData['origin'],
      stage: t.stage as WorkTaskStage,
      validationNote: t.validationNote,
      validatedAt: t.validatedAt?.toISOString() ?? null,
      validatedByName: t.validatedByName,
      decision: (t.decision as WorkDecision | null) ?? null,
      decisionNote: t.decisionNote,
      decidedByName: t.decidedByName,
      decidedAt: t.decidedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toSkill(s: SkillRow): WorkSkillData {
    return { id: s.id, name: s.name, current: s.current, target: s.target, updatedAt: s.updatedAt.toISOString() };
  }

  private toPilot(p: PilotRow): WorkPilotData {
    return {
      id: p.id,
      processId: p.processId,
      processName: p.process?.name ?? null,
      kind: p.kind as WorkPilotData['kind'],
      name: p.name,
      baseline: p.baseline,
      indicator: p.indicator,
      result: p.result,
      confidence: p.confidence as WorkPilotData['confidence'],
      status: p.status as WorkPilotData['status'],
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}

function zero(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}
