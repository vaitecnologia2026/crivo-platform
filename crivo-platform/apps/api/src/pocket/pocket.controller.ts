import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PocketService } from './pocket.service';
import { CreatePocketSessionDto, UpsertReflectionDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { POCKET_QUESTIONS } from '@crivo/types';
import type { SessionUser } from '@crivo/types';

@Controller('pocket')
@UseGuards(AuthGuard, ScreenAccessGuard)
@RequireScreen('pocket')
export class PocketController {
  constructor(private readonly pocket: PocketService) {}

  /** Catálogo oficial das 10 perguntas C1-O2 (Anexo Pocket §6). */
  @Get('questions')
  questions() {
    return POCKET_QUESTIONS;
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
