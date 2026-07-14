import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DiagnosticsService } from './diagnostics.service';
import { SubmitDiagnosticDto } from './dto';

/**
 * Endpoint PÚBLICO — SEM AuthGuard. Aplicação anônima de diagnósticos do
 * CATÁLOGO via link /d/<slug> (motor dinâmico). Mesmo desenho do psicossocial:
 * resolve slug→empresa e grava sob a RLS do tenant, sem expor dados internos.
 */
@Controller('public/diagnostics')
export class PublicDiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get(':slug')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getBySlug(@Param('slug') slug: string) {
    return this.diagnostics.getPublicBySlug(slug);
  }

  @Post(':slug')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  submit(@Param('slug') slug: string, @Body() dto: SubmitDiagnosticDto) {
    return this.diagnostics.submitPublic(slug, dto);
  }
}
