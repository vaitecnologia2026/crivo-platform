import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

/** Dashboard de Gestão CRIVO (Caderno Tela 01). Control plane, só super admin. */
@Controller('admin/dashboard')
@UseGuards(SuperAdminGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Indicadores operacionais. `days` = janela do período (1–365, padrão 30). */
  @Get()
  get(@Query('days') days?: string) {
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return this.dashboard.build(d);
  }
}
