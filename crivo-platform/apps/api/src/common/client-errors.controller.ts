import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

/**
 * Recebe do navegador o que o servidor NÃO tem como enxergar.
 *
 * Desde a instrumentação da API, todo erro que CHEGA aqui vira linha de log.
 * Sobraram dois casos cegos, os dois no portal e no super admin:
 *   1. falha de rede ou timeout — nenhuma requisição chegou, então não há o que
 *      registrar do lado de cá (era um `catch` que virava "Serviço indisponível");
 *   2. tela que quebra no navegador — sem error boundary, a página caía sem
 *      deixar rastro em lugar nenhum.
 *
 * Rota pública de propósito: uma tela de login que quebra não tem sessão para
 * apresentar. A proteção é o throttle e o formato fechado do corpo.
 *
 * O que entra aqui é texto escrito por um cliente que não controlamos: tudo é
 * limitado por tamanho no DTO e tem quebra de linha removida antes de ir ao
 * arquivo — senão daria para forjar linhas inteiras dentro do log.
 */

export class ClientErrorDto {
  /** De onde veio: o portal do cliente ou o super admin. */
  @IsIn(['portal', 'superadm'])
  app!: string;

  /** Tela ou rota em que aconteceu (ex.: "documentos"). */
  @IsString()
  @MaxLength(200)
  screen!: string;

  /** Mensagem do erro. NUNCA o corpo da requisição nem dado do usuário. */
  @IsString()
  @MaxLength(300)
  message!: string;

  /** `rede` = não chegou ao servidor; `tela` = a interface quebrou. */
  @IsOptional()
  @IsIn(['rede', 'tela'])
  kind?: string;

  /** Id de correlação, quando a requisição chegou a ter um. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;
}

/** Uma linha por evento: quebra de linha vinda do cliente forjaria outras. */
function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

@Controller('client-errors')
export class ClientErrorsController {
  private readonly log = new Logger('Client');

  @Post()
  @HttpCode(204)
  // Limite baixo de propósito: isto é diagnóstico, não telemetria de volume.
  // Uma tela em laço de render não pode virar enxurrada no arquivo de log.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  report(@Body() dto: ClientErrorDto, @Req() req: Request): void {
    const ua = oneLine(req.header('user-agent') ?? '-', 120);
    this.log.warn(
      `${dto.app}/${oneLine(dto.screen, 200)} ` +
        `origem=${dto.kind ?? 'nao-informada'} ` +
        `req=${dto.requestId ? oneLine(dto.requestId, 64) : '-'}: ` +
        `${oneLine(dto.message, 300)} | navegador=${ua}`,
    );
  }
}
