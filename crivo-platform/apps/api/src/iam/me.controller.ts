import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { CurrentUser } from './current-user.decorator';
import { ModuleService } from './module.service';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBrandingDto } from '../admin/dto';
import type { TenantBranding } from '@crivo/db';
import { TERMS_VERSION, type SessionUser, type TenantBrandingData, type TermsStatus } from '@crivo/types';

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
  ) {}

  /** Códigos dos módulos ativos da empresa do usuário (alimenta o menu). */
  @Get('modules')
  async myModules(@CurrentUser() user: SessionUser): Promise<string[]> {
    return [...(await this.modules.enabledFor(user.tenantId))];
  }

  /** Permissões efetivas (modulo:acao) do papel do usuário — filtra o menu. */
  @Get('permissions')
  async myPermissions(@CurrentUser() user: SessionUser): Promise<string[]> {
    return [...(await this.permissions.effectiveForRole(user.role))];
  }

  /** Papel do usuário logado — define a HOME inicial e a área padrão (#51). */
  @Get('role')
  myRole(@CurrentUser() user: SessionUser): { role: string; name: string } {
    return { role: user.role, name: user.name };
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
}
