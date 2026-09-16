import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { type SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { Roles } from '../iam/roles.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { InvisibleCostsService } from './invisible-costs.service';
import { CreateCostSnapshotDto, SaveInvisibleCostsDto } from './dto';

const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/**
 * Custos Invisíveis (Fase 2). Estimativa gerencial por empresa — só gestão/RH
 * (módulo premium), atrás do guard de tela 'custo'.
 */
@Controller('invisible-costs')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, ScreenAccessGuard)
@RequireModule('custo')
@RequireScreen('custo')
export class InvisibleCostsController {
  constructor(private readonly svc: InvisibleCostsService) {}

  @Get()
  @Roles(...ROLES)
  get(@CurrentUser() user: SessionUser) {
    return this.svc.get(user.tenantId);
  }

  @Put()
  @Roles(...ROLES)
  save(@CurrentUser() user: SessionUser, @Body() dto: SaveInvisibleCostsDto) {
    return this.svc.save(user.tenantId, dto, user.email);
  }

  /** Histórico congelado (aba Histórico — "Evolução do total"). */
  @Get('snapshots')
  @Roles(...ROLES)
  listSnapshots(@CurrentUser() user: SessionUser) {
    return this.svc.listSnapshots(user.tenantId);
  }

  /** "Congelar como ciclo": copia a estimativa salva com os totais do momento. */
  @Post('snapshots')
  @Roles(...ROLES)
  createSnapshot(@CurrentUser() user: SessionUser, @Body() dto: CreateCostSnapshotDto) {
    return this.svc.createSnapshot(user.tenantId, dto, { id: user.id, name: user.name, email: user.email });
  }
}
