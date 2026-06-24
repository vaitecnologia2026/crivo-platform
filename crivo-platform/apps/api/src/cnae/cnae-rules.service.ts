import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCnaeDivisionDto } from './cnae.dto';

/** CRUD das regras de divisão CNAE (admin) + leitura/anotação do histórico. */
@Injectable()
export class CnaeRulesService {
  constructor(private readonly prisma: PrismaService) {}

  listDivisions(filters: { risk?: string; method?: string; q?: string; active?: string } = {}) {
    const where: Prisma.CnaeDivisionRuleWhereInput = {};
    if (filters.risk) where.preliminaryRiskLevel = filters.risk as Prisma.CnaeDivisionRuleWhereInput['preliminaryRiskLevel'];
    if (filters.method) where.defaultMethod = filters.method as Prisma.CnaeDivisionRuleWhereInput['defaultMethod'];
    if (filters.active === 'true') where.isActive = true;
    if (filters.active === 'false') where.isActive = false;
    if (filters.q) {
      where.OR = [
        { divisionCode: { contains: filters.q } },
        { officialName: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.admin.cnaeDivisionRule.findMany({ where, orderBy: { divisionCode: 'asc' } });
  }

  async getDivision(code: string) {
    const rule = await this.prisma.admin.cnaeDivisionRule.findUnique({ where: { divisionCode: code } });
    if (!rule) throw new NotFoundException('Divisão CNAE não encontrada');
    return rule;
  }

  async updateDivision(id: string, dto: UpdateCnaeDivisionDto) {
    const exists = await this.prisma.admin.cnaeDivisionRule.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Regra de divisão CNAE não encontrada');
    const { organizationalTriggerRules, ...rest } = dto;
    return this.prisma.admin.cnaeDivisionRule.update({
      where: { id },
      data: {
        ...rest,
        ...(organizationalTriggerRules !== undefined
          ? { organizationalTriggerRules: organizationalTriggerRules as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  listHistory(limit = 100) {
    return this.prisma.admin.cnaeDecisionHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  async markReviewed(id: string, actor: { email?: string }, notes?: string) {
    const exists = await this.prisma.admin.cnaeDecisionHistory.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Registro de histórico não encontrado');
    return this.prisma.admin.cnaeDecisionHistory.update({
      where: { id },
      data: { reviewedBy: actor.email ?? null, reviewedAt: new Date(), reviewNotes: notes ?? null },
    });
  }
}
