import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

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
