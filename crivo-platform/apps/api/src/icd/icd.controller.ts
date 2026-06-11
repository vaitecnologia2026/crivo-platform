import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IcdService } from './icd.service';
import { SubmitIcdDto } from './dto';
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
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  dashboard(@CurrentUser() user: SessionUser) {
    return this.icd.dashboard(user.tenantId);
  }

  /** ICD pessoal do líder logado (sem @Roles: cada um vê o próprio). */
  @Get('me')
  myScore(@CurrentUser() user: SessionUser) {
    return this.icd.myScore(user.tenantId, user.id);
  }

  /** Campanhas de diagnóstico (ciclos) do tenant com estatísticas. */
  @Get('campaigns')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  campaigns(@CurrentUser() user: SessionUser) {
    return this.icd.campaigns(user.tenantId);
  }
}
