import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IcdCyclesService } from './icd-cycles.service';
import { CreateIcdCycleDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

@Controller('icd-cycles')
@UseGuards(AuthGuard, RolesGuard)
export class IcdCyclesController {
  constructor(private readonly cycles: IcdCyclesService) {}

  /** Lista ciclos do tenant (RH/GESTOR/CEO/ADMIN). */
  @Get()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  list(@CurrentUser() user: SessionUser) {
    return this.cycles.list(user.tenantId);
  }

  /** Abre um novo ciclo trimestral. Apenas 1 OPEN por tenant. */
  @Post()
  @Roles('RH', 'CEO', 'ADMIN')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateIcdCycleDto) {
    return this.cycles.create(user.tenantId, dto);
  }

  /** PARCIAL: ICD da empresa em tempo real (ciclo aberto). RH/CEO/ADMIN. */
  @Get('current')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  current(@CurrentUser() user: SessionUser) {
    return this.cycles.partialCompanyIcd(user.tenantId);
  }

  /** PARCIAL: ICD do PRÓPRIO líder no ciclo aberto (§11 — sem dados de pares). */
  @Get('current/me')
  myPartial(@CurrentUser() user: SessionUser) {
    return this.cycles.myPartialIcd(user.tenantId, user.id);
  }

  /** FECHAMENTO trimestral (§9.6) — congela leader + company quarterly. */
  @Post(':id/close')
  @Roles('RH', 'CEO', 'ADMIN')
  close(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cycles.close(user.tenantId, id);
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
