import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { LeaderGuard } from '../iam/guards/leader.guard';
import { CurrentUser } from '../iam/current-user.decorator';
import { CopilotoService } from './copiloto.service';
import { AskCopilotoDto } from './dto';

/**
 * Copiloto CRIVO (Mentor CRIVO, em Minha Jornada). Só para líderes (papel
 * LIDER ou marcado como líder — LeaderGuard, Spec V1 v1.2 §3); a
 * disponibilidade real depende da IA estar configurada/ativa (resposta honesta
 * caso contrário). Sem RLS própria — não lê dados de negócio.
 */
@Controller('copiloto')
@UseGuards(AuthGuard, LeaderGuard)
export class CopilotoController {
  constructor(private readonly copiloto: CopilotoService) {}

  @Post('ask')
  ask(@Body() dto: AskCopilotoDto, @CurrentUser() user: SessionUser) {
    // user.tenantId = organizationId (data plane) — resolve as diretrizes do cliente.
    return this.copiloto.ask(dto, user.tenantId);
  }
}
