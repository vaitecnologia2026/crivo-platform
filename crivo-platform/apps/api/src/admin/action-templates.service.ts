import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActionTemplateData, UpsertActionTemplateRequest } from '@crivo/types';

/** Biblioteca de Ações modelo (catálogo global). Control plane. */
@Injectable()
export class ActionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string): Promise<ActionTemplateData[]> {
    const rows = await this.prisma.admin.actionTemplate.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return rows.map(toData);
  }

  async getById(id: string): Promise<ActionTemplateData> {
    const row = await this.prisma.admin.actionTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Ação modelo não encontrada.');
    return toData(row);
  }

  async create(dto: UpsertActionTemplateRequest): Promise<ActionTemplateData> {
    const row = await this.prisma.admin.actionTemplate.create({
      data: {
        title: dto.title,
        category: dto.category,
        description: dto.description ?? null,
        suggestedResponsible: dto.suggestedResponsible ?? null,
        expectedEvidence: dto.expectedEvidence ?? null,
        defaultReviewDays: dto.defaultReviewDays ?? 30,
        active: dto.active ?? true,
      },
    });
    return toData(row);
  }

  async update(id: string, dto: UpsertActionTemplateRequest): Promise<ActionTemplateData> {
    const existing = await this.prisma.admin.actionTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ação modelo não encontrada.');
    const row = await this.prisma.admin.actionTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        description: dto.description ?? null,
        suggestedResponsible: dto.suggestedResponsible ?? null,
        expectedEvidence: dto.expectedEvidence ?? null,
        defaultReviewDays: dto.defaultReviewDays ?? existing.defaultReviewDays,
        active: dto.active ?? existing.active,
      },
    });
    return toData(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.admin.actionTemplate.delete({ where: { id } });
    return { ok: true as const };
  }
}

function toData(row: any): ActionTemplateData {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    suggestedResponsible: row.suggestedResponsible,
    expectedEvidence: row.expectedEvidence,
    defaultReviewDays: row.defaultReviewDays,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
