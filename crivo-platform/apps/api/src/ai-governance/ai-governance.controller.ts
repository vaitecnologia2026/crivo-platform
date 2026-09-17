import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AiReviewDue, SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequirePermission } from '../iam/require-permission.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { AiGovernanceService } from './ai-governance.service';
import {
  AddAiUseCaseLinkDto,
  CreateAiIncidentDto,
  CreateAiPolicyDto,
  DecideAiUseCaseDto,
  UpdateAiIncidentDto,
  UpdateAiPolicyDto,
  UpsertAiUseCaseDto,
} from './dto';

/** Papéis de gestão que enxergam o programa (o LIDER fica fora por papel, não por lista de features). */
const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/**
 * Programas › Governança de IA (rota 'govia' do portal). Padrão completo de
 * guards do parecer.controller: sessão + módulo 'govia' ativo no contrato +
 * papel de gestão + tela liberada na checklist do usuário. Leitura é por papel;
 * toda ESCRITA (cadastro, decisão, vínculos, incidentes, políticas) exige a
 * permissão govia:manage (RH/GESTOR/CEO/ADMIN por padrão; Consultor CRIVO só lê).
 */
@Controller('ai-governance')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard)
@RequireModule('govia')
@RequireScreen('govia')
@Roles(...ROLES)
export class AiGovernanceController {
  constructor(private readonly svc: AiGovernanceService) {}

  private actor(user: SessionUser) {
    return { id: user.id, name: user.name, email: user.email };
  }

  @Get('summary')
  summary(@CurrentUser() user: SessionUser) {
    return this.svc.summary(user.tenantId);
  }

  // ── Casos de uso ──

  @Get('use-cases')
  listUseCases(
    @CurrentUser() user: SessionUser,
    @Query('area') area?: string,
    @Query('risk') risk?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listUseCases(user.tenantId, { area, risk, status });
  }

  @Post('use-cases')
  @RequirePermission('govia:manage')
  createUseCase(@CurrentUser() user: SessionUser, @Body() dto: UpsertAiUseCaseDto) {
    return this.svc.createUseCase(user.tenantId, dto, this.actor(user));
  }

  @Get('use-cases/:id')
  getUseCase(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getUseCase(user.tenantId, id);
  }

  @Put('use-cases/:id')
  @RequirePermission('govia:manage')
  updateUseCase(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAiUseCaseDto,
  ) {
    return this.svc.updateUseCase(user.tenantId, id, dto, this.actor(user));
  }

  /** Decisão humana (Aprovar/Condicionar/Restringir/Rejeitar) — justificativa obrigatória, trilha + auditoria. */
  @Post('use-cases/:id/decision')
  @RequirePermission('govia:manage')
  decide(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideAiUseCaseDto,
  ) {
    return this.svc.decide(user.tenantId, id, dto, this.actor(user));
  }

  @Post('use-cases/:id/links')
  @RequirePermission('govia:manage')
  addLink(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAiUseCaseLinkDto,
  ) {
    return this.svc.addLink(user.tenantId, id, dto);
  }

  @Delete('use-cases/:id/links/:linkId')
  @RequirePermission('govia:manage')
  removeLink(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.svc.removeLink(user.tenantId, id, linkId);
  }

  // ── Aprovações (trilha de decisões) ──

  @Get('decisions')
  listDecisions(@CurrentUser() user: SessionUser) {
    return this.svc.listDecisions(user.tenantId);
  }

  // ── Incidentes ──

  @Get('incidents')
  listIncidents(@CurrentUser() user: SessionUser) {
    return this.svc.listIncidents(user.tenantId);
  }

  @Post('incidents')
  @RequirePermission('govia:manage')
  createIncident(@CurrentUser() user: SessionUser, @Body() dto: CreateAiIncidentDto) {
    return this.svc.createIncident(user.tenantId, dto, this.actor(user));
  }

  @Patch('incidents/:id')
  @RequirePermission('govia:manage')
  updateIncident(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiIncidentDto,
  ) {
    return this.svc.updateIncident(user.tenantId, id, dto, this.actor(user));
  }

  // ── Políticas ──

  @Get('policies')
  listPolicies(@CurrentUser() user: SessionUser) {
    return this.svc.listPolicies(user.tenantId);
  }

  @Post('policies')
  @RequirePermission('govia:manage')
  createPolicy(@CurrentUser() user: SessionUser, @Body() dto: CreateAiPolicyDto) {
    return this.svc.createPolicy(user.tenantId, dto, this.actor(user));
  }

  @Patch('policies/:id')
  @RequirePermission('govia:manage')
  updatePolicy(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiPolicyDto,
  ) {
    return this.svc.updatePolicy(user.tenantId, id, dto, this.actor(user));
  }

  // ── Revisões (derivadas de nextReviewAt) ──

  @Get('reviews')
  reviews(@CurrentUser() user: SessionUser, @Query('due') due?: string) {
    return this.svc.reviews(user.tenantId, normalizeDue(due));
  }
}

/** `due` fora do vocabulário vira 'all' (nunca 400 numa leitura de agenda). */
export function normalizeDue(due?: string): AiReviewDue {
  return due === 'overdue' || due === '30d' ? due : 'all';
}
