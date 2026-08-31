import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from 'helmet';
import { ErrorLogFilter } from './common/error-log.filter';
import { HttpLogInterceptor } from './common/http-log.interceptor';
import { requestIdMiddleware } from './common/request-id';

/** Config compartilhada do bootstrap da API (helmet, CORS, ValidationPipe, prefixo /api). */
export function applyAppConfig(app: INestApplication) {
  // Antes de tudo: toda requisição ganha um id de correlação, inclusive as que
  // morrem cedo — é ele que liga a linha do log do site à da API.
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.setGlobalPrefix('api');
  const origins = (process.env.WEB_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // fail-closed: se WEB_URL vier vazio, NEGA tudo (false) em vez de refletir qualquer origem (true).
  // `x-request-id` exposto para o portal poder mostrar o código do erro ao
  // usuário — é o mesmo id que aparece na linha do log do servidor.
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão nos DTOs
      forbidNonWhitelisted: true, // recusa com 400 quando há campos extras (não silencia)
      transform: true, // converte payload para a classe DTO (com defaults)
      transformOptions: { enableImplicitConversion: true }, // boolean string → boolean em query
    }),
  );
  // Loga toda resposta de erro. Estende o filtro padrão do Nest e delega a
  // resposta, então nenhum corpo de erro muda para quem consome a API.
  app.useGlobalFilters(new ErrorLogFilter(app.get(HttpAdapterHost).httpAdapter));
  // Contrapartida do filtro: registra o que MUDOU estado e deu certo.
  app.useGlobalInterceptors(new HttpLogInterceptor());
}
