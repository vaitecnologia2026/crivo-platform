import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
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
import { SaveInvisibleCostsDto } from './dto';

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
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR')
  get(@CurrentUser() user: SessionUser) {
    return this.svc.get(user.tenantId);
  }

  @Put()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR')
  save(@CurrentUser() user: SessionUser, @Body() dto: SaveInvisibleCostsDto) {
    return this.svc.save(user.tenantId, dto, user.email);
  }
}
