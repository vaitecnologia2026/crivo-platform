import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAudienceDto,
  CreateCategoryDto,
  CreateDecisionDto,
  ListDecisionsQueryDto,
  SubmitDecisionIcdDto,
  UpdateDecisionDto,
} from './dto';
import {
  DEFAULT_DECISION_CATEGORIES,
  DEFAULT_AFFECTED_AUDIENCES,
  computeDecisionIcd,
  type DecisionData,
  type DecisionCategory,
  type AffectedAudience,
  type DecisionIcdData,
  type IcdAxesScores,
  type IcdAxisAnswer,
} from '@crivo/types';

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante que o tenant tem as categorias/audiências padrão criadas (idempotente).
   *  Chamado em qualquer leitura — custo mínimo após a primeira execução. */
  private async ensureDefaults(tenantId: string, tx: any) {
    const catCount = await tx.decisionCategory.count({ where: { isDefault: true } });
    if (catCount === 0) {
      for (const [i, c] of DEFAULT_DECISION_CATEGORIES.entries()) {
        await tx.decisionCategory.create({
          data: {
            tenantId,
            name: c.name,
            slug: c.slug,
            isDefault: true,
            order: i,
          },
        });
      }
    }
    const audCount = await tx.affectedAudience.count();
    if (audCount === 0) {
      for (const [i, a] of DEFAULT_AFFECTED_AUDIENCES.entries()) {
        await tx.affectedAudience.create({
          data: { tenantId, name: a.name, slug: a.slug, order: i },
        });
      }
    }
  }

  /** Listagem de categorias ativas do tenant. */
  async listCategories(tenantId: string): Promise<DecisionCategory[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.ensureDefaults(tenantId, tx);
      const rows = await tx.decisionCategory.findMany({
        where: { active: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isDefault: r.isDefault,
        active: r.active,
        order: r.order,
      }));
    });
  }

  /** Listagem de audiências ativas do tenant. */
  async listAudiences(tenantId: string): Promise<AffectedAudience[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.ensureDefaults(tenantId, tx);
      const rows = await tx.affectedAudience.findMany({
        where: { active: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        active: r.active,
        order: r.order,
      }));
    });
  }

  /** Cria categoria custom (RH/GESTOR/CEO/ADMIN). Gera slug auto. */
  async createCategory(tenantId: string, dto: CreateCategoryDto): Promise<DecisionCategory> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const slug = slugify(dto.name);
      const exists = await tx.decisionCategory.findFirst({ where: { slug } });
      if (exists) throw new BadRequestException('Já existe uma categoria com esse nome.');
      const order = (await tx.decisionCategory.count()) + 1;
      const row = await tx.decisionCategory.create({
        data: { tenantId, name: dto.name, slug, isDefault: false, order },
      });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isDefault: row.isDefault,
        active: row.active,
        order: row.order,
      };
    });
  }

  async createAudience(tenantId: string, dto: CreateAudienceDto): Promise<AffectedAudience> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const slug = slugify(dto.name);
      const exists = await tx.affectedAudience.findFirst({ where: { slug } });
      if (exists) throw new BadRequestException('Já existe um público com esse nome.');
      const order = (await tx.affectedAudience.count()) + 1;
      const row = await tx.affectedAudience.create({
        data: { tenantId, name: dto.name, slug, order },
      });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active,
        order: row.order,
      };
    });
  }

  /** Lista decisões do tenant. mine=true → escopa ao líder logado.
   *  Sem mine, exige papel privilegiado (controller controla). */
  async list(
    tenantId: string,
    userId: string,
    query: ListDecisionsQueryDto,
    onlyMine: boolean,
  ): Promise<DecisionData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const where: any = {};
      if (onlyMine) where.leaderId = userId;
      if (query.status) where.status = query.status;
      if (query.impact) where.impact = query.impact;
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.from || query.to) {
        where.decidedAt = {};
        if (query.from) where.decidedAt.gte = new Date(query.from);
        if (query.to) where.decidedAt.lte = new Date(query.to);
      }
      const rows = await tx.decision.findMany({
        where,
        include: {
          category: true,
          audiences: { include: { audience: true } },
          sustentationAction: true,
        },
        orderBy: { decidedAt: 'desc' },
        take: query.limit ?? 50,
      });
      return rows.map((r: any) => toDecisionData(r));
    });
  }

  /** Detalhe de uma decisão. Líder só vê as suas; demais papéis veem do tenant. */
  async get(
    tenantId: string,
    userId: string,
    decisionId: string,
    isLeaderOnly: boolean,
  ): Promise<DecisionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.decision.findUnique({
        where: { id: decisionId },
        include: {
          category: true,
          audiences: { include: { audience: true } },
          sustentationAction: true,
        },
      });
      if (!row) throw new NotFoundException('Decisão não encontrada.');
      if (isLeaderOnly && row.leaderId !== userId) {
        throw new ForbiddenException('Você só pode visualizar suas próprias decisões.');
      }
      return toDecisionData(row as any);
    });
  }

  /** Cria uma decisão como rascunho (EM_REGISTRO). O líder é o usuário logado. */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateDecisionDto,
  ): Promise<DecisionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.ensureDefaults(tenantId, tx);

      // Valida categoria + audiências (todas devem pertencer ao tenant — RLS já garante).
      if (dto.categoryId) {
        const cat = await tx.decisionCategory.findUnique({ where: { id: dto.categoryId } });
        if (!cat) throw new BadRequestException('Categoria inválida.');
      }
      if (dto.audienceIds.length > 0) {
        const count = await tx.affectedAudience.count({ where: { id: { in: dto.audienceIds } } });
        if (count !== dto.audienceIds.length) {
          throw new BadRequestException('Algum público informado é inválido.');
        }
      }

      const decision = await tx.decision.create({
        data: {
          tenantId,
          leaderId: userId,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId ?? null,
          impact: dto.impact,
          type: dto.type,
          pocketUse: dto.pocketUse,
          pressureFactor: dto.pressureFactor,
          revisionPeriod: dto.revisionPeriod,
          status: 'REGISTRADA',
          decidedAt: new Date(dto.decidedAt),
        },
      });

      for (const audienceId of dto.audienceIds) {
        await tx.decisionAudience.create({
          data: { decisionId: decision.id, audienceId },
        });
      }

      if (dto.sustentationAction) {
        await tx.sustentationAction.create({
          data: {
            tenantId,
            decisionId: decision.id,
            action: dto.sustentationAction.action,
            responsible: dto.sustentationAction.responsible,
            deadline: new Date(dto.sustentationAction.deadline),
            expectedResult: dto.sustentationAction.expectedResult ?? null,
            evidenceUrl: dto.sustentationAction.evidenceUrl ?? null,
          },
        });
      }

      const full = await tx.decision.findUnique({
        where: { id: decision.id },
        include: {
          category: true,
          audiences: { include: { audience: true } },
          sustentationAction: true,
        },
      });
      return toDecisionData(full as any);
    });
  }

  /** Atualiza decisão. Só o líder dono pode editar enquanto EM_REGISTRO/REGISTRADA;
   *  uma vez AVALIADA_PELO_ICD, mudanças são bloqueadas pelo service. */
  async update(
    tenantId: string,
    userId: string,
    decisionId: string,
    dto: UpdateDecisionDto,
  ): Promise<DecisionData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.decision.findUnique({ where: { id: decisionId } });
      if (!existing) throw new NotFoundException('Decisão não encontrada.');
      if (existing.leaderId !== userId) {
        throw new ForbiddenException('Apenas o líder dono da decisão pode editá-la.');
      }
      if (existing.status === 'AVALIADA_PELO_ICD') {
        throw new BadRequestException(
          'Decisão já avaliada pelo ICD — não pode ser editada.',
        );
      }

      await tx.decision.update({
        where: { id: decisionId },
        data: {
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId ?? null,
          impact: dto.impact,
          type: dto.type,
          pocketUse: dto.pocketUse,
          pressureFactor: dto.pressureFactor,
          revisionPeriod: dto.revisionPeriod,
          status: dto.status ?? existing.status,
          decidedAt: new Date(dto.decidedAt),
        },
      });

      // Reset M:N de audiências.
      await tx.decisionAudience.deleteMany({ where: { decisionId } });
      for (const audienceId of dto.audienceIds) {
        await tx.decisionAudience.create({ data: { decisionId, audienceId } });
      }

      // Upsert da ação de sustentação (1:1).
      if (dto.sustentationAction) {
        await tx.sustentationAction.upsert({
          where: { decisionId },
          create: {
            tenantId,
            decisionId,
            action: dto.sustentationAction.action,
            responsible: dto.sustentationAction.responsible,
            deadline: new Date(dto.sustentationAction.deadline),
            expectedResult: dto.sustentationAction.expectedResult ?? null,
            evidenceUrl: dto.sustentationAction.evidenceUrl ?? null,
          },
          update: {
            action: dto.sustentationAction.action,
            responsible: dto.sustentationAction.responsible,
            deadline: new Date(dto.sustentationAction.deadline),
            expectedResult: dto.sustentationAction.expectedResult ?? null,
            evidenceUrl: dto.sustentationAction.evidenceUrl ?? null,
          },
        });
      } else {
        await tx.sustentationAction.deleteMany({ where: { decisionId } });
      }

      const full = await tx.decision.findUnique({
        where: { id: decisionId },
        include: {
          category: true,
          audiences: { include: { audience: true } },
          sustentationAction: true,
        },
      });
      return toDecisionData(full as any);
    });
  }

  async remove(tenantId: string, userId: string, decisionId: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.decision.findUnique({ where: { id: decisionId } });
      if (!existing) throw new NotFoundException('Decisão não encontrada.');
      if (existing.leaderId !== userId) {
        throw new ForbiddenException('Apenas o líder dono pode remover a decisão.');
      }
      if (existing.status === 'AVALIADA_PELO_ICD') {
        throw new BadRequestException(
          'Decisão já avaliada pelo ICD — exclusão bloqueada (auditoria).',
        );
      }
      await tx.decision.delete({ where: { id: decisionId } });
      return { ok: true as const };
    });
  }

  // ── ICD da decisão (Anexo §6–§9) ──────────────────────────────────────

  /** Submete as 8 respostas P1-P8 para uma decisão registrada. Calcula scores
   *  por eixo e ICD total (§9.1, §9.2), persiste em decision_icd_scores e
   *  marca a decisão como AVALIADA_PELO_ICD. Upsert: se já existir, recalcula. */
  async submitIcd(
    tenantId: string,
    userId: string,
    decisionId: string,
    dto: SubmitDecisionIcdDto,
  ): Promise<DecisionIcdData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const decision = await tx.decision.findUnique({ where: { id: decisionId } });
      if (!decision) throw new NotFoundException('Decisão não encontrada.');
      if (decision.leaderId !== userId) {
        throw new ForbiddenException('Apenas o líder dono pode avaliar a decisão.');
      }

      let result;
      try {
        result = computeDecisionIcd(dto.answers as IcdAxisAnswer[], decision.impact);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Respostas inválidas (§7/§8).',
        );
      }

      // Anexo §9.4: vincula ao ciclo trimestral aberto cuja janela contém
      // `decidedAt` da decisão. Se nenhum cobrir, cycleId fica null e o
      // fechamento ignora — pode ser religado depois pela criação de ciclo.
      const openCycle = await tx.icdCycle.findFirst({
        where: {
          status: 'OPEN',
          startsAt: { lte: decision.decidedAt },
          endsAt: { gte: decision.decidedAt },
        },
      });

      const persisted = await tx.decisionIcdScore.upsert({
        where: { decisionId },
        create: {
          tenantId,
          decisionId,
          leaderId: decision.leaderId,
          cycleId: openCycle?.id ?? null,
          score: result.score,
          axes: result.axes as unknown as object,
          answers: result.answers as unknown as object,
          weight: result.weight,
        },
        update: {
          cycleId: openCycle?.id ?? null,
          score: result.score,
          axes: result.axes as unknown as object,
          answers: result.answers as unknown as object,
          weight: result.weight,
          computedAt: new Date(),
        },
      });

      await tx.decision.update({
        where: { id: decisionId },
        data: { status: 'AVALIADA_PELO_ICD' },
      });

      return toIcdData(persisted);
    });
  }

  /** Lê o ICD persistido de uma decisão. Líder vê só o próprio. */
  async getIcd(
    tenantId: string,
    userId: string,
    decisionId: string,
  ): Promise<DecisionIcdData | null> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const decision = await tx.decision.findUnique({
        where: { id: decisionId },
        select: { leaderId: true },
      });
      if (!decision) throw new NotFoundException('Decisão não encontrada.');
      if (decision.leaderId !== userId) {
        throw new ForbiddenException('Você só pode visualizar o ICD das suas decisões.');
      }
      const row = await tx.decisionIcdScore.findUnique({ where: { decisionId } });
      return row ? toIcdData(row) : null;
    });
  }
}

function toIcdData(row: any): DecisionIcdData {
  return {
    id: row.id,
    decisionId: row.decisionId,
    leaderId: row.leaderId,
    score: row.score,
    axes: row.axes as IcdAxesScores,
    answers: row.answers as IcdAxisAnswer[],
    weight: row.weight,
    computedAt: row.computedAt.toISOString(),
  };
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toDecisionData(row: any): DecisionData {
  return {
    id: row.id,
    leaderId: row.leaderId,
    title: row.title,
    description: row.description,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          slug: row.category.slug,
          isDefault: row.category.isDefault,
          active: row.category.active,
          order: row.category.order,
        }
      : null,
    impact: row.impact,
    type: row.type,
    pocketUse: row.pocketUse,
    pressureFactor: row.pressureFactor,
    revisionPeriod: row.revisionPeriod,
    status: row.status,
    decidedAt: row.decidedAt.toISOString(),
    audiences: row.audiences.map((a: any) => ({
      id: a.audience.id,
      name: a.audience.name,
      slug: a.audience.slug,
      active: a.audience.active,
      order: a.audience.order,
    })),
    sustentationAction: row.sustentationAction
      ? {
          id: row.sustentationAction.id,
          action: row.sustentationAction.action,
          responsible: row.sustentationAction.responsible,
          deadline: row.sustentationAction.deadline.toISOString(),
          expectedResult: row.sustentationAction.expectedResult,
          evidenceUrl: row.sustentationAction.evidenceUrl,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
