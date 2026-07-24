import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

export type ReportTemplateSection = { heading: string; body: string };
export type UpsertReportTemplate = {
  key?: string;
  name: string;
  description?: string | null;
  instrumentSlug: string;
  sections?: ReportTemplateSection[];
  includeResults?: boolean;
  includeDimensions?: boolean;
  includePlan?: boolean;
  active?: boolean;
};

/** Normaliza para kebab-case seguro (usado como tipo do documento na API). */
function toKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Sanitiza as seções de texto vindas do formulário. */
function cleanSections(raw: unknown): ReportTemplateSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      heading: String((s as ReportTemplateSection)?.heading ?? '').trim().slice(0, 160),
      body: String((s as ReportTemplateSection)?.body ?? '').trim().slice(0, 8000),
    }))
    .filter((s) => s.heading || s.body)
    .slice(0, 20);
}

/**
 * Motor 4 — Relatórios e Dossiês (R-001), lado control-plane. Repositório
 * cross-tenant das EMISSÕES congeladas (ReportEmission) + fila de revisão
 * técnica do super admin. A emissão em si acontece no portal do tenant
 * (DocumentsService.emit); aqui é leitura global e o carimbo de "revisada".
 * Todo acesso a conteúdo e toda revisão ficam na trilha de auditoria.
 */
@Injectable()
export class ReportsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Visão geral do motor: volumes para os cards da seção. */
  async overview() {
    const [total, pending, reviewed, byType] = await Promise.all([
      this.prisma.admin.reportEmission.count(),
      this.prisma.admin.reportEmission.count({ where: { status: 'EMITIDA' } }),
      this.prisma.admin.reportEmission.count({ where: { status: 'REVISADA' } }),
      this.prisma.admin.reportEmission.groupBy({ by: ['type'], _count: { _all: true } }),
    ]);
    const tenants = await this.prisma.admin.reportEmission.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });
    return {
      total,
      pendingReview: pending,
      reviewed,
      tenantsWithEmissions: tenants.length,
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
    };
  }

  /** Repositório cross-tenant: metadados de todas as emissões (conteúdo sob demanda). */
  async list() {
    const rows = await this.prisma.admin.reportEmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        type: true,
        title: true,
        emissionNumber: true,
        method: true,
        technicalOutput: true,
        contentHash: true,
        status: true,
        generatedBy: true,
        createdAt: true,
        reviewedBy: true,
        reviewedAt: true,
        org: { select: { name: true } },
      },
    });
    return rows.map(({ org, ...r }) => ({ ...r, tenantName: org.name }));
  }

  /** Conteúdo congelado de uma emissão (revisão técnica). Acesso auditado. */
  async get(id: string, actor: Actor) {
    const e = await this.prisma.admin.reportEmission.findUnique({
      where: { id },
      include: { org: { select: { name: true } } },
    });
    if (!e) throw new BadRequestException('Emissão não encontrada.');
    await this.audit.record({
      action: 'report.emission.view',
      actor,
      target: e.id,
      tenantId: e.tenantId,
      meta: { type: e.type, emissionNumber: e.emissionNumber },
    });
    const { org, ...rest } = e;
    return { ...rest, tenantName: org.name };
  }

  // ── Modelos de relatório (vinculados ao Motor de Diagnósticos) ────────────

  /** Catálogo de modelos + o instrumento a que cada um está vinculado. */
  async listTemplates() {
    const rows = await this.prisma.admin.reportTemplate.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { instrument: { select: { name: true, active: true } } },
    });
    return rows.map(({ instrument, ...t }) => ({
      ...t,
      instrumentName: instrument.name,
      instrumentActive: instrument.active,
    }));
  }

  /** Instrumentos do Motor de Diagnósticos disponíveis para vincular. */
  async listInstrumentOptions() {
    const rows = await this.prisma.admin.diagnosticInstrument.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, _count: { select: { versions: true } } },
    });
    return rows.map((r) => ({ slug: r.slug, name: r.name, versions: r._count.versions }));
  }

  async createTemplate(dto: UpsertReportTemplate, actor: Actor) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome do relatório.');
    const instrument = await this.prisma.admin.diagnosticInstrument.findUnique({
      where: { slug: dto.instrumentSlug },
    });
    if (!instrument) throw new BadRequestException('Diagnóstico vinculado não encontrado no Motor de Diagnósticos.');
    const key = toKey(dto.key?.trim() || name);
    if (!key) throw new BadRequestException('Não foi possível gerar o identificador do relatório.');
    const clash = await this.prisma.admin.reportTemplate.findUnique({ where: { key } });
    if (clash) throw new BadRequestException(`Já existe um relatório com o identificador "${key}".`);

    const created = await this.prisma.admin.reportTemplate.create({
      data: {
        key,
        name,
        description: dto.description?.trim() || null,
        instrumentSlug: instrument.slug,
        sections: cleanSections(dto.sections) as object,
        includeResults: dto.includeResults ?? true,
        includeDimensions: dto.includeDimensions ?? true,
        includePlan: dto.includePlan ?? false,
        active: dto.active ?? true,
        updatedBy: actor.email,
      },
    });
    await this.audit.record({
      action: 'report.template.create',
      actor,
      target: created.id,
      meta: { key, instrumentSlug: instrument.slug },
    });
    return created;
  }

  async updateTemplate(id: string, dto: UpsertReportTemplate, actor: Actor) {
    const existing = await this.prisma.admin.reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Modelo de relatório não encontrado.');
    if (dto.instrumentSlug && dto.instrumentSlug !== existing.instrumentSlug) {
      const instrument = await this.prisma.admin.diagnosticInstrument.findUnique({
        where: { slug: dto.instrumentSlug },
      });
      if (!instrument) throw new BadRequestException('Diagnóstico vinculado não encontrado.');
    }
    const updated = await this.prisma.admin.reportTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim() || existing.name,
        description: dto.description === undefined ? existing.description : dto.description?.trim() || null,
        instrumentSlug: dto.instrumentSlug ?? existing.instrumentSlug,
        sections: (dto.sections === undefined ? existing.sections : cleanSections(dto.sections)) as object,
        includeResults: dto.includeResults ?? existing.includeResults,
        includeDimensions: dto.includeDimensions ?? existing.includeDimensions,
        includePlan: dto.includePlan ?? existing.includePlan,
        active: dto.active ?? existing.active,
        updatedBy: actor.email,
      },
    });
    await this.audit.record({
      action: 'report.template.update',
      actor,
      target: id,
      meta: { key: updated.key, instrumentSlug: updated.instrumentSlug, active: updated.active },
    });
    return updated;
  }

  /**
   * Remove o modelo. Emissões já feitas NÃO são afetadas (o conteúdo delas é
   * congelado); apenas o modelo deixa de aparecer para novas gerações.
   */
  async removeTemplate(id: string, actor: Actor) {
    const existing = await this.prisma.admin.reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Modelo de relatório não encontrado.');
    const emitted = await this.prisma.admin.reportEmission.count({ where: { type: `tpl:${existing.key}` } });
    if (emitted > 0) {
      // Com emissões no repositório, desativar preserva o histórico auditável.
      const off = await this.prisma.admin.reportTemplate.update({
        where: { id },
        data: { active: false, updatedBy: actor.email },
      });
      await this.audit.record({
        action: 'report.template.deactivate',
        actor,
        target: id,
        meta: { key: existing.key, emitted },
      });
      return { ...off, deactivatedInsteadOfDeleted: true as const, emitted };
    }
    await this.prisma.admin.reportTemplate.delete({ where: { id } });
    await this.audit.record({
      action: 'report.template.delete',
      actor,
      target: id,
      meta: { key: existing.key },
    });
    return { ...existing, deactivatedInsteadOfDeleted: false as const, emitted: 0 };
  }

  /** Fila de revisão: marca a emissão como REVISADA (imutável no conteúdo). */
  async review(id: string, actor: Actor) {
    const e = await this.prisma.admin.reportEmission.findUnique({ where: { id } });
    if (!e) throw new BadRequestException('Emissão não encontrada.');
    if (e.status === 'REVISADA') return e;
    const updated = await this.prisma.admin.reportEmission.update({
      where: { id },
      data: { status: 'REVISADA', reviewedBy: actor.email, reviewedAt: new Date() },
    });
    await this.audit.record({
      action: 'report.emission.review',
      actor,
      target: id,
      tenantId: e.tenantId,
      meta: { type: e.type, emissionNumber: e.emissionNumber },
    });
    return updated;
  }
}
