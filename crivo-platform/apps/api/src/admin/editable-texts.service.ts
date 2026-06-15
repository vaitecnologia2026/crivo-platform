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

  /** #60 — Resolve uma chave em texto com fallback. Cache em memória (60s) para
   *  evitar hit no banco em e-mails de alto volume. Substitui placeholders
   *  `{nome}` por valores passados em `replacements`. */
  async render(key: string, fallback: string, replacements?: Record<string, string>): Promise<string> {
    const cached = this.getCache(key);
    let content = cached ?? fallback;
    if (cached === undefined) {
      try {
        const row = await this.prisma.admin.editableText.findUnique({ where: { key } });
        content = row?.content ?? fallback;
        this.setCache(key, content);
      } catch {
        /* falha de DB não derruba o serviço — usa fallback */
      }
    }
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        content = content.replaceAll(`{${k}}`, v);
      }
    }
    return content;
  }

  // ── Cache em memória (TTL 60s). Boundary por instância NestJS. ──
  private cache = new Map<string, { v: string; expires: number }>();
  private getCache(key: string): string | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) { this.cache.delete(key); return undefined; }
    return hit.v;
  }
  private setCache(key: string, value: string) {
    this.cache.set(key, { v: value, expires: Date.now() + 60_000 });
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
