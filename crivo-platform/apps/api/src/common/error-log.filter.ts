import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { requestIdOf } from './request-id';

/**
 * Registra no log TODA resposta de erro da API.
 *
 * Até aqui a API era muda em operação: `/var/log/crivo-api.log` passou dias com
 * 0 byte enquanto o serviço rodava. Um 400 do ValidationPipe ou um 403 de guarda
 * não deixavam rastro nenhum, e a única forma de investigar uma queixa era
 * adivinhar.
 *
 * ATENÇÃO ao mexer aqui: um filtro `@Catch()` global SUBSTITUI o tratamento
 * padrão do Nest (o `ExceptionsHandler` sai cedo assim que um filtro casa). É o
 * `super.catch()` — o mesmo código que já roda hoje — que mantém o corpo, o
 * status e o log de pilha dos 500 idênticos. Reimplementar a resposta aqui
 * dentro divergiria do Nest no próximo upgrade e derrubaria o stack trace.
 *
 * NUNCA registra o corpo da requisição nem a querystring: ali passam senha, CPF
 * e e-mail. O que vai para o log é rota (sem query), status, id de correlação,
 * ator autenticado e a mensagem do erro.
 */
@Catch()
export class ErrorLogFilter extends BaseExceptionFilter {
  private readonly log = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      if (host.getType() === 'http') this.record(exception, host);
    } catch {
      // Falha ao logar jamais pode impedir a resposta de sair.
    }
    super.catch(exception, host);
  }

  private record(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request & Actor>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = describe(exception);

    // 404 de rota inexistente ("Cannot POST /api/graphql") é varredura: 109 num
    // único dia, só de scanner procurando /api/.env e credenciais de nuvem. O
    // nginx registra request por request; repetir aqui viraria um feed de bots.
    if (status === 404 && /^Cannot [A-Z]+ /.test(message)) return;

    // A querystring é descartada de propósito: pode carregar e-mail e outros
    // identificadores, e o log é um arquivo que sobrevive semanas em disco.
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const actor = req.user?.email ?? req.admin?.email;
    const line =
      `${req.method} ${path} -> ${status} req=${requestIdOf(req)}` +
      (actor ? ` ator=${actor}` : '') +
      (req.user?.tenantId ? ` tenant=${req.user.tenantId}` : '') +
      `: ${message}`;

    // Sessão expirada é rotina no portal e vira ruído em `warn`. Mas 401 na
    // rota de LOGIN é outra coisa: é tentativa de autenticação que falhou —
    // sinal de segurança, e o único rastro que sobra de uma tentativa de
    // força bruta contra o painel. Só o nginx registrava, sem dizer o e-mail.
    if (status === 401 && !/\/auth\/login$/.test(path)) {
      this.log.debug(line);
      return;
    }
    if (status < 500) {
      this.log.warn(line);
      return;
    }
    // Quando NÃO é HttpException, o `super.catch` logo abaixo imprime a pilha
    // (contexto ExceptionsHandler). Duplicar aqui só encheria o arquivo — esta
    // linha existe para dar a rota, o ator e a correlação, que lá não têm.
    if (exception instanceof HttpException && exception.stack) {
      this.log.error(line, exception.stack);
    } else {
      this.log.error(line);
    }
  }
}

type Actor = {
  user?: SessionUser;
  admin?: { id: string; email: string; name?: string };
};

/** Limite para uma lista de erros de validação não virar uma linha gigante. */
const MAX_MESSAGE = 300;

/**
 * Mensagem legível do erro. No 400 do ValidationPipe o corpo traz a lista de
 * campos recusados — são NOMES de campo, nunca os valores enviados.
 */
function describe(exception: unknown): string {
  const raw = rawMessage(exception);
  return raw.length > MAX_MESSAGE ? `${raw.slice(0, MAX_MESSAGE)}…` : raw;
}

function rawMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    const msg = (body as { message?: unknown }).message;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string') return msg;
    return exception.message;
  }
  if (exception instanceof Error) return `${exception.name}: ${exception.message}`;
  return String(exception);
}
