import { Injectable, NotFoundException } from '@nestjs/common';
import type { Contract } from '@crivo/db';
import {
  MODULES,
  type ContractData,
  type ContractModel,
  type ContractStatus,
  type DiagnosticMethod,
  type TechnicalOutput,
  type UpsertContractRequest,
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

  /**
   * Lista TODOS os contratos com dados do cliente (tela "Contratos e Liberações",
   * modelo aprovado): cliente, vigência, responsável, MRR (solução principal +
   * adicionais recorrentes), nº de adicionais, ciclos e status.
   */
  async listAll() {
    const [contracts, tenants, groups, products, addons] = await Promise.all([
      this.prisma.admin.contract.findMany({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.admin.tenant.findMany({ select: { id: true, organizationId: true, name: true } }),
      this.prisma.admin.businessGroup.findMany({ select: { id: true, name: true } }),
      this.prisma.admin.product.findMany({ select: { id: true, name: true, monthlyPriceCents: true } }),
      this.prisma.admin.addon.findMany({ select: { moduleCode: true, monthlyPriceCents: true, recurring: true } }),
    ]);
    const tenantByOrg = new Map(tenants.map((t) => [t.organizationId, t]));
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const productById = new Map(products.map((p) => [p.id, p]));
    const addonByCode = new Map(addons.map((a) => [a.moduleCode, a]));

    return contracts.map((c) => {
      const tenant = c.organizationId ? tenantByOrg.get(c.organizationId) : undefined;
      const group = c.groupId ? groupById.get(c.groupId) : undefined;
      const product = c.productId ? productById.get(c.productId) : undefined;
      const optional = (c.optionalModules as string[] | null) ?? [];
      const addonsMrr = optional.reduce((sum, code) => {
        const a = addonByCode.get(code);
        return sum + (a && a.recurring ? a.monthlyPriceCents : 0);
      }, 0);
      return {
        id: c.id,
        shortId: `ctr-${c.id.slice(0, 6)}`,
        clientName: group?.name ?? tenant?.name ?? '—',
        byGroup: !!c.groupId,
        tenantId: tenant?.id ?? null, // Tenant.id (control plane) p/ abrir o modal
        groupId: c.groupId ?? null,
        productName: product?.name ?? null,
        status: c.status,
        startDate: c.startDate?.toISOString() ?? null,
        endDate: c.endDate?.toISOString() ?? null,
        responsible: c.responsible ?? null,
        rounds: c.rounds,
        addonsCount: optional.length,
        mrrCents: (product?.monthlyPriceCents ?? 0) + addonsMrr,
        updatedAt: c.updatedAt.toISOString(),
      };
    });
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
    // empresa (soluções + CORE + adicionais). Ao TROCAR a solução contratada,
    // o que o contrato ANTERIOR liberava e o novo não libera mais é desligado —
    // sem isso o painel do cliente somava os módulos da solução antiga aos da
    // nova e a troca nunca aparecia lá. Só o que ESTE contrato concedeu é
    // revogado (ver `activateContractModules`).
    if (saved.status === 'ATIVO') {
      await this.activateContractModules(
        organizationId,
        saved.solutionIds,
        Array.isArray(saved.optionalModules) ? (saved.optionalModules as string[]) : [],
        await this.grantedByContract(existing),
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
    // Mesma regra da empresa: a troca de solução também RETIRA, em cada CNPJ, o que
    // o contrato de grupo anterior liberava e o novo não libera mais.
    if (saved.status === 'ATIVO') {
      const tenants = await this.prisma.admin.tenant.findMany({
        where: { groupId },
        select: { organizationId: true },
      });
      const opt = Array.isArray(saved.optionalModules) ? (saved.optionalModules as string[]) : [];
      const previouslyGranted = await this.grantedByContract(existing);
      for (const t of tenants) {
        await this.activateContractModules(t.organizationId, saved.solutionIds, opt, previouslyGranted);
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

  /** Códigos de módulo que UM contrato libera: soluções (modules + CORE) + adicionais.
   *  Só calcula — não escreve nada. Serve tanto para o contrato que está sendo
   *  salvo quanto para o anterior, e é o que permite saber o que precisa sair. */
  private async contractModuleCodes(
    solutionIds: string[],
    optionalModules: string[],
  ): Promise<Set<string>> {
    // C4: opcionais do contrato agora podem ser ADICIONAIS do catálogo com slug
    // próprio (ex.: crivo-plus). O que liga módulo é addon.activatedModules —
    // o slug em si NÃO vira tenant_module (seria linha órfã que nenhum guard
    // conhece). Códigos que já são módulos reais continuam entrando direto.
    const moduleCodes = new Set<string>(MODULES.map((m) => m.code));
    const codes = new Set<string>();
    if (optionalModules.length) {
      const addonRows = await this.prisma.admin.addon.findMany({
        where: { moduleCode: { in: optionalModules } },
        select: { moduleCode: true, activatedModules: true },
      });
      const byCode = new Map(addonRows.map((a) => [a.moduleCode, a]));
      for (const code of optionalModules) {
        if (moduleCodes.has(code)) codes.add(code);
        for (const c of byCode.get(code)?.activatedModules ?? []) {
          if (moduleCodes.has(c)) codes.add(c);
        }
      }
    }
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
    return codes;
  }

  /** O que o contrato ANTERIOR já havia liberado na empresa. Vazio quando não
   *  existia contrato ou quando ele NÃO estava ATIVO — nesse caso ele nunca
   *  concedeu módulo nenhum e, portanto, não há o que revogar em nome dele
   *  (é o caso do rascunho gerado na conversão do lead, por exemplo). */
  private async grantedByContract(previous: Contract | null): Promise<Set<string>> {
    if (!previous || previous.status !== 'ATIVO') return new Set<string>();
    return this.contractModuleCodes(
      previous.solutionIds,
      Array.isArray(previous.optionalModules) ? (previous.optionalModules as string[]) : [],
    );
  }

  /** Habilita na empresa os módulos das soluções contratadas + CORE + adicionais.
   *  Com `previouslyGranted`, DESLIGA também o que o contrato anterior liberava e
   *  o atual não libera mais — é isso que faz a troca de solução aparecer no
   *  painel do cliente, que hoje lê `tenant_modules` a cada carregamento.
   *
   *  A revogação é deliberadamente estreita: percorre só o conjunto do contrato
   *  anterior. Módulo que o contrato NUNCA concedeu — veio do plano na provisão,
   *  ou de um toggle manual do super admin — não é tocado. Sem `previouslyGranted`
   *  o comportamento é exatamente o de antes: habilita e não desabilita nada. */
  private async activateContractModules(
    organizationId: string,
    solutionIds: string[],
    optionalModules: string[],
    previouslyGranted: Set<string> = new Set<string>(),
  ): Promise<void> {
    const codes = await this.contractModuleCodes(solutionIds, optionalModules);
    for (const code of codes) {
      if (!code) continue;
      await this.prisma.admin.tenantModule.upsert({
        where: { tenantId_moduleCode: { tenantId: organizationId, moduleCode: code } },
        create: { tenantId: organizationId, moduleCode: code, enabled: true },
        update: { enabled: true },
      });
    }
    // Saiu do contrato → sai do painel. `updateMany` de propósito: se a linha não
    // existe, não há o que desligar e nada é criado (upsert criaria linha órfã
    // desabilitada para um módulo que a empresa nunca teve).
    for (const code of previouslyGranted) {
      if (!code || codes.has(code)) continue;
      await this.prisma.admin.tenantModule.updateMany({
        where: { tenantId: organizationId, moduleCode: code },
        data: { enabled: false },
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
