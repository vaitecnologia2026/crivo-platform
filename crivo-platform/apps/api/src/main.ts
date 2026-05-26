import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { applyAppConfig } from './setup';

/** Bootstrap para execução local / host de processo (não-serverless). */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyAppConfig(app);
  const port = Number(process.env.API_PORT ?? 3333);
  await app.listen(port);
  Logger.log(`CRIVO API em http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
