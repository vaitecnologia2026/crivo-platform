import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
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
import { WorkforceService } from './workforce.service';
import {
  DecideWorkTaskDto,
  SaveWorkSkillsDto,
  UpdateWorkPilotDto,
  UpsertWorkPilotDto,
  UpsertWorkProcessDto,
  UpsertWorkTaskDto,
} from './dto';

/** Papéis de gestão que enxergam o programa (o LIDER fica fora por papel, não por lista de features). */
const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/**
 * Programas › Workforce Intelligence (rota 'workforce' do portal). Padrão
 * completo de guards do parecer.controller: sessão + módulo 'workforce' ativo
 * no contrato + papel de gestão + tela liberada na checklist do usuário.
 * Leitura é por papel; toda ESCRITA (processos, tarefas, skills, pilotos e a
 * decisão humana por tarefa) exige a permissão workforce:manage
 * (RH/GESTOR/CEO/ADMIN por padrão; Consultor CRIVO só lê — ele alimenta pelo
 * Super Admin). A validação CRIVO NÃO existe aqui: é rota do admin.
 */
@Controller('workforce')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard)
@RequireModule('workforce')
@RequireScreen('workforce')
@Roles(...ROLES)
export class WorkforceController {
  constructor(private readonly svc: WorkforceService) {}

  private actor(user: SessionUser) {
    return { id: user.id, name: user.name, email: user.email };
  }

  @Get('summary')
  summary(@CurrentUser() user: SessionUser) {
    return this.svc.summary(user.tenantId);
  }

  // ── Processos ──

  @Get('processes')
  listProcesses(@CurrentUser() user: SessionUser) {
    return this.svc.listProcesses(user.tenantId);
  }

  @Post('processes')
  @RequirePermission('workforce:manage')
  createProcess(@CurrentUser() user: SessionUser, @Body() dto: UpsertWorkProcessDto) {
    return this.svc.createProcess(user.tenantId, dto);
  }

  @Put('processes/:id')
  @RequirePermission('workforce:manage')
  updateProcess(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertWorkProcessDto) {
    return this.svc.updateProcess(user.tenantId, id, dto);
  }

  // ── Tarefas ──

  @Get('tasks')
  listTasks(
    @CurrentUser() user: SessionUser,
    @Query('area') area?: string,
    @Query('risk') risk?: string,
    @Query('stage') stage?: string,
    @Query('processId') processId?: string,
    @Query('scenario') scenario?: string,
  ) {
    return this.svc.listTasks(user.tenantId, { area, risk, stage, processId, scenario });
  }

  @Get('tasks/:id')
  getTask(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getTask(user.tenantId, id);
  }

  @Post('tasks')
  @RequirePermission('workforce:manage')
  createTask(@CurrentUser() user: SessionUser, @Body() dto: UpsertWorkTaskDto) {
    return this.svc.createTask(user.tenantId, dto);
  }

  @Put('tasks/:id')
  @RequirePermission('workforce:manage')
  updateTask(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertWorkTaskDto) {
    return this.svc.updateTask(user.tenantId, id, dto);
  }

  /** Decisão humana (Aceitar/Condicionar/Devolver/Rejeitar) — persiste quem/quando + auditoria. */
  @Post('tasks/:id/decision')
  @RequirePermission('workforce:manage')
  decide(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideWorkTaskDto) {
    return this.svc.decideTask(user.tenantId, id, dto, this.actor(user));
  }

  // ── Skills ──

  @Get('skills')
  listSkills(@CurrentUser() user: SessionUser) {
    return this.svc.listSkills(user.tenantId);
  }

  @Put('skills')
  @RequirePermission('workforce:manage')
  saveSkills(@CurrentUser() user: SessionUser, @Body() dto: SaveWorkSkillsDto) {
    return this.svc.saveSkills(user.tenantId, dto);
  }

  // ── Pilotos e blueprints ──

  @Get('pilots')
  listPilots(@CurrentUser() user: SessionUser) {
    return this.svc.listPilots(user.tenantId);
  }

  @Post('pilots')
  @RequirePermission('workforce:manage')
  createPilot(@CurrentUser() user: SessionUser, @Body() dto: UpsertWorkPilotDto) {
    return this.svc.createPilot(user.tenantId, dto, this.actor(user));
  }

  @Patch('pilots/:id')
  @RequirePermission('workforce:manage')
  updatePilot(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkPilotDto) {
    return this.svc.updatePilot(user.tenantId, id, dto, this.actor(user));
  }
}
