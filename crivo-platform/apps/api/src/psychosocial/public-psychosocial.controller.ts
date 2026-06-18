import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PsychosocialService } from './psychosocial.service';
import { SubmitPsychosocialDto } from './dto';

/**
 * Endpoint PÚBLICO (Briefing §6) — SEM AuthGuard. Permite que colaboradores
 * respondam ao Questionário Psicossocial anonimamente via link /q/<slug>, sem
 * login. Resolve o slug → empresa e grava a resposta sob a RLS do tenant.
 * Não expõe nenhum dado interno (só nome da empresa + perguntas).
 */
@Controller('public/psychosocial')
export class PublicPsychosocialController {
  constructor(private readonly psychosocial: PsychosocialService) {}

  /** Resolve o slug → nome da empresa + perguntas (para renderizar o formulário). */
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.psychosocial.getPublicBySlug(slug);
  }

  /** Submissão anônima via slug. */
  @Post(':slug')
  submit(@Param('slug') slug: string, @Body() dto: SubmitPsychosocialDto) {
    return this.psychosocial.submitPublic(slug, dto);
  }
}
