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
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { WorkforceAdminService } from './workforce.service';
import {
  SaveWorkSkillsDto,
  UpdateWorkPilotDto,
  UpsertWorkPilotDto,
  UpsertWorkProcessDto,
  UpsertWorkTaskDto,
  ValidateWorkTaskDto,
} from '../workforce/dto';

/**
 * Módulos › Workforce Intelligence (Super Admin) — rotas por empresa:
 * /admin/tenants/:id/workforce/… `:id` é Tenant.id (control plane); o service
 * resolve o organizationId e usa o MESMO WorkforceService do portal. Aqui a
 * equipe CRIVO alimenta (processos, tarefas, skills, pilotos) e VALIDA
 * tarefas; a decisão humana continua sendo do cliente, no portal.
 */
@Controller('admin/tenants/:id/workforce')
@UseGuards(SuperAdminGuard)
export class WorkforceAdminController {
  constructor(private readonly svc: WorkforceAdminService) {}

  private actor(admin: PlatformAdmin) {
    return { id: admin.id, name: admin.name, email: admin.email };
  }

  /** KPIs + chip de liberação 'workforce' (auditado: workforce.view). */
  @Get('summary')
  summary(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.summary(id, this.actor(admin));
  }

  // ── Processos ──

  @Get('processes')
  processes(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listProcesses(id);
  }

  @Post('processes')
  createProcess(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertWorkProcessDto) {
    return this.svc.createProcess(id, dto, this.actor(admin));
  }

  /** Linhas do "Detalhamento por processo" (export CSV): processo + tarefas. */
  @Get('processes/:processId/detail')
  processDetail(@Param('id', ParseUUIDPipe) id: string, @Param('processId', ParseUUIDPipe) processId: string) {
    return this.svc.processDetail(id, processId);
  }

  @Put('processes/:processId')
  updateProcess(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('processId', ParseUUIDPipe) processId: string,
    @Body() dto: UpsertWorkProcessDto,
  ) {
    return this.svc.updateProcess(id, processId, dto, this.actor(admin));
  }

  @Delete('processes/:processId')
  deleteProcess(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Param('processId', ParseUUIDPipe) processId: string) {
    return this.svc.deleteProcess(id, processId, this.actor(admin));
  }

  // ── Tarefas ──

  @Get('tasks')
  tasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('area') area?: string,
    @Query('risk') risk?: string,
    @Query('stage') stage?: string,
    @Query('processId') processId?: string,
    @Query('scenario') scenario?: string,
  ) {
    return this.svc.listTasks(id, { area, risk, stage, processId, scenario });
  }

  @Get('tasks/:taskId')
  task(@Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.svc.getTask(id, taskId);
  }

  @Post('tasks')
  createTask(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertWorkTaskDto) {
    return this.svc.createTask(id, dto, this.actor(admin));
  }

  @Put('tasks/:taskId')
  updateTask(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpsertWorkTaskDto,
  ) {
    return this.svc.updateTask(id, taskId, dto, this.actor(admin));
  }

  @Delete('tasks/:taskId')
  deleteTask(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.svc.deleteTask(id, taskId, this.actor(admin));
  }

  /** Validação CRIVO (validar/devolver com nota obrigatória) — só tarefas EM_VALIDACAO_CRIVO; auditado. */
  @Post('tasks/:taskId/validate')
  validateTask(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ValidateWorkTaskDto,
  ) {
    return this.svc.validateTask(id, taskId, dto, this.actor(admin));
  }

  // ── Skills ──

  @Get('skills')
  skills(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listSkills(id);
  }

  @Put('skills')
  saveSkills(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveWorkSkillsDto) {
    return this.svc.saveSkills(id, dto, this.actor(admin));
  }

  // ── Pilotos e blueprints ──

  @Get('pilots')
  pilots(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listPilots(id);
  }

  @Post('pilots')
  createPilot(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertWorkPilotDto) {
    return this.svc.createPilot(id, dto, this.actor(admin));
  }

  @Patch('pilots/:pilotId')
  updatePilot(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pilotId', ParseUUIDPipe) pilotId: string,
    @Body() dto: UpdateWorkPilotDto,
  ) {
    return this.svc.updatePilot(id, pilotId, dto, this.actor(admin));
  }

  @Delete('pilots/:pilotId')
  deletePilot(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Param('pilotId', ParseUUIDPipe) pilotId: string) {
    return this.svc.deletePilot(id, pilotId, this.actor(admin));
  }
}
