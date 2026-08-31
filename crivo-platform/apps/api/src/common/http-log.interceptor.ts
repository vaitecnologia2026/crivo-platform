import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';
import { requestIdOf } from './request-id';

/**
 * Prova de vida das requisições que MUDAM estado.
 *
 * O filtro de erro conta o que deu errado; sem esta contrapartida não havia como
 * saber que uma operação sequer aconteceu — o arquivo de log da API ficou 0 byte
 * por dias com o serviço no ar, e não dava para distinguir "nada falhou" de
 * "nada chegou". Investigar a entrega de um lead começa por aqui.
 *
 * Escopo estreito de propósito: só POST/PUT/PATCH/DELETE e as rotas públicas.
 * Logar todo GET do portal recriaria o problema que este trabalho veio resolver
 * (16 mil linhas afogando o sinal).
 */
@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private readonly log = new Logger('Http');

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    // Sem querystring: ela pode carregar e-mail e o log fica semanas em disco.
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const mutating = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    if (!mutating && !path.startsWith('/api/public/')) return next.handle();

    const started = Date.now();
    return next.handle().pipe(
      // `tap` de um argumento só NÃO dispara em erro — e é o que se quer aqui:
      // a resposta de erro já é registrada, com mais contexto, pelo filtro.
      tap({
        next: () => {
          const status = ctx.switchToHttp().getResponse<Response>().statusCode;
          this.log.log(
            `${req.method} ${path} -> ${status} req=${requestIdOf(req)} ${Date.now() - started}ms`,
          );
        },
      }),
    );
  }
}
