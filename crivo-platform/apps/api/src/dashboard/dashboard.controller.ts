import { Controller, Get, UseGuards } from '@nestjs/common';
import { PortalDashboardService } from './portal-dashboard.service';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { Roles } from '../iam/roles.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { type SessionUser } from '@crivo/types';

/** Dados que a Visão Geral do portal precisa e nenhum outro endpoint entrega. */
@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard, ScreenAccessGuard)
export class DashboardController {
  constructor(private readonly dashboard: PortalDashboardService) {}

  /**
   * Resultado agregado do diagnóstico contratado.
   *
   * `essencial` no RequireScreen porque a tela do Essencial mostra o MESMO
   * bloco: quem tem só ela na checklist continua vendo o resultado. Os papéis
   * espelham `/psychosocial/results` — resultado agregado é leitura de gestão
   * (§14), não de quem respondeu.
   */
  @Get('diagnostic')
  @RequireScreen('dashboard', 'essencial')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR')
  diagnostic(@CurrentUser() user: SessionUser) {
    return this.dashboard.diagnostic(user.tenantId);
  }
}
