import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  RESPONSIBILITY_NOTE,
  DOCUMENT_TYPE_LABEL,
  type GeneratedDocument,
  type ParecerData,
  type ParecerStatus,
  type UpsertParecerRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

type ParecerRow = {
  id: string; title: string; status: string; context: string | null; signals: string | null;
  hypotheses: string | null; priorities: string | null; recommendations: string | null;
  author: string | null; devolutivaAt: Date | null; publishedAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

/**
 * Parecer Consultivo CRIVO (Briefing §6) — camada HUMANA do diagnóstico. O
 * consultor redige sinais/hipóteses/prioridades/recomendações; vira documento
 * (PDF) só após publicação. Data plane (RLS por tenant) via forTenant.
 */
@Injectable()
export class ParecerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ParecerData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.parecer.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((r) => this.toData(r));
    });
  }

  async create(tenantId: string, dto: UpsertParecerRequest, author: string): Promise<ParecerData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.parecer.create({
        data: {
          tenantId,
          title: dto.title?.trim() || 'Parecer Consultivo CRIVO',
          context: dto.context ?? null,
          signals: dto.signals ?? null,
          hypotheses: dto.hypotheses ?? null,
          priorities: dto.priorities ?? null,
          recommendations: dto.recommendations ?? null,
          devolutivaAt: parseDate(dto.devolutivaAt),
          author,
        },
      });
      return this.toData(row);
    });
  }

  async update(tenantId: string, id: string, dto: UpsertParecerRequest): Promise<ParecerData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.parecer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Parecer não encontrado');
      const row = await tx.parecer.update({
        where: { id },
        data: {
          title: dto.title?.trim() || existing.title,
          context: dto.context === undefined ? existing.context : dto.context,
          signals: dto.signals === undefined ? existing.signals : dto.signals,
          hypotheses: dto.hypotheses === undefined ? existing.hypotheses : dto.hypotheses,
          priorities: dto.priorities === undefined ? existing.priorities : dto.priorities,
          recommendations:
            dto.recommendations === undefined ? existing.recommendations : dto.recommendations,
          devolutivaAt:
            dto.devolutivaAt === undefined ? existing.devolutivaAt : parseDate(dto.devolutivaAt),
        },
      });
      return this.toData(row);
    });
  }

  /** Publicação — sem ela o parecer é minuta; com ela libera o documento (PDF). */
  async publish(tenantId: string, id: string): Promise<ParecerData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.parecer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Parecer não encontrado');
      const row = await tx.parecer.update({
        where: { id },
        data: { status: 'PUBLICADO', publishedAt: existing.publishedAt ?? new Date() },
      });
      return this.toData(row);
    });
  }

  async remove(tenantId: string, id: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.parecer.delete({ where: { id } }).catch(() => {
        throw new NotFoundException('Parecer não encontrado');
      });
      return { ok: true } as const;
    });
  }

  /** Monta o documento estruturado de um parecer PUBLICADO (frase de responsabilidade incluída). */
  async generateDocument(tenantId: string, id: string): Promise<GeneratedDocument> {
    const row = await this.prisma.forTenant(tenantId, (tx) =>
      tx.parecer.findUnique({ where: { id } }),
    );
    if (!row) throw new NotFoundException('Parecer não encontrado');
    if (row.status !== 'PUBLICADO') {
      throw new BadRequestException('O parecer precisa ser publicado antes de gerar o documento.');
    }
    // rls-allow: organization é a raiz do tenant (control-plane); leitura self-scoped por id=tenantId da sessão, só o nome.
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId } });
    const company = org?.name ?? 'Empresa';

    const sections: GeneratedDocument['sections'] = [];
    const add = (heading: string, body: string | null) => {
      if (body && body.trim()) sections.push({ heading, body });
    };
    add('Contexto e leitura da empresa', row.context);
    add('Sinais observados', row.signals);
    add('Hipóteses de trabalho', row.hypotheses);
    add('Prioridades', row.priorities);
    add('Recomendações', row.recommendations);
    if (!sections.length) {
      sections.push({ heading: 'Parecer', body: 'Parecer publicado sem conteúdo textual.' });
    }

    return {
      type: 'parecer_consultivo',
      title: DOCUMENT_TYPE_LABEL.parecer_consultivo,
      subtitle: 'Leitura consultiva humana · CRIVO',
      company,
      generatedAt: new Date().toISOString(),
      meta: [
        { label: 'Empresa', value: company },
        { label: 'Consultor responsável', value: row.author ?? '—' },
        { label: 'Publicado em', value: row.publishedAt ? fmt(row.publishedAt) : '—' },
        { label: 'Devolutiva', value: row.devolutivaAt ? fmt(row.devolutivaAt) : 'A agendar' },
      ],
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  private toData(r: ParecerRow): ParecerData {
    return {
      id: r.id,
      title: r.title,
      status: r.status as ParecerStatus,
      context: r.context,
      signals: r.signals,
      hypotheses: r.hypotheses,
      priorities: r.priorities,
      recommendations: r.recommendations,
      author: r.author,
      devolutivaAt: r.devolutivaAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR');
}
