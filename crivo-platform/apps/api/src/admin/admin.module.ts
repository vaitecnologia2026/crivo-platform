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
import { ContractsService } from './contracts.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { PlatformLeadsController } from './platform-leads.controller';
import { PlatformLeadsService } from './platform-leads.service';
import { PublicDiagnosticController } from './public-diagnostic.controller';
import { AuditService } from './audit.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PreliminaryReportsController } from './preliminary-reports.controller';
import { PreliminaryReportsService } from './preliminary-reports.service';
import {
  ActionTemplatesController,
  EditableTextsController,
  GlobalAcademyController,
  MentoriasController,
} from './super-admin-extras.controller';
import { MentoriasService } from './mentorias.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { ActionTemplatesService } from './action-templates.service';
import { EditableTextsService } from './editable-texts.service';
import { GlobalAcademyService } from './global-academy.service';
import { MeteringModule } from '../metering/metering.module';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { MethodologyController } from './methodology.controller';
import { MethodologyService } from './methodology.service';
import { BenchmarksController } from './benchmarks.controller';
import { BenchmarksService } from './benchmarks.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AddonsController } from './addons.controller';
import { AddonsService } from './addons.service';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { AiPromptsController } from './ai-prompts.controller';
import { AiPromptsService } from './ai-prompts.service';
import { ContractsController } from './contracts.controller';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformUsersService } from './platform-users.service';

/**
 * Control Plane (F1) — super admin global + gestão/provisionamento de tenants.
 * Usa o JwtModule global (registrado no IamModule) e a conexão owner do
 * PrismaService. Rotas sob /admin/* (após o prefixo /api).
 */
@Module({
  imports: [MeteringModule],
  controllers: [
    AdminAuthController,
    TenantsController,
    PublicResolutionController,
    AdminOverviewController,
    ProductsController,
    PlatformLeadsController,
    PublicDiagnosticController,
    AiSettingsController,
    PreliminaryReportsController,
    MentoriasController,
    ActionTemplatesController,
    EditableTextsController,
    GlobalAcademyController,
    AdminUsersController,
    EngineController,
    InstrumentsController,
    IntegrationsController,
    MethodologyController,
    BenchmarksController,
    GroupsController,
    DashboardController,
    AddonsController,
    IntelligenceController,
    AiPromptsController,
    ContractsController,
    PlatformUsersController,
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
    ContractsService,
    AiSettingsService,
    AuditService,
    SuperAdminGuard,
    PreliminaryReportsService,
    MentoriasService,
    AdminUsersService,
    ActionTemplatesService,
    EditableTextsService,
    GlobalAcademyService,
    EngineService,
    InstrumentsService,
    IntegrationsService,
    MethodologyService,
    BenchmarksService,
    GroupsService,
    DashboardService,
    AddonsService,
    IntelligenceService,
    AiPromptsService,
    PlatformUsersService,
  ],
  exports: [AiSettingsService, EditableTextsService, AuditService, GroupsService, AiPromptsService],
})
export class AdminModule {}
