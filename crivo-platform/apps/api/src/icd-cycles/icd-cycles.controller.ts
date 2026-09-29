import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuditService } from '../admin/audit.service';
import { IcdCyclesService } from './icd-cycles.service';
import { CreateIcdCycleDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { LeaderGuard } from '../iam/guards/leader.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

// Ciclos do ICD oficial: mesmo módulo do ICD (gate F4, padrão parecer.controller).
// ScreenAccessGuard só restringe as rotas que declaram @RequireScreen (as da
// tela Liderança); `current` e `current/me` alimentam Dashboard e Área do
// Líder, então ficam sem tela declarada. `me` e `current/me` são o ICD PRÓPRIO
// (Minha Jornada): exigem ser líder (LeaderGuard, Spec V1 v1.2 §3).
@Controller('icd-cycles')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, ScreenAccessGuard)
@RequireModule('icd')
export class IcdCyclesController {
  constructor(
    private readonly cycles: IcdCyclesService,
    // S12-09: abrir/fechar ciclo do ICD é mudança crítica (Anexo v1.1 §7).
    private readonly audit: AuditService,
  ) {}

  /** Lista ciclos do tenant (RH/GESTOR/CEO/ADMIN). */
  @Get()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  list(@CurrentUser() user: SessionUser) {
    return this.cycles.list(user.tenantId);
  }

  /** Abre um novo ciclo trimestral. Apenas 1 OPEN por tenant. */
  @Post()
  @Roles('RH', 'CEO', 'ADMIN')
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateIcdCycleDto) {
    const cycle = await this.cycles.create(user.tenantId, dto);
    await this.audit.record({
      action: 'icd.cycle.open',
      actor: { id: user.id, email: user.email },
      tenantId: user.tenantId,
      target: cycle.id,
      meta: { role: user.role, name: cycle.name, startsAt: cycle.startsAt, endsAt: cycle.endsAt },
    });
    return cycle;
  }

  /** PARCIAL: ICD da empresa em tempo real (ciclo aberto). RH/CEO/ADMIN. */
  @Get('current')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  current(@CurrentUser() user: SessionUser) {
    return this.cycles.partialCompanyIcd(user.tenantId);
  }

  /** PARCIAL: ICD do PRÓPRIO líder no ciclo aberto (§11 — sem dados de pares). */
  @Get('current/me')
  @UseGuards(LeaderGuard)
  myPartial(@CurrentUser() user: SessionUser) {
    return this.cycles.myPartialIcd(user.tenantId, user.id);
  }

  /** Área do Líder: ICD do PRÓPRIO líder (ciclo aberto ou último fechado). */
  @Get('me')
  @UseGuards(LeaderGuard)
  meuIcd(@CurrentUser() user: SessionUser) {
    return this.cycles.meuIcd(user.tenantId, user.id);
  }

  // Rotas fixas ANTES de `:id` (o ParseUUIDPipe do `:id` responderia 400 a
  // "history" e "current/summary" se fossem declaradas depois).

  /** Tela Liderança — KPIs agregados do ciclo aberto (supressão §11). */
  @Get('current/summary')
  @RequireScreen('icd')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  summary(@CurrentUser() user: SessionUser) {
    return this.cycles.summary(user.tenantId);
  }

  /** Tela Liderança — série "Evolução do ICD" por ciclo (só o congelado no fechamento). */
  @Get('history')
  @RequireScreen('icd')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  history(@CurrentUser() user: SessionUser) {
    return this.cycles.history(user.tenantId);
  }

  /** FECHAMENTO trimestral (§9.6) — congela leader + company quarterly. */
  @Post(':id/close')
  @Roles('RH', 'CEO', 'ADMIN')
  async close(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const cycle = await this.cycles.close(user.tenantId, id);
    await this.audit.record({
      action: 'icd.cycle.close',
      actor: { id: user.id, email: user.email },
      tenantId: user.tenantId,
      target: id,
      meta: { role: user.role, name: cycle.name, closedAt: cycle.closedAt },
    });
    return cycle;
  }

  /** Lê o resultado oficial de um ciclo (qualquer status). RH/GESTOR/CEO/ADMIN. */
  @Get(':id')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  official(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cycles.official(user.tenantId, id);
  }
}
