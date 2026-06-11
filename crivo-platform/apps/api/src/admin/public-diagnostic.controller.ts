import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformLeadsService } from './platform-leads.service';
import { CreateDiagnosticLeadDto } from './commerce.dto';

/**
 * Porta de entrada PÚBLICA do funil (sem auth). A Landing Page envia o
 * Diagnóstico Inicial (form + respostas) → calcula a leitura preliminar e cria
 * o lead no CRM do super admin. Rate-limited contra spam. Vive no módulo Admin
 * porque escreve no control plane (platform_leads, owner-only).
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
}
