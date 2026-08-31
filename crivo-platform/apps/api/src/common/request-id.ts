import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Identificador de correlação por requisição.
 *
 * Sem ele, a linha do log do site (`crivo-lp`) e a da API (`crivo-api`) só se
 * casavam por horário e e-mail — inviável quando dois leads entram no mesmo
 * minuto. O site manda o seu `x-request-id` no fetch do intake; a API adota o
 * mesmo id e o devolve no header, então a jornada inteira fica costurada.
 */

export type RequestWithId = Request & { requestId?: string };

/**
 * O id vem de fora, então é dado não confiável: só aceito no formato abaixo.
 * Um valor com quebra de linha forjaria linhas inteiras no arquivo de log.
 */
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID().slice(0, 8);
  (req as RequestWithId).requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

/** O id da requisição, ou `-` quando o middleware não passou (ex.: testes). */
export function requestIdOf(req: unknown): string {
  const id = (req as RequestWithId | undefined)?.requestId;
  return typeof id === 'string' && id ? id : '-';
}
