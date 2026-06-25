import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { type SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { Roles } from '../iam/roles.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { PeopleAnalyticsService } from './people-analytics.service';
import { AnalyzePeopleDto, SavePeopleAnalyticsDto } from './dto';

const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/** People Analytics (Fase 4) — indicadores de RH + IA Analítica. Só gestão/RH. */
@Controller('people-analytics')
@UseGuards(AuthGuard, RolesGuard, ScreenAccessGuard)
@RequireScreen('analytics')
export class PeopleAnalyticsController {
  constructor(private readonly svc: PeopleAnalyticsService) {}

  @Get()
  @Roles(...ROLES)
  get(@CurrentUser() user: SessionUser) {
    return this.svc.get(user.tenantId);
  }

  @Put()
  @Roles(...ROLES)
  save(@CurrentUser() user: SessionUser, @Body() dto: SavePeopleAnalyticsDto) {
    return this.svc.save(user.tenantId, dto, user.email);
  }

  @Post('analyze')
  @Roles(...ROLES)
  analyze(@CurrentUser() user: SessionUser, @Body() dto: AnalyzePeopleDto) {
    return this.svc.analyze(user.tenantId, dto.context, user.email);
  }
}
