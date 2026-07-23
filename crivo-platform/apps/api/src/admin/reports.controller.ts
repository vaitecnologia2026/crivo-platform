import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { ReportsAdminService } from './reports.service';

/** Motor 4 — Relatórios e Dossiês (R-001). Repositório + revisão. Super admin. */
@Controller('admin/reports')
@UseGuards(SuperAdminGuard)
export class ReportsAdminController {
  constructor(private readonly svc: ReportsAdminService) {}

  @Get('overview')
  overview() {
    return this.svc.overview();
  }

  @Get('emissions')
  list() {
    return this.svc.list();
  }

  @Get('emissions/:id')
  get(@Param('id') id: string, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.get(id, { id: admin.id, email: admin.email });
  }

  @Post('emissions/:id/review')
  review(@Param('id') id: string, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.review(id, { id: admin.id, email: admin.email });
  }
}
