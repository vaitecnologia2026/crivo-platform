import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

/** Dashboard de Gestão CRIVO (Caderno Tela 01). Control plane, só super admin. */
@Controller('admin/dashboard')
@UseGuards(SuperAdminGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Indicadores operacionais. `days` = período (1–365, padrão 30).
   *  Filtros opcionais (Tela 01 · [6]): origem, groupId, tenantId. */
  @Get()
  get(
    @Query('days') days?: string,
    @Query('origem') origem?: string,
    @Query('groupId') groupId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return this.dashboard.build(d, {
      origem: origem?.trim() || undefined,
      groupId: groupId?.trim() || undefined,
      tenantId: tenantId?.trim() || undefined,
    });
  }
}
