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
import { PeopleAnalyticsService } from './people-analytics.service';
import { AnalyzePeopleDto, SavePeopleAnalyticsDto, SavePeopleCatalogDto } from './dto';

const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/** People Analytics (Fase 4) — indicadores de RH + IA Analítica. Só gestão/RH.
 *  Gate de módulo "analytics" (F4): a liberação por contrato passa a valer na API. */
@Controller('people-analytics')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, ScreenAccessGuard)
@RequireModule('analytics')
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

  /** Catálogo de indicadores (metadados de governança + customizados). */
  @Get('catalog')
  @Roles(...ROLES)
  getCatalog(@CurrentUser() user: SessionUser) {
    return this.svc.getCatalog(user.tenantId);
  }

  /** Grava o catálogo; 'Score metodológico' é read-only (validado no serviço). */
  @Put('catalog')
  @Roles(...ROLES)
  saveCatalog(@CurrentUser() user: SessionUser, @Body() dto: SavePeopleCatalogDto) {
    return this.svc.saveCatalog(user.tenantId, dto, user.email);
  }
}
