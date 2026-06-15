import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../iam/guards/auth.guard';
import { CopilotoService } from './copiloto.service';
import { AskCopilotoDto } from './dto';

/**
 * Copiloto CRIVO (Área do Líder). Qualquer usuário autenticado do tenant pode
 * usar; a disponibilidade real depende da IA estar configurada/ativa (resposta
 * honesta caso contrário). Sem RLS própria — não lê dados de negócio.
 */
@Controller('copiloto')
@UseGuards(AuthGuard)
export class CopilotoController {
  constructor(private readonly copiloto: CopilotoService) {}

  @Post('ask')
  ask(@Body() dto: AskCopilotoDto) {
    return this.copiloto.ask(dto);
  }
}
