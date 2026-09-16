import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

/** Métricas e auditoria do control plane — exclusivo de super admins. */
@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminOverviewController {
  constructor(private readonly tenants: TenantsService) {}

  /** KPIs da plataforma (empresas por status/plano, usuários, leads). */
  @Get('overview')
  overview() {
    return this.tenants.overview();
  }

  /** Trilha de auditoria das ações de plataforma. Filtros opcionais:
   *  `tenantId` (organizationId da empresa) e `prefix` (prefixos de ação
   *  separados por vírgula, ex.: "icd.,pocket.,lideranca."). */
  @Get('audit')
  audit(
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
    @Query('prefix') prefix?: string,
  ) {
    return this.tenants.recentAudit(limit ? Number(limit) : 30, {
      tenantId: tenantId || undefined,
      prefixes: prefix ? prefix.split(',').map((p) => p.trim()).filter(Boolean) : undefined,
    });
  }
}
