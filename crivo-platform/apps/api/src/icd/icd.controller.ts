import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IcdService } from './icd.service';
import {
  CreateCampaignDto,
  ListCampaignsQueryDto,
  SubmitIcdDto,
  UpdateCampaignDto,
} from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { ICD_QUESTIONS, type SessionUser } from '@crivo/types';

@Controller('icd')
@UseGuards(AuthGuard, RolesGuard)
export class IcdController {
  constructor(private readonly icd: IcdService) {}

  /** Catálogo de perguntas (para renderizar o questionário no front). */
  @Get('questions')
  questions() {
    return ICD_QUESTIONS;
  }

  /** Lista os usuários do tenant para escolher o líder a avaliar. */
  @Get('leaders')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  leaders(@CurrentUser() user: SessionUser) {
    return this.icd.leaders(user.tenantId);
  }

  /** Submete uma avaliação ICD de um líder. */
  @Post('assessments')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  submit(@CurrentUser() user: SessionUser, @Body() dto: SubmitIcdDto) {
    return this.icd.submit(user.tenantId, dto);
  }

  /** Dashboard executivo do ICD do tenant. */
  @Get('dashboard')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  dashboard(@CurrentUser() user: SessionUser) {
    return this.icd.dashboard(user.tenantId);
  }

  /** ICD pessoal do líder logado (sem @Roles: cada um vê o próprio). */
  @Get('me')
  myScore(@CurrentUser() user: SessionUser) {
    return this.icd.myScore(user.tenantId, user.id);
  }

  /** Campanhas de diagnóstico (ciclos) do tenant com estatísticas.
   *  Filtra por setor (?sector=) quando informado (Portal §7). */
  @Get('campaigns')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  campaigns(@CurrentUser() user: SessionUser, @Query() query: ListCampaignsQueryDto) {
    return this.icd.campaigns(user.tenantId, query.sector);
  }

  /** Cria uma nova campanha. RH/CEO/ADMIN (edição/criação não é do GESTOR). */
  @Post('campaigns')
  @Roles('RH', 'CEO', 'ADMIN')
  createCampaign(@CurrentUser() user: SessionUser, @Body() dto: CreateCampaignDto) {
    return this.icd.createCampaign(user.tenantId, dto);
  }

  /** Edita uma campanha existente. */
  @Patch('campaigns/:id')
  @Roles('RH', 'CEO', 'ADMIN')
  updateCampaign(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.icd.updateCampaign(user.tenantId, id, dto);
  }

  /** Encerra uma campanha (status → CLOSED). */
  @Post('campaigns/:id/close')
  @Roles('RH', 'CEO', 'ADMIN')
  closeCampaign(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.icd.closeCampaign(user.tenantId, id);
  }

  /** #56 — Dispara lembretes por e-mail para usuários que ainda não responderam. */
  @Post('campaigns/:id/send-reminders')
  @Roles('RH', 'CEO', 'ADMIN')
  sendCampaignReminders(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.icd.sendCampaignReminders(user.tenantId, id);
  }
}
