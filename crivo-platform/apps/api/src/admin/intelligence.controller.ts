import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { IntelligenceService } from './intelligence.service';

/**
 * Inteligência CRIVO (Caderno §10) — camada analítica por cliente/CNPJ.
 * Super admin only. Isolamento por CNPJ via forTenant(organizationId) no service.
 */
@Controller('admin/intelligence')
@UseGuards(SuperAdminGuard)
export class IntelligenceController {
  constructor(private readonly svc: IntelligenceService) {}

  /** Empresas selecionáveis (filtro por CNPJ). */
  @Get('companies')
  companies() {
    return this.svc.listCompanies();
  }

  /** Visão analítica cruzada de um cliente (por Tenant.id → organizationId). */
  @Get(':tenantId/overview')
  overview(
    @Param('tenantId') tenantId: string,
    @CurrentAdmin() admin: PlatformAdmin,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.overview(tenantId, { id: admin.id, email: admin.email }, { from, to });
  }
}
