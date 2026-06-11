import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ProvisioningService } from './provisioning.service';
import { TenantModulesService } from './tenant-modules.service';
import { TenantBrandingService } from './tenant-branding.service';
import { DomainsService } from './domains.service';
import { PublicResolutionController } from './public-resolution.controller';
import { AdminOverviewController } from './admin-overview.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PlatformLeadsController } from './platform-leads.controller';
import { PlatformLeadsService } from './platform-leads.service';
import { PublicDiagnosticController } from './public-diagnostic.controller';
import { AuditService } from './audit.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

/**
 * Control Plane (F1) — super admin global + gestão/provisionamento de tenants.
 * Usa o JwtModule global (registrado no IamModule) e a conexão owner do
 * PrismaService. Rotas sob /admin/* (após o prefixo /api).
 */
@Module({
  controllers: [
    AdminAuthController,
    TenantsController,
    PublicResolutionController,
    AdminOverviewController,
    ProductsController,
    PlatformLeadsController,
    PublicDiagnosticController,
  ],
  providers: [
    AdminAuthService,
    TenantsService,
    ProvisioningService,
    TenantModulesService,
    TenantBrandingService,
    DomainsService,
    ProductsService,
    PlatformLeadsService,
    AuditService,
    SuperAdminGuard,
  ],
})
export class AdminModule {}
