import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { LiderancaAdminService } from './lideranca.service';
import { CreateIcdCycleDto } from '../icd-cycles/dto';

/**
 * Módulos › Liderança (Super Admin) — rotas por empresa: /admin/tenants/:id/…
 * `:id` é Tenant.id (control plane); o service resolve o organizationId e
 * chama os MESMOS métodos de IcdCyclesService/PocketService do portal.
 * Só agregados com supressão n < 5 (§11/§13); abrir/fechar ciclo é auditado.
 */
@Controller('admin/tenants/:id')
@UseGuards(SuperAdminGuard)
export class LiderancaAdminController {
  constructor(private readonly svc: LiderancaAdminService) {}

  /** KPIs do painel + chip de liberação icd/lider/pocket + agregados do ciclo aberto. */
  @Get('lideranca/summary')
  summary(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.summary(id, { id: admin.id, email: admin.email });
  }

  /** Ciclos ICD da empresa (aba Aplicações e Ciclos). */
  @Get('icd-cycles')
  listCycles(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listCycles(id);
  }

  /** Abre um ciclo trimestral (só 1 OPEN por empresa — regra do service). */
  @Post('icd-cycles')
  createCycle(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIcdCycleDto,
  ) {
    return this.svc.createCycle(id, dto, { id: admin.id, email: admin.email });
  }

  // `history` antes de `:cycleId` (ParseUUIDPipe responderia 400 a "history").

  /** Série de ciclos com o resultado congelado (aba Resultados e Relatórios). */
  @Get('icd-cycles/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.history(id);
  }

  /** Resultado oficial de um ciclo (agregado; nunca por líder). */
  @Get('icd-cycles/:cycleId')
  official(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.official(id, cycleId);
  }

  /** Fecha o ciclo: congela LeaderQuarterlyIcd + CompanyQuarterlyIcd (§9.6). */
  @Post('icd-cycles/:cycleId/close')
  closeCycle(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.closeCycle(id, cycleId, { id: admin.id, email: admin.email });
  }

  /** Pocket agregado por dimensão + adesão (aba CRIVO Pocket™ / Resultados). */
  @Get('pocket/aggregate')
  pocketAggregate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cycleId', new ParseUUIDPipe({ optional: true })) cycleId?: string,
  ) {
    return this.svc.pocketAggregate(id, cycleId || undefined);
  }
}
