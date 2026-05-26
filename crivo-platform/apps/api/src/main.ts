import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('api');
  // CORS: lista separada por vírgula em WEB_URL (origens permitidas).
  const origins = (process.env.WEB_URL ?? 'http://localhost:3000').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.API_PORT ?? 3333);
  await app.listen(port);
  Logger.log(`CRIVO API em http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
