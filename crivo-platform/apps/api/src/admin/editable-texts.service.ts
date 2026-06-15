import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EditableTextData, UpsertEditableTextRequest } from '@crivo/types';

/** Textos editáveis pelo Super Admin sem deploy. Key-value versionado. */
@Injectable()
export class EditableTextsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string): Promise<EditableTextData[]> {
    const rows = await this.prisma.admin.editableText.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return rows.map(toData);
  }

  async getByKey(key: string): Promise<EditableTextData> {
    const row = await this.prisma.admin.editableText.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Texto "${key}" não encontrado.`);
    return toData(row);
  }

  /** Upsert por key — versiona automaticamente (incrementa em updates). */
  async upsert(dto: UpsertEditableTextRequest, updatedBy?: string): Promise<EditableTextData> {
    const existing = await this.prisma.admin.editableText.findUnique({ where: { key: dto.key } });
    if (existing) {
      const row = await this.prisma.admin.editableText.update({
        where: { key: dto.key },
        data: {
          content: dto.content,
          category: dto.category ?? existing.category,
          version: { increment: 1 },
          updatedBy: updatedBy ?? existing.updatedBy,
        },
      });
      return toData(row);
    }
    const row = await this.prisma.admin.editableText.create({
      data: {
        key: dto.key,
        content: dto.content,
        category: dto.category ?? 'geral',
        updatedBy: updatedBy ?? null,
      },
    });
    return toData(row);
  }

  async remove(key: string): Promise<{ ok: true }> {
    await this.prisma.admin.editableText.delete({ where: { key } });
    return { ok: true as const };
  }
}

function toData(row: any): EditableTextData {
  return {
    id: row.id,
    key: row.key,
    category: row.category,
    content: row.content,
    version: row.version,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
