import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computePreDiagnostic,
  type CreateDiagnosticLeadRequest,
  type PlatformLeadStage,
  type PlatformLeadSummary,
  type PreDiagnosticResult,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * CRM do SUPER ADMIN (funil comercial da CRIVO). Os leads nascem do Diagnóstico
 * Inicial da LP (intakeDiagnostic, público) ou de cadastro manual, e pertencem
 * ao super admin — NÃO a uma empresa. Control plane (owner-only): acesso via
 * prisma.admin. Ao fechar a venda, o lead vira Tenant (FASE 3 — conversão).
 */
@Injectable()
export class PlatformLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<PlatformLeadSummary[]> {
    const rows = await this.prisma.admin.platformLead.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((l) => this.toSummary(l));
  }

  /**
   * PÚBLICO — porta de entrada do funil. Recebe o form + respostas do
   * Diagnóstico Inicial, calcula o resultado preliminar e cria o lead NOVO no
   * CRM do super admin, vinculado ao produto de captura (PRÉ-DIAGNÓSTICO).
   */
  async intakeDiagnostic(
    dto: CreateDiagnosticLeadRequest,
  ): Promise<{ ok: true; result: PreDiagnosticResult }> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Nome é obrigatório');

    let result: PreDiagnosticResult;
    try {
      result = computePreDiagnostic(dto.answers ?? []);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Respostas do diagnóstico inválidas',
      );
    }

    // Produto de captura (pré-diagnóstico) — origem do lead, se cadastrado.
    const captureProduct = await this.prisma.admin.product.findFirst({
      where: { isLeadCapture: true },
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.admin.platformLead.create({
      data: {
        name,
        company: dto.company?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        segment: dto.segment?.trim() || null,
        employeesCount: dto.employeesCount?.trim() || null,
        origin: dto.origin?.trim() || 'lp-diagnostico',
        productId: captureProduct?.id ?? null,
        diagnosticScore: result.score,
        diagnosticResult: result as unknown as object,
        stage: 'NOVO',
      },
    });

    await this.audit.record({
      action: 'lead.intake',
      target: dto.email?.trim() || name,
      meta: { origin: dto.origin ?? 'lp-diagnostico', score: result.score },
    });

    return { ok: true, result };
  }

  async setStage(id: string, stage: PlatformLeadStage, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = await this.prisma.admin.platformLead.update({ where: { id }, data: { stage } });
    await this.audit.record({ action: 'lead.stage', actor, target: id, meta: { stage } });
    return this.toSummary(updated);
  }

  async setNotes(id: string, notes: string, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { notes },
    });
    await this.audit.record({ action: 'lead.notes', actor, target: id });
    return this.toSummary(updated);
  }

  private toSummary(l: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    segment: string | null;
    employeesCount: string | null;
    origin: string | null;
    productId: string | null;
    diagnosticScore: number | null;
    diagnosticResult: unknown;
    stage: string;
    notes: string | null;
    convertedTenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PlatformLeadSummary {
    return {
      id: l.id,
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      segment: l.segment,
      employeesCount: l.employeesCount,
      origin: l.origin,
      productId: l.productId,
      diagnosticScore: l.diagnosticScore,
      diagnosticResult: (l.diagnosticResult as PreDiagnosticResult | null) ?? null,
      stage: l.stage as PlatformLeadStage,
      notes: l.notes,
      convertedTenantId: l.convertedTenantId,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }
}
