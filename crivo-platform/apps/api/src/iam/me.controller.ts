import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { CurrentUser } from './current-user.decorator';
import { ModuleService } from './module.service';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../admin/groups.service';
import { UpdateBrandingDto, UpdateOrganizationDto } from '../admin/dto';
import type { TenantBranding } from '@crivo/db';
import {
  TERMS_VERSION,
  type SessionUser,
  type TenantBrandingData,
  type TermsStatus,
  type OrganizationData,
} from '@crivo/types';

/** Converte a linha (ou ausência) no contrato compartilhado (nulls). */
function toBrandingData(b: TenantBranding | null): TenantBrandingData {
  return {
    logoUrl: b?.logoUrl ?? null,
    faviconUrl: b?.faviconUrl ?? null,
    primaryColor: b?.primaryColor ?? null,
    accentColor: b?.accentColor ?? null,
    emailFrom: b?.emailFrom ?? null,
    whatsapp: b?.whatsapp ?? null,
    footerText: b?.footerText ?? null,
  };
}

/** Dados da sessão da própria empresa (data-driven nav — F6 · white-label — F5). */
@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly modules: ModuleService,
    private readonly permissions: PermissionService,
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  /** Códigos dos módulos ativos da empresa do usuário (alimenta o menu). */
  @Get('modules')
  async myModules(@CurrentUser() user: SessionUser): Promise<string[]> {
    const codes = [...(await this.modules.enabledFor(user.tenantId))];
    // F3: libera o item "Grupo Empresarial" no menu quando o usuário tem acesso
    // ao consolidado do seu grupo (grupo consolidado + e-mail autorizado).
    if (await this.groups.userHasGroupAccess(user)) codes.push('grupo');
    return codes;
  }

  /** Permissões efetivas (modulo:acao) do usuário — filtra o menu.
   *  #68 — Une o papel de sistema (User.role) com TenantRoles customizados
   *  via UserRole. RBAC dinâmico aditivo (legacy + custom). */
  @Get('permissions')
  async myPermissions(@CurrentUser() user: SessionUser): Promise<string[]> {
    return [...(await this.permissions.effectiveForUser(user.tenantId, user.id, user.role))];
  }

  /** Papel do usuário logado — define a HOME inicial e a área padrão (#51). */
  @Get('role')
  myRole(@CurrentUser() user: SessionUser): { role: string; name: string } {
    return { role: user.role, name: user.name };
  }

  /** F3 — Consolidado do Grupo Empresarial do usuário (403 se não autorizado). */
  @Get('group/overview')
  myGroupOverview(@CurrentUser() user: SessionUser) {
    return this.groups.portalOverviewForUser(user);
  }

  /** #8/#10 — Tipo de diagnóstico do produto contratado (Inicial/Essencial/
   *  Organizacional) + saídas técnicas, para a tela Diagnóstico mostrar o tipo
   *  correto e o Portal se moldar ao produto. */
  @Get('diagnostic-context')
  async diagnosticContext(@CurrentUser() user: SessionUser): Promise<{
    method: string | null;
    technicalOutputs: string[];
    productName: string | null;
  }> {
    const tenant = await this.prisma.admin.tenant.findFirst({
      where: { organizationId: user.tenantId },
      select: { productId: true },
    });
    const product = tenant?.productId
      ? await this.prisma.admin.product.findUnique({
          where: { id: tenant.productId },
          select: { method: true, supportedOutputs: true, name: true },
        })
      : null;
    return {
      method: product?.method ?? null,
      technicalOutputs: Array.isArray(product?.supportedOutputs)
        ? (product!.supportedOutputs as string[])
        : [],
      productName: product?.name ?? null,
    };
  }

  /** Telas liberadas para o usuário (null = sem restrição) — filtra o menu por usuário. */
  @Get('screens')
  async myScreens(@CurrentUser() user: SessionUser): Promise<string[] | null> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: user.id },
        select: { screenAccess: true },
      });
      return Array.isArray(u?.screenAccess) ? (u!.screenAccess as string[]) : null;
    });
  }

  /** #65 — Onboarding checklist do tenant. Retorna 5 marcos do primeiro
   *  uso, para o Dashboard guiar o cliente nos primeiros passos. Some
   *  do Dashboard quando `allDone` é true. */
  @Get('onboarding-status')
  async myOnboardingStatus(@CurrentUser() user: SessionUser): Promise<{
    termsAccepted: boolean;
    firstDecisionRegistered: boolean;
    firstPocketCompleted: boolean;
    firstCampaignCreated: boolean;
    firstPlanValidated: boolean;
    allDone: boolean;
  }> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const me = await tx.user.findUnique({
        where: { id: user.id },
        select: { termsAcceptedAt: true, termsVersion: true },
      });
      const termsAccepted = !!me?.termsAcceptedAt && me.termsVersion === TERMS_VERSION;

      const decisionCount = await tx.decision.count({
        where: { leaderId: user.id, deletedAt: null },
      });
      const pocketDone = await tx.pocketSession.count({
        where: { leaderId: user.id, status: 'CONCLUIDA' },
      });
      const campaignCount = await tx.assessmentCycle.count();
      const validatedPlan = await tx.actionPlan.count({ where: { validatedAt: { not: null } } });

      const status = {
        termsAccepted,
        firstDecisionRegistered: decisionCount > 0,
        firstPocketCompleted: pocketDone > 0,
        firstCampaignCreated: campaignCount > 0,
        firstPlanValidated: validatedPlan > 0,
      };
      const allDone =
        status.termsAccepted &&
        status.firstDecisionRegistered &&
        status.firstPocketCompleted &&
        status.firstCampaignCreated &&
        status.firstPlanValidated;
      return { ...status, allDone };
    });
  }

  /** #63 — People Analytics agregado (Briefing §10, Matriz §People Analytics).
   *  Cruzamentos disponíveis com dados que o sistema já coleta:
   *  - Evolução do ICD oficial por ciclo trimestral
   *  - Decisões agrupadas por categoria + fator de pressão
   *  - Uso do Pocket por momento e formato
   *  - Plano de ação: contagens por status × origem
   *  Indicadores importados (turnover/clima/absenteísmo) ficam para fase
   *  futura — o front exibe placeholder honesto quando ausentes. */
  @Get('analytics')
  async myAnalytics(@CurrentUser() user: SessionUser): Promise<{
    icdEvolution: Array<{ cycleName: string; quarter: number; year: number; score: number | null; suppressed: boolean; eligibleLeaders: number; closedAt: string | null }>;
    decisionsByCategory: Array<{ category: string; count: number }>;
    decisionsByPressure: Array<{ pressureFactor: string; count: number }>;
    pocketUsage: { totalSessions: number; concluded: number; byMoment: Record<string, number> };
    planSummary: { total: number; byStatus: Record<string, number>; byOrigin: Record<string, number> };
  }> {
    // ICD oficial trimestral (CompanyQuarterlyIcd) com info do ciclo.
    const icdRows = await this.prisma.admin.companyQuarterlyIcd.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { computedAt: 'desc' },
      take: 12,
      include: { cycle: { select: { name: true, quarter: true, year: true, closedAt: true } } },
    });
    const icdEvolution = icdRows.reverse().map((r) => ({
      cycleName: r.cycle.name,
      quarter: r.cycle.quarter,
      year: r.cycle.year,
      score: r.score,
      suppressed: r.suppressed,
      eligibleLeaders: r.eligibleLeaders,
      closedAt: r.cycle.closedAt ? r.cycle.closedAt.toISOString() : null,
    }));

    // Decisões — usa RLS (forTenant) para Decision/PocketSession/ActionItem.
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const decByCategoryRaw = await tx.decision.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      const categoryIds = decByCategoryRaw.map((r) => r.categoryId).filter((c): c is string => !!c);
      const categories = categoryIds.length
        ? await tx.decisionCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const decisionsByCategory = decByCategoryRaw
        .map((r) => ({
          category: r.categoryId ? (catMap.get(r.categoryId) ?? 'Sem categoria') : 'Sem categoria',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);

      const decByPressureRaw = await tx.decision.groupBy({
        by: ['pressureFactor'],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      const decisionsByPressure = decByPressureRaw
        .filter((r) => r.pressureFactor !== null)
        .map((r) => ({ pressureFactor: r.pressureFactor!, count: r._count._all }))
        .sort((a, b) => b.count - a.count);

      // Pocket — uso agregado.
      const totalSessions = await tx.pocketSession.count();
      const concluded = await tx.pocketSession.count({ where: { status: 'CONCLUIDA' } });
      const byMomentRaw = await tx.pocketSession.groupBy({
        by: ['momentOfUse'],
        _count: { _all: true },
      });
      const byMoment: Record<string, number> = {};
      for (const r of byMomentRaw) byMoment[r.momentOfUse] = r._count._all;
      const pocketUsage = { totalSessions, concluded, byMoment };

      // Plano de ação — agrega por status e origem.
      const items = await tx.actionItem.findMany({
        select: { status: true, origin: true },
      });
      const byStatus: Record<string, number> = {};
      const byOrigin: Record<string, number> = {};
      for (const it of items) {
        byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
        const o = it.origin ?? 'sem origem';
        byOrigin[o] = (byOrigin[o] ?? 0) + 1;
      }
      const planSummary = { total: items.length, byStatus, byOrigin };

      return {
        icdEvolution,
        decisionsByCategory,
        decisionsByPressure,
        pocketUsage,
        planSummary,
      };
    });
  }

  /** #62 — Catálogo GLOBAL da Academia CRIVO publicado pelo Super Admin.
   *  Qualquer usuário autenticado pode ler. Importação para LibraryItem
   *  fica em POST /library/import-global/:contentId. */
  @Get('global-academy')
  async myGlobalAcademy() {
    const rows = await this.prisma.admin.globalAcademyContent.findMany({
      where: { published: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      description: r.description,
      url: r.url,
      category: r.category,
      tags: r.tags ?? [],
    }));
  }

  /** #61 — Catálogo de ActionTemplates ativos (Biblioteca de Ações modelo
   *  do Super Admin). Qualquer usuário autenticado pode ler para importar
   *  no próprio Plano de Ação. */
  @Get('action-templates')
  async myActionTemplates() {
    const rows = await this.prisma.admin.actionTemplate.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description,
      suggestedResponsible: r.suggestedResponsible,
      expectedEvidence: r.expectedEvidence,
      defaultReviewDays: r.defaultReviewDays,
    }));
  }

  /** #59 — Mentorias do tenant. Líder vê só as suas (match por e-mail no
   *  campo attendee); RH/CEO/GESTOR/ADMIN veem todas. Control plane sem RLS. */
  @Get('mentorias')
  async myMentorias(
    @CurrentUser() user: SessionUser,
  ): Promise<Array<{
    id: string;
    title: string;
    format: string;
    mentorName: string;
    attendee: string;
    scheduledAt: string;
    durationMin: number;
    meetingUrl: string | null;
    location: string | null;
    status: string;
    notes: string | null;
    recordingUrl: string | null;
  }>> {
    const isLeaderOnly = user.role === 'LIDER' || user.role === 'COLABORADOR';
    const rows = await this.prisma.admin.mentoria.findMany({
      where: {
        tenantId: user.tenantId,
        ...(isLeaderOnly ? { attendee: { contains: user.email, mode: 'insensitive' } } : {}),
      },
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map((m) => ({
      id: m.id,
      title: m.title,
      format: m.format,
      mentorName: m.mentorName,
      attendee: m.attendee,
      scheduledAt: m.scheduledAt.toISOString(),
      durationMin: m.durationMin,
      meetingUrl: m.meetingUrl,
      location: m.location,
      status: m.status,
      notes: m.notes,
      recordingUrl: m.recordingUrl,
    }));
  }

  /** Histórico de eventos de auditoria do tenant (últimos 100).
   *  #56 — alimenta a rota /historico do portal. Não expõe `meta` para evitar
   *  PII; lista apenas action/target/timestamp/actorEmail. */
  @Get('audit-log')
  async myAuditLog(
    @CurrentUser() user: SessionUser,
  ): Promise<Array<{ id: string; action: string; target: string | null; actorEmail: string | null; at: string }>> {
    // AuditLog é control plane (sem RLS) mas filtra por tenantId. Acesso é
    // restrito pelo AuthGuard + filtro WHERE tenantId = user.tenantId.
    const rows = await this.prisma.admin.auditLog.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { at: 'desc' },
      take: 100,
      select: { id: true, action: true, target: true, actorEmail: true, at: true },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.target,
      actorEmail: r.actorEmail,
      at: r.at.toISOString(),
    }));
  }

  /** Status do aceite de termos/LGPD do usuário (1º acesso). */
  @Get('terms')
  myTerms(@CurrentUser() user: SessionUser): Promise<TermsStatus> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const u = await tx.user.findUnique({ where: { id: user.id } });
      const acceptedVersion = u?.termsVersion ?? null;
      return {
        accepted: !!u?.termsAcceptedAt && acceptedVersion === TERMS_VERSION,
        acceptedVersion,
        currentVersion: TERMS_VERSION,
      };
    });
  }

  /** Registra o aceite dos termos/LGPD na versão vigente. */
  @Post('terms/accept')
  acceptTerms(@CurrentUser() user: SessionUser): Promise<TermsStatus> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
      });
      return { accepted: true, acceptedVersion: TERMS_VERSION, currentVersion: TERMS_VERSION };
    });
  }

  /** Identidade visual (white-label, F5) da empresa — lida sob RLS. */
  @Get('branding')
  myBranding(@CurrentUser() user: SessionUser): Promise<TenantBrandingData> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const b = await tx.tenantBranding.findUnique({ where: { tenantId: user.tenantId } });
      return toBrandingData(b);
    });
  }

  /**
   * Self-service: o admin da empresa edita o próprio branding (F5). Gateado por
   * `branding:edit` (PermissionGuard) e escrito sob RLS (forTenant) — o tenant
   * só consegue alterar a própria identidade.
   */
  @Put('branding')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('branding:edit')
  updateBranding(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateBrandingDto,
  ): Promise<TenantBrandingData> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const b = await tx.tenantBranding.upsert({
        where: { tenantId: user.tenantId },
        create: { tenantId: user.tenantId, ...dto },
        update: { ...dto },
      });
      return toBrandingData(b);
    });
  }

  /** Dados cadastrais + plano da própria empresa (tela "Organização"). */
  @Get('organization')
  myOrganization(@CurrentUser() user: SessionUser): Promise<OrganizationData> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const o = await tx.organization.findUnique({ where: { id: user.tenantId } });
      return {
        name: o?.name ?? '',
        legalName: o?.legalName ?? null,
        taxId: o?.taxId ?? null,
        website: o?.website ?? null,
        phone: o?.phone ?? null,
        plan: o?.plan ?? 'BASE',
      };
    });
  }

  /**
   * Self-service: o admin edita os dados cadastrais da própria empresa. Gateado
   * por `branding:edit` (capacidade de admin da empresa) e escrito sob RLS.
   */
  @Put('organization')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('branding:edit')
  updateOrganization(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationData> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const o = await tx.organization.update({
        where: { id: user.tenantId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.legalName !== undefined ? { legalName: dto.legalName?.trim() || null } : {}),
          ...(dto.taxId !== undefined ? { taxId: dto.taxId?.trim() || null } : {}),
          ...(dto.website !== undefined ? { website: dto.website?.trim() || null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        },
      });
      return {
        name: o.name,
        legalName: o.legalName,
        taxId: o.taxId,
        website: o.website,
        phone: o.phone,
        plan: o.plan,
      };
    });
  }
}
