import { Controller, Get, UseGuards } from '@nestjs/common';
import { type SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { AlertsService } from './alerts.service';

/**
 * Central de Notificações & Travas (§12). Visão operacional do tenant — papéis de
 * gestão (quem é dono do plano de ação). Não é uma "tela de módulo", então não passa
 * pelo ScreenAccessGuard: é um overlay do Dashboard.
 */
@Controller('alerts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  get(@CurrentUser() user: SessionUser) {
    return this.alerts.get(user.tenantId);
  }
}
