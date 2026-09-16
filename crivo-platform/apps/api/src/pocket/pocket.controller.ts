import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PocketService } from './pocket.service';
import { CreatePocketSessionDto, UpsertReflectionDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { POCKET_QUESTIONS } from '@crivo/types';
import type { SessionUser } from '@crivo/types';

// Gate de módulo (F4): antes só o menu escondia o Pocket sem o módulo.
@Controller('pocket')
@UseGuards(AuthGuard, ModuleGuard, ScreenAccessGuard)
@RequireModule('pocket')
@RequireScreen('pocket')
export class PocketController {
  constructor(private readonly pocket: PocketService) {}

  /** Catálogo oficial das 10 perguntas C1-O2 (Anexo Pocket §6). */
  @Get('questions')
  questions() {
    return POCKET_QUESTIONS;
  }

  /** AGREGADO por dimensão + adesão para a tela Liderança (rota `icd`) da
   *  GESTÃO — por isso a tela declarada aqui é `icd` (sobrepõe o `pocket`
   *  da classe) e o papel é de gestão, não o líder. Só contagens com
   *  supressão n < 5; nunca uma sessão ou reflexão de alguém (§13). */
  @Get('aggregate')
  @UseGuards(RolesGuard)
  @RequireScreen('icd')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN', 'JURIDICO', 'CONSULTOR')
  aggregate(
    @CurrentUser() user: SessionUser,
    @Query('cycleId', new ParseUUIDPipe({ optional: true })) cycleId?: string,
  ) {
    return this.pocket.aggregate(user.tenantId, cycleId || undefined);
  }

  /** Histórico individual do líder (§13). Cada um vê só o próprio. */
  @Get('sessions')
  listMine(@CurrentUser() user: SessionUser) {
    return this.pocket.listMySessions(user.tenantId, user.id);
  }

  /** Inicia uma nova sessão (com contexto opcional + momento + decisão vinculada). */
  @Post('sessions')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreatePocketSessionDto) {
    return this.pocket.createSession(user.tenantId, user.id, dto);
  }

  /** Detalhe da sessão (apenas a própria). */
  @Get('sessions/:id')
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.pocket.getSession(user.tenantId, user.id, id);
  }

  /** Submete/atualiza uma reflexão a uma pergunta (C1-O2). Upsert. */
  @Put('sessions/:id/reflections')
  upsertReflection(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertReflectionDto,
  ) {
    return this.pocket.upsertReflection(user.tenantId, user.id, id, dto);
  }

  /** Marca a sessão como CONCLUIDA. */
  @Post('sessions/:id/complete')
  complete(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.pocket.completeSession(user.tenantId, user.id, id);
  }

  /** Remove sessão (apenas EM_ANDAMENTO, do próprio dono). */
  @Delete('sessions/:id')
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.pocket.removeSession(user.tenantId, user.id, id);
  }
}
