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

  /** Trilha de auditoria das ações de plataforma. */
  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.tenants.recentAudit(limit ? Number(limit) : 30);
  }
}
