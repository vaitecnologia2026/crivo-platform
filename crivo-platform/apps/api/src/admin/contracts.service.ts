import { Injectable, NotFoundException } from '@nestjs/common';
import type { Contract } from '@crivo/db';
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
    const data = this.mergeContractData(dto, existing);
    const saved = existing
      ? await this.prisma.admin.contract.update({ where: { id: existing.id }, data })
      : await this.prisma.admin.contract.create({ data: { organizationId, groupId: null, ...data } });

    await this.audit.record({
      action: existing ? 'contract.update' : 'contract.create',
      actor,
      target: organizationId,
      meta: { model: saved.model, status: saved.status, output: saved.technicalOutput },
    });

    // Tela 05 · contrato vinculante: quando ATIVO, liga os módulos comprados na
    // empresa (soluções + CORE + adicionais). Habilita (não desabilita outros).
    if (saved.status === 'ATIVO') {
      await this.activateContractModules(
        organizationId,
        saved.solutionIds,
        Array.isArray(saved.optionalModules) ? (saved.optionalModules as string[]) : [],
      );
    }

    return this.toData(saved);
  }

  /** Contrato vigente do GRUPO, ou null (Tela 05 [5]). */
  async getByGroup(groupId: string): Promise<ContractData | null> {
    const c = await this.prisma.admin.contract.findFirst({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
    return c ? this.toData(c) : null;
  }

  /** Cria/atualiza o contrato do GRUPO. Ao ATIVO, liga os módulos em TODOS os CNPJs. */
  async upsertByGroup(groupId: string, dto: UpsertContractRequest, actor: Actor): Promise<ContractData> {
    const group = await this.prisma.admin.businessGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    const existing = await this.prisma.admin.contract.findFirst({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
    const data = this.mergeContractData(dto, existing);
    const saved = existing
      ? await this.prisma.admin.contract.update({ where: { id: existing.id }, data })
      : await this.prisma.admin.contract.create({ data: { groupId, organizationId: null, ...data } });

    await this.audit.record({
      action: existing ? 'contract.update' : 'contract.create',
      actor,
      target: groupId,
      meta: { scope: 'group', model: saved.model, status: saved.status },
    });

    // Contrato de grupo vinculante: ao ATIVO, liga os módulos em CADA CNPJ do grupo.
    if (saved.status === 'ATIVO') {
      const tenants = await this.prisma.admin.tenant.findMany({
        where: { groupId },
        select: { organizationId: true },
      });
      const opt = Array.isArray(saved.optionalModules) ? (saved.optionalModules as string[]) : [];
      for (const t of tenants) {
        await this.activateContractModules(t.organizationId, saved.solutionIds, opt);
      }
    }

    return this.toData(saved);
  }

  /** Monta o objeto de dados do contrato (compartilhado por upsert de empresa e de grupo).
   *  Tela 05: compõe VÁRIAS soluções; productId = solução principal (1ª) p/ compat. */
  private mergeContractData(dto: UpsertContractRequest, existing: Contract | null) {
    const solutionIds = dto.solutionIds ?? (existing?.solutionIds ?? []);
    const primaryProductId = solutionIds[0] ?? dto.productId ?? existing?.productId ?? null;
    return {
      productId: primaryProductId,
      solutionIds,
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
  }

  /** Habilita na empresa os módulos das soluções contratadas + CORE + adicionais. */
  private async activateContractModules(
    organizationId: string,
    solutionIds: string[],
    optionalModules: string[],
  ): Promise<void> {
    const codes = new Set<string>(optionalModules);
    if (solutionIds.length) {
      const prods = await this.prisma.admin.product.findMany({
        where: { id: { in: solutionIds } },
        select: { modules: true, coreModules: true },
      });
      for (const p of prods) {
        for (const c of Array.isArray(p.modules) ? (p.modules as string[]) : []) codes.add(c);
        for (const c of Array.isArray(p.coreModules) ? (p.coreModules as string[]) : []) codes.add(c);
      }
    }
    for (const code of codes) {
      if (!code) continue;
      await this.prisma.admin.tenantModule.upsert({
        where: { tenantId_moduleCode: { tenantId: organizationId, moduleCode: code } },
        create: { tenantId: organizationId, moduleCode: code, enabled: true },
        update: { enabled: true },
      });
    }
  }

  private toData(c: {
    id: string;
    organizationId: string | null;
    groupId: string | null;
    productId: string | null;
    solutionIds: string[];
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
      groupId: c.groupId ?? null,
      productId: c.productId,
      solutionIds: Array.isArray(c.solutionIds) ? c.solutionIds : [],
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
