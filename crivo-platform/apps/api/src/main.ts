import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { applyAppConfig } from './setup';

/** Bootstrap para execução local / host de processo (não-serverless). */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyAppConfig(app);
  // PORT é injetada por hosts de processo (Railway/Render/Fly); API_PORT é o
  // default local. Bind em 0.0.0.0 para funcionar dentro de containers.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  Logger.log(`CRIVO API ouvindo na porta ${port} (prefixo /api)`, 'Bootstrap');
}

bootstrap();
