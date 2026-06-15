import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GlobalAcademyContentData,
  UpsertGlobalAcademyContentRequest,
} from '@crivo/types';

/** Academia CRIVO global (catálogo curado pelo Super Admin). Control plane. */
@Injectable()
export class GlobalAcademyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts?: { kind?: string; publishedOnly?: boolean }): Promise<GlobalAcademyContentData[]> {
    const rows = await this.prisma.admin.globalAcademyContent.findMany({
      where: {
        ...(opts?.kind ? { kind: opts.kind } : {}),
        ...(opts?.publishedOnly ? { published: true } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toData);
  }

  async getById(id: string): Promise<GlobalAcademyContentData> {
    const row = await this.prisma.admin.globalAcademyContent.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conteúdo não encontrado.');
    return toData(row);
  }

  async create(dto: UpsertGlobalAcademyContentRequest): Promise<GlobalAcademyContentData> {
    const row = await this.prisma.admin.globalAcademyContent.create({
      data: {
        title: dto.title,
        kind: dto.kind,
        description: dto.description ?? null,
        url: dto.url ?? null,
        category: dto.category ?? null,
        tags: dto.tags ?? [],
        published: dto.published ?? false,
      },
    });
    return toData(row);
  }

  async update(id: string, dto: UpsertGlobalAcademyContentRequest): Promise<GlobalAcademyContentData> {
    const existing = await this.prisma.admin.globalAcademyContent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Conteúdo não encontrado.');
    const row = await this.prisma.admin.globalAcademyContent.update({
      where: { id },
      data: {
        title: dto.title,
        kind: dto.kind,
        description: dto.description ?? null,
        url: dto.url ?? null,
        category: dto.category ?? null,
        tags: dto.tags ?? [],
        published: dto.published ?? existing.published,
      },
    });
    return toData(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.admin.globalAcademyContent.delete({ where: { id } });
    return { ok: true as const };
  }
}

function toData(row: any): GlobalAcademyContentData {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    url: row.url,
    category: row.category,
    tags: row.tags ?? [],
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
