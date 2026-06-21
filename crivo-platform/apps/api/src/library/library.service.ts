import { Injectable, NotFoundException } from '@nestjs/common';
import type { LibraryItem } from '@crivo/db';
import type {
  CreateLibraryItemRequest,
  LibraryItemData,
  LibraryKind,
  UpdateLibraryItemRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

function toData(i: LibraryItem): LibraryItemData {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    kind: i.kind as LibraryKind,
    url: i.url,
    createdAt: i.createdAt.toISOString(),
  };
}

/** Acervo de conteúdo (Biblioteca & Formação) escopado por tenant (RLS). */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<LibraryItemData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.libraryItem.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map(toData);
    });
  }

  create(tenantId: string, dto: CreateLibraryItemRequest): Promise<LibraryItemData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const item = await tx.libraryItem.create({
        data: {
          tenantId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          kind: dto.kind,
          url: dto.url?.trim() || null,
        },
      });
      return toData(item);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateLibraryItemRequest): Promise<LibraryItemData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.libraryItem.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Item não encontrado');
      const item = await tx.libraryItem.update({
        where: { id },
        data: {
          title: dto.title?.trim() ?? existing.title,
          description: dto.description === undefined ? existing.description : dto.description?.trim() || null,
          kind: dto.kind ?? existing.kind,
          url: dto.url === undefined ? existing.url : dto.url?.trim() || null,
        },
      });
      return toData(item);
    });
  }

  async remove(tenantId: string, id: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.libraryItem.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Item não encontrado');
      await tx.libraryItem.delete({ where: { id } });
      return { ok: true as const };
    });
  }

  /** #62 — Importa um GlobalAcademyContent (catálogo global Super Admin) para
   *  a biblioteca do tenant. Idempotente: se a URL já estiver na biblioteca,
   *  devolve o existente em vez de duplicar. */
  async importFromGlobal(tenantId: string, contentId: string): Promise<LibraryItemData> {
    // rls-allow: globalAcademyContent é catálogo GLOBAL do super admin (control-plane).
    const content = await this.prisma.admin.globalAcademyContent.findUnique({
      where: { id: contentId },
    });
    if (!content) throw new NotFoundException('Conteúdo não encontrado.');
    if (!content.published) {
      throw new NotFoundException('Este conteúdo não está publicado pelo Super Admin.');
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      // Dedup leve: se já existe item com a mesma url, devolve.
      if (content.url) {
        const existing = await tx.libraryItem.findFirst({ where: { url: content.url } });
        if (existing) return toData(existing);
      }
      const item = await tx.libraryItem.create({
        data: {
          tenantId,
          title: content.title,
          description: content.description,
          kind: content.kind,
          url: content.url,
        },
      });
      return toData(item);
    });
  }
}
