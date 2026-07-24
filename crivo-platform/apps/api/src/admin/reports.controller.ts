import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { ReportsAdminService, type UpsertReportTemplate } from './reports.service';

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

  // ── Modelos de relatório (vinculados ao Motor de Diagnósticos) ────────────
  // Declarados ANTES de 'emissions/:id' não é necessário (prefixos distintos),
  // mas mantidos agrupados para leitura.

  @Get('templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  /** Diagnósticos disponíveis para vincular (catálogo do Motor). */
  @Get('templates/instruments')
  instrumentOptions() {
    return this.svc.listInstrumentOptions();
  }

  @Post('templates')
  createTemplate(@Body() dto: UpsertReportTemplate, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.createTemplate(dto, { id: admin.id, email: admin.email });
  }

  @Put('templates/:id')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpsertReportTemplate,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.updateTemplate(id, dto, { id: admin.id, email: admin.email });
  }

  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.removeTemplate(id, { id: admin.id, email: admin.email });
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
