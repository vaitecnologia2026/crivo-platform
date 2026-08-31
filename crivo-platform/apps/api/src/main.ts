import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { applyAppConfig } from './setup';
import { CrivoLogger } from './common/crivo-logger';

/** Bootstrap para execução local / host de processo (não-serverless). */
async function bootstrap() {
  // O logger entra JÁ na criação — e não via `bufferLogs` + `useLogger`: se a
  // aplicação morre durante o boot (foi o caso de um erro de DI em 25/08), o
  // erro precisa chegar ao arquivo, não ficar preso num buffer que nunca esvazia.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CrivoLogger(),
  });
  // Atrás do nginx (proxy reverso): confia no 1º proxy para que req.ip reflita o
  // IP real do cliente. Sem isso, o rate-limit por IP colapsa num único balde
  // (o IP do nginx, 127.0.0.1) para toda a plataforma.
  app.set('trust proxy', 1);
  // Upload de modelo de contrato (base64) pode passar do limite padrão (100kb).
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { limit: '12mb', extended: true });
  applyAppConfig(app);
  // PORT é injetada por hosts de processo (Railway/Render/Fly); API_PORT é o
  // default local. Bind em 0.0.0.0 para funcionar dentro de containers.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  Logger.log(`CRIVO API ouvindo na porta ${port} (prefixo /api)`, 'Bootstrap');
}

bootstrap().catch((e) => {
  // Sem este catch a falha de boot vira "unhandled rejection" e sai com um
  // formato diferente do resto do arquivo. Aqui ela entra no mesmo formato de
  // uma linha, com a pilha logo abaixo.
  new CrivoLogger().error(
    `Falha ao iniciar a API: ${e instanceof Error ? e.message : e}`,
    e instanceof Error ? e.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
