import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PsychosocialService } from './psychosocial.service';
import { SubmitPsychosocialDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { Roles } from '../iam/roles.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { type SessionUser } from '@crivo/types';

/**
 * Questionário Psicossocial Organizacional (Briefing §6). Submissão anônima
 * (qualquer usuário do tenant pode responder; nada o identifica) e agregação
 * com supressão §14 restrita a RH/gestão.
 */
@Controller('psychosocial')
@UseGuards(AuthGuard, RolesGuard, ScreenAccessGuard)
@RequireScreen('psicossocial')
export class PsychosocialController {
  constructor(private readonly psychosocial: PsychosocialService) {}

  /** Catálogo de perguntas (para renderizar o questionário no front). */
  @Get('questions')
  questions() {
    return this.psychosocial.getQuestions();
  }

  /** Submete uma resposta anônima ao questionário. */
  @Post('submit')
  submit(@CurrentUser() user: SessionUser, @Body() dto: SubmitPsychosocialDto) {
    return this.psychosocial.submit(user.tenantId, dto);
  }

  /** Agregação por setor (com supressão §14) — só gestão/RH. */
  @Get('results')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR')
  results(@CurrentUser() user: SessionUser) {
    return this.psychosocial.results(user.tenantId);
  }

  /** Link público atual da empresa (null se não gerado) — só gestão/RH. */
  @Get('link')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  getLink(@CurrentUser() user: SessionUser) {
    return this.psychosocial.getLink(user.tenantId);
  }

  /** Gera (idempotente) o link público anônimo da empresa — só gestão/RH. */
  @Post('link')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  ensureLink(@CurrentUser() user: SessionUser) {
    return this.psychosocial.ensureLink(user.tenantId);
  }
}
