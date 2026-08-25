import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CollaboratorsService } from './collaborators.service';
import { SubmitByTokenDto, VerifyCpfDto } from './dto';

/**
 * Endpoint PÚBLICO — SEM AuthGuard. O funcionário abre /r/<token>, informa o CPF
 * cadastrado (gate) e responde o diagnóstico. A resposta é ANÔNIMA; o token só
 * marca participação (não pode refazer). Token de 128 bits = credencial do link.
 */
@Controller('public/collab')
export class PublicCollaboratorsController {
  constructor(private readonly svc: CollaboratorsService) {}

  /** De quem é o link + se já respondeu (sem revelar dado pessoal antes do CPF). */
  @Get(':token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  info(@Param('token') token: string) {
    return this.svc.publicInfo(token);
  }

  /** Valida o CPF e libera as perguntas. */
  @Post(':token/verify')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verify(@Param('token') token: string, @Body() dto: VerifyCpfDto) {
    return this.svc.verify(token, dto.cpf);
  }

  /** Grava a resposta anônima e impede refazer (CPF revalidado). */
  @Post(':token/submit')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  submit(@Param('token') token: string, @Body() dto: SubmitByTokenDto) {
    return this.svc.submit(token, dto);
  }
}
