import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toTenantSummary } from './tenant.mapper';
import type {
  BusinessGroupSummary,
  GroupAccessEntry,
  GroupOverview,
  GroupOverviewTenantRow,
  Plan,
  SessionUser,
  TenantSummary,
  TenantStatus,
} from '@crivo/types';

/**
 * Grupos Empresariais (F1 · Caderno Tela 06 — Grupo → CNPJ → Unidade).
 * Control plane, exclusivo do super admin. O grupo é uma camada leve acima do
 * tenant: cada CNPJ é um tenant próprio (isolamento RLS existente), e o grupo
 * apenas os agrupa para gestão. Visão consolidada autorizada vem nas fases F2/F3.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista os grupos com seus CNPJs (tenants) vinculados. */
  async list(): Promise<BusinessGroupSummary[]> {
    const [groups, tenants] = await Promise.all([
      this.prisma.admin.businessGroup.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.admin.tenant.findMany({
        where: { groupId: { not: null } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, status: true, groupId: true },
      }),
    ]);
    const byGroup = new Map<string, BusinessGroupSummary['tenants']>();
    for (const t of tenants) {
      const arr = byGroup.get(t.groupId!) ?? [];
      arr.push({ id: t.id, name: t.name, slug: t.slug, status: t.status as TenantStatus });
      byGroup.set(t.groupId!, arr);
    }
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      consolidatedEnabled: g.consolidatedEnabled,
      tenants: byGroup.get(g.id) ?? [],
    }));
  }

  /** Cria um grupo empresarial. */
  async create(name: string, actor: AuditActor): Promise<BusinessGroupSummary> {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Informe o nome do grupo.');
    const g = await this.prisma.admin.businessGroup.create({ data: { name: trimmed } });
    await this.audit.record({ action: 'group.create', actor, target: g.id, meta: { name: trimmed } });
    return {
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      consolidatedEnabled: g.consolidatedEnabled,
      tenants: [],
    };
  }

  /** Renomeia um grupo. */
  async rename(id: string, name: string, actor: AuditActor): Promise<{ ok: true }> {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new BadRequestException('Informe o nome do grupo.');
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    await this.prisma.admin.businessGroup.update({ where: { id }, data: { name: trimmed } });
    await this.audit.record({ action: 'group.update', actor, target: id, meta: { name: trimmed } });
    return { ok: true };
  }

  /** Remove um grupo — apenas se não houver CNPJs vinculados. */
  async remove(id: string, actor: AuditActor): Promise<{ ok: true }> {
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    const linked = await this.prisma.admin.tenant.count({ where: { groupId: id } });
    if (linked > 0) {
      throw new BadRequestException(
        `Este grupo tem ${linked} empresa(s) vinculada(s). Desvincule antes de excluir.`,
      );
    }
    // Cascade em código (padrão desacoplado, sem FK): remove as autorizações do portal.
    await this.prisma.admin.businessGroupAccess.deleteMany({ where: { groupId: id } });
    await this.prisma.admin.businessGroup.delete({ where: { id } });
    await this.audit.record({ action: 'group.delete', actor, target: id, meta: { name: g.name } });
    return { ok: true };
  }

  /** F2 — Visão CONSOLIDADA do grupo (Caderno Tela 06: "admin grupo vê consolidado").
   *  Agrega dados dos CNPJs do grupo via prisma.admin (padrão Base CRIVO), com
   *  acesso auditado. §11: só agregados por empresa — nada individual por líder;
   *  respeita CompanyQuarterlyIcd.suppressed (não recomputa para burlar supressão). */
  async overview(groupId: string, actor: AuditActor): Promise<GroupOverview> {
    const group = await this.prisma.admin.businessGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado.');
    const result = await this.aggregateGroup(group);
    await this.audit.record({
      action: 'group.overview',
      actor,
      target: groupId,
      meta: { name: group.name, tenants: result.tenants.length },
    });
    return result;
  }

  /** Agrega os dados dos CNPJs do grupo. Reusado pelo Super Admin (overview) e
   *  pelo portal do cliente (portalOverviewForUser). §11: só agregados por
   *  empresa; respeita CompanyQuarterlyIcd.suppressed (não recomputa por líder). */
  private async aggregateGroup(group: {
    id: string;
    name: string;
    createdAt: Date;
  }): Promise<GroupOverview> {
    const tenants = await this.prisma.admin.tenant.findMany({
      where: { groupId: group.id },
      orderBy: { name: 'asc' },
    });

    // ATENÇÃO: o tenantId do DATA PLANE é o organizationId (não o tenant.id).
    const orgIds = tenants.map((t) => t.organizationId);

    type CountByOrg = Map<string, number>;
    const users: CountByOrg = new Map();
    const assessments: CountByOrg = new Map();
    const evidences: CountByOrg = new Map();
    const actionsTotal: CountByOrg = new Map();
    const actionsDone: CountByOrg = new Map();
    const pocketTotal: CountByOrg = new Map();
    const pocketDone: CountByOrg = new Map();
    const campaignsTotal: CountByOrg = new Map();
    const campaignsOpen: CountByOrg = new Map();
    const icdLatest = new Map<string, { score: number | null; suppressed: boolean }>();

    if (orgIds.length > 0) {
      const where = { tenantId: { in: orgIds } };
      const [u, a, icds, ai, ev, ps, cy] = await Promise.all([
        this.prisma.admin.user.groupBy({
          by: ['tenantId'],
          where: { ...where, active: true },
          _count: { _all: true },
        }),
        this.prisma.admin.assessment.groupBy({ by: ['tenantId'], where, _count: { _all: true } }),
        this.prisma.admin.companyQuarterlyIcd.findMany({
          where,
          orderBy: { computedAt: 'desc' },
          select: { tenantId: true, score: true, suppressed: true },
        }),
        this.prisma.admin.actionItem.groupBy({
          by: ['tenantId', 'status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.admin.evidence.groupBy({ by: ['tenantId'], where, _count: { _all: true } }),
        this.prisma.admin.pocketSession.groupBy({
          by: ['tenantId', 'status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.admin.assessmentCycle.groupBy({
          by: ['tenantId', 'status'],
          where,
          _count: { _all: true },
        }),
      ]);

      for (const r of u) users.set(r.tenantId, r._count._all);
      for (const r of a) assessments.set(r.tenantId, r._count._all);
      for (const r of ev) evidences.set(r.tenantId, r._count._all);
      // Último ICD oficial por CNPJ (lista já vem em ordem desc de computedAt).
      for (const r of icds) {
        if (!icdLatest.has(r.tenantId)) {
          icdLatest.set(r.tenantId, { score: r.score, suppressed: r.suppressed });
        }
      }
      for (const r of ai) {
        actionsTotal.set(r.tenantId, (actionsTotal.get(r.tenantId) ?? 0) + r._count._all);
        // Encerradas = CONCLUIDA + REAVALIADA (REAVALIADA vem depois de concluída).
        if (r.status === 'CONCLUIDA' || r.status === 'REAVALIADA') {
          actionsDone.set(r.tenantId, (actionsDone.get(r.tenantId) ?? 0) + r._count._all);
        }
      }
      for (const r of ps) {
        pocketTotal.set(r.tenantId, (pocketTotal.get(r.tenantId) ?? 0) + r._count._all);
        if (r.status === 'CONCLUIDA') {
          pocketDone.set(r.tenantId, (pocketDone.get(r.tenantId) ?? 0) + r._count._all);
        }
      }
      for (const r of cy) {
        campaignsTotal.set(r.tenantId, (campaignsTotal.get(r.tenantId) ?? 0) + r._count._all);
        if (r.status === 'OPEN') {
          campaignsOpen.set(r.tenantId, (campaignsOpen.get(r.tenantId) ?? 0) + r._count._all);
        }
      }
    }

    const rows: GroupOverviewTenantRow[] = tenants.map((t) => {
      const icd = icdLatest.get(t.organizationId);
      return {
        tenantId: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as TenantStatus,
        plan: t.plan as Plan,
        activeUsers: users.get(t.organizationId) ?? 0,
        assessments: assessments.get(t.organizationId) ?? 0,
        icdScore: icd && !icd.suppressed ? icd.score : null,
        icdSuppressed: icd?.suppressed ?? false,
        actionsTotal: actionsTotal.get(t.organizationId) ?? 0,
        actionsDone: actionsDone.get(t.organizationId) ?? 0,
        evidences: evidences.get(t.organizationId) ?? 0,
        pocketDone: pocketDone.get(t.organizationId) ?? 0,
        pocketTotal: pocketTotal.get(t.organizationId) ?? 0,
        campaignsOpen: campaignsOpen.get(t.organizationId) ?? 0,
        campaignsTotal: campaignsTotal.get(t.organizationId) ?? 0,
      };
    });

    const sum = (pick: (r: GroupOverviewTenantRow) => number) =>
      rows.reduce((acc, r) => acc + pick(r), 0);
    const icdScores = rows.map((r) => r.icdScore).filter((s): s is number => s != null);
    const icdAverage =
      icdScores.length > 0
        ? Math.round(icdScores.reduce((a, b) => a + b, 0) / icdScores.length)
        : null;

    return {
      group: { id: group.id, name: group.name, createdAt: group.createdAt.toISOString() },
      tenants: rows,
      consolidated: {
        tenants: rows.length,
        activeUsers: sum((r) => r.activeUsers),
        assessments: sum((r) => r.assessments),
        icdAverage,
        icdCovered: icdScores.length,
        actionsTotal: sum((r) => r.actionsTotal),
        actionsDone: sum((r) => r.actionsDone),
        evidences: sum((r) => r.evidences),
        pocketDone: sum((r) => r.pocketDone),
        pocketTotal: sum((r) => r.pocketTotal),
        campaignsOpen: sum((r) => r.campaignsOpen),
        campaignsTotal: sum((r) => r.campaignsTotal),
      },
    };
  }

  // ── F3: consolidado no PORTAL do cliente (Admin de Grupo) ──────────────

  /** Liga/desliga a visão consolidada do grupo no portal do cliente. */
  async setConsolidated(id: string, enabled: boolean, actor: AuditActor): Promise<{ ok: true }> {
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    await this.prisma.admin.businessGroup.update({
      where: { id },
      data: { consolidatedEnabled: enabled },
    });
    await this.audit.record({ action: 'group.consolidated.set', actor, target: id, meta: { enabled } });
    return { ok: true };
  }

  /** E-mails autorizados a ver o consolidado do grupo no portal. */
  async listAccess(groupId: string): Promise<GroupAccessEntry[]> {
    const rows = await this.prisma.admin.businessGroupAccess.findMany({
      where: { groupId },
      orderBy: { email: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.createdAt.toISOString() }));
  }

  /** Autoriza um e-mail a ver o consolidado do grupo (idempotente). */
  async addAccess(groupId: string, email: string, actor: AuditActor): Promise<GroupAccessEntry> {
    const g = await this.prisma.admin.businessGroup.findUnique({ where: { id: groupId } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    const norm = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm)) throw new BadRequestException('E-mail inválido.');
    const row = await this.prisma.admin.businessGroupAccess.upsert({
      where: { groupId_email: { groupId, email: norm } },
      create: { groupId, email: norm },
      update: {},
    });
    await this.audit.record({ action: 'group.access.add', actor, target: groupId, meta: { email: norm } });
    return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
  }

  /** Revoga um e-mail autorizado. */
  async removeAccess(accessId: string, actor: AuditActor): Promise<{ ok: true }> {
    const row = await this.prisma.admin.businessGroupAccess.findUnique({ where: { id: accessId } });
    if (!row) throw new NotFoundException('Autorização não encontrada.');
    await this.prisma.admin.businessGroupAccess.delete({ where: { id: accessId } });
    await this.audit.record({
      action: 'group.access.remove',
      actor,
      target: row.groupId,
      meta: { email: row.email },
    });
    return { ok: true };
  }

  /** O usuário do tenant tem acesso ao consolidado do seu grupo? (gate do menu). */
  async userHasGroupAccess(user: SessionUser): Promise<boolean> {
    return (await this.groupForUser(user)) != null;
  }

  /** Consolidado do grupo para o usuário do PORTAL — 403 se não autorizado. */
  async portalOverviewForUser(user: SessionUser): Promise<GroupOverview> {
    const group = await this.groupForUser(user);
    if (!group) throw new ForbiddenException('Você não tem acesso ao consolidado do grupo.');
    const result = await this.aggregateGroup(group);
    await this.audit.record({
      action: 'group.portal.view',
      actor: { id: user.id, email: user.email },
      target: group.id,
      tenantId: user.tenantId,
      meta: { name: group.name },
    });
    return result;
  }

  /** Resolve o grupo consolidado a que o usuário tem acesso, ou null. Regras:
   *  o tenant do usuário pertence a um grupo + grupo.consolidatedEnabled + e-mail
   *  do usuário na lista de acesso. (SessionUser.tenantId = organizationId.) */
  private async groupForUser(
    user: SessionUser,
  ): Promise<{ id: string; name: string; createdAt: Date } | null> {
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { organizationId: user.tenantId },
      select: { groupId: true },
    });
    if (!tenant?.groupId) return null;
    const group = await this.prisma.admin.businessGroup.findUnique({ where: { id: tenant.groupId } });
    if (!group || !group.consolidatedEnabled) return null;
    const access = await this.prisma.admin.businessGroupAccess.findUnique({
      where: { groupId_email: { groupId: group.id, email: user.email.toLowerCase() } },
    });
    if (!access) return null;
    return { id: group.id, name: group.name, createdAt: group.createdAt };
  }

  /** Vincula (ou desvincula, com groupId=null) uma empresa a um grupo. */
  async assignTenant(
    tenantId: string,
    groupId: string | null,
    actor: AuditActor,
  ): Promise<TenantSummary> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');

    let groupName: string | null = null;
    if (groupId) {
      const g = await this.prisma.admin.businessGroup.findUnique({ where: { id: groupId } });
      if (!g) throw new NotFoundException('Grupo não encontrado.');
      groupName = g.name;
    }

    const updated = await this.prisma.admin.tenant.update({
      where: { id: tenantId },
      data: { groupId },
    });
    await this.audit.record({
      action: 'tenant.group.set',
      actor,
      target: tenantId,
      meta: { groupId, groupName },
    });
    return toTenantSummary(updated, groupName);
  }
}
