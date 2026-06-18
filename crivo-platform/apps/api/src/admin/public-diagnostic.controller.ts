import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformLeadsService } from './platform-leads.service';
import { CreateDiagnosticLeadDto, CreateSimpleLeadDto } from './commerce.dto';

/**
 * Porta de entrada PÚBLICA do funil (sem auth). A Landing Page envia o
 * Diagnóstico Inicial (form + respostas) ou os formulários de contato/e-book →
 * cria o lead no CRM do super admin. Rate-limited contra spam. Vive no módulo
 * Admin porque escreve no control plane (platform_leads, owner-only).
 */
@Controller('public')
export class PublicDiagnosticController {
  constructor(private readonly leads: PlatformLeadsService) {}

  /** POST /api/public/diagnostic-lead → { ok, result }. */
  @Post('diagnostic-lead')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  submit(@Body() dto: CreateDiagnosticLeadDto) {
    return this.leads.intakeDiagnostic(dto);
  }

  /** POST /api/public/lead → { ok, id }. Form de contato/e-book da LP (sem diagnóstico). */
  @Post('lead')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  lead(@Body() dto: CreateSimpleLeadDto) {
    return this.leads.intakeLead(dto);
  }
}
