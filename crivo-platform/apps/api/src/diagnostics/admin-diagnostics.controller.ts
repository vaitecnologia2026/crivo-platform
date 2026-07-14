import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { DiagnosticsService } from './diagnostics.service';
import { EnsureDiagnosticLinkDto } from './dto';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { CurrentAdmin } from '../admin/platform-admin.decorator';

/** Aplicação de diagnósticos do catálogo — visão do super admin. Owner-only. */
@Controller('admin/diagnostics')
@UseGuards(SuperAdminGuard)
export class AdminDiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  /** Gera (idempotente) o link público de um instrumento para uma empresa. */
  @Post('links')
  ensureLink(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: EnsureDiagnosticLinkDto) {
    return this.diagnostics.ensureLink(dto.tenantId, dto.instrumentSlug, { id: admin.id, email: admin.email });
  }

  /** Links existentes de um instrumento (com contagem de respondentes). */
  @Get('links')
  listLinks(@Query('instrument') instrument: string) {
    return this.diagnostics.listLinks(instrument ?? '');
  }

  /** Agregado (com supressão) de uma empresa em um instrumento. */
  @Get('results/:tenantId/:instrumentSlug')
  results(@Param('tenantId') tenantId: string, @Param('instrumentSlug') instrumentSlug: string) {
    return this.diagnostics.results(tenantId, instrumentSlug);
  }
}
