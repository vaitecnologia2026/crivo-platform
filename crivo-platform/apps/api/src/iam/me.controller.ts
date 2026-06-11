import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ModuleService } from './module.service';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser, TenantBrandingData } from '@crivo/types';

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

  /** Identidade visual (white-label, F5) da empresa — lida sob RLS. */
  @Get('branding')
  myBranding(@CurrentUser() user: SessionUser): Promise<TenantBrandingData> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const b = await tx.tenantBranding.findUnique({ where: { tenantId: user.tenantId } });
      return {
        logoUrl: b?.logoUrl ?? null,
        faviconUrl: b?.faviconUrl ?? null,
        primaryColor: b?.primaryColor ?? null,
        accentColor: b?.accentColor ?? null,
        emailFrom: b?.emailFrom ?? null,
        whatsapp: b?.whatsapp ?? null,
        footerText: b?.footerText ?? null,
      };
    });
  }
}
