import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ContractData,
  ContractModel,
  ContractStatus,
  DiagnosticMethod,
  TechnicalOutput,
  UpsertContractRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/**
 * Contrato por empresa (Briefing §11 + Matriz). Control plane (owner-only): a
 * CRIVO configura produto, modelo, prazo, rodadas, respondentes, integração
 * técnica (AEP/PGR), módulos opcionais e status SEM programação. As rotas usam
 * Tenant.id; resolvemos para organizationId (mesma convenção dos módulos).
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async orgIdFromTenant(tenantId: string): Promise<string> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    return tenant.organizationId;
  }

  /** Contrato vigente (mais recente) da empresa, ou null. */
  async get(tenantId: string): Promise<ContractData | null> {
    const organizationId = await this.orgIdFromTenant(tenantId);
    const c = await this.prisma.admin.contract.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return c ? this.toData(c) : null;
  }

  /** Cria ou atualiza o contrato vigente da empresa. */
  async upsert(tenantId: string, dto: UpsertContractRequest, actor: Actor): Promise<ContractData> {
    const organizationId = await this.orgIdFromTenant(tenantId);
    const existing = await this.prisma.admin.contract.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      productId: dto.productId ?? existing?.productId ?? null,
      model: (dto.model ?? existing?.model ?? 'PONTUAL') as ContractModel,
      status: (dto.status ?? existing?.status ?? 'RASCUNHO') as ContractStatus,
      method: (dto.method === undefined ? existing?.method : dto.method) as DiagnosticMethod | null,
      technicalOutput: (dto.technicalOutput ??
        existing?.technicalOutput ??
        'SEM_INTEGRACAO') as TechnicalOutput,
      startDate: dto.startDate === undefined ? existing?.startDate : parseDate(dto.startDate),
      endDate: dto.endDate === undefined ? existing?.endDate : parseDate(dto.endDate),
      accessDays: dto.accessDays === undefined ? existing?.accessDays ?? null : dto.accessDays,
      rounds: dto.rounds ?? existing?.rounds ?? 1,
      maxRespondents: dto.maxRespondents ?? existing?.maxRespondents ?? 0,
      maxLeaders: dto.maxLeaders ?? existing?.maxLeaders ?? 0,
      optionalModules: (dto.optionalModules ?? (existing?.optionalModules as string[]) ?? []) as object,
      responsible: dto.responsible === undefined ? existing?.responsible ?? null : dto.responsible,
      notes: dto.notes === undefined ? existing?.notes ?? null : dto.notes,
    };

    const saved = existing
      ? await this.prisma.admin.contract.update({ where: { id: existing.id }, data })
      : await this.prisma.admin.contract.create({ data: { organizationId, ...data } });

    await this.audit.record({
      action: existing ? 'contract.update' : 'contract.create',
      actor,
      target: organizationId,
      meta: { model: saved.model, status: saved.status, output: saved.technicalOutput },
    });

    return this.toData(saved);
  }

  private toData(c: {
    id: string;
    organizationId: string;
    productId: string | null;
    model: string;
    status: string;
    method: string | null;
    technicalOutput: string;
    startDate: Date | null;
    endDate: Date | null;
    accessDays: number | null;
    rounds: number;
    maxRespondents: number;
    maxLeaders: number;
    optionalModules: unknown;
    responsible: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ContractData {
    return {
      id: c.id,
      organizationId: c.organizationId,
      productId: c.productId,
      model: c.model as ContractModel,
      status: c.status as ContractStatus,
      method: (c.method as DiagnosticMethod | null) ?? null,
      technicalOutput: c.technicalOutput as TechnicalOutput,
      startDate: c.startDate?.toISOString() ?? null,
      endDate: c.endDate?.toISOString() ?? null,
      accessDays: c.accessDays,
      rounds: c.rounds,
      maxRespondents: c.maxRespondents,
      maxLeaders: c.maxLeaders,
      optionalModules: Array.isArray(c.optionalModules) ? (c.optionalModules as string[]) : [],
      responsible: c.responsible,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

/** Aceita 'YYYY-MM-DD' (input date) ou ISO; null/'' → null. */
function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
