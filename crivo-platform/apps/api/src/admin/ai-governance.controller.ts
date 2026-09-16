import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { AiGovernanceAdminService } from './ai-governance.service';
import { normalizeDue } from '../ai-governance/ai-governance.controller';

/**
 * Módulos › Governança de IA (Super Admin) — rotas por empresa:
 * /admin/tenants/:id/ai-governance/… `:id` é Tenant.id (control plane); o
 * service resolve o organizationId e chama as MESMAS leituras do
 * AiGovernanceService do portal. SOMENTE GET: a CRIVO acompanha, não decide.
 */
@Controller('admin/tenants/:id/ai-governance')
@UseGuards(SuperAdminGuard)
export class AiGovernanceAdminController {
  constructor(private readonly svc: AiGovernanceAdminService) {}

  /** KPIs + chip de liberação 'govia' (auditado: ai_governance.view). */
  @Get('summary')
  summary(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.summary(id, { id: admin.id, email: admin.email });
  }

  @Get('use-cases')
  useCases(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('area') area?: string,
    @Query('risk') risk?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listUseCases(id, { area, risk, status });
  }

  @Get('use-cases/:useCaseId')
  useCase(@Param('id', ParseUUIDPipe) id: string, @Param('useCaseId', ParseUUIDPipe) useCaseId: string) {
    return this.svc.getUseCase(id, useCaseId);
  }

  @Get('decisions')
  decisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listDecisions(id);
  }

  @Get('incidents')
  incidents(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listIncidents(id);
  }

  @Get('policies')
  policies(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listPolicies(id);
  }

  @Get('reviews')
  reviews(@Param('id', ParseUUIDPipe) id: string, @Query('due') due?: string) {
    return this.svc.reviews(id, normalizeDue(due));
  }
}
