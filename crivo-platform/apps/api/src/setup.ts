import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/** Config compartilhada entre o bootstrap local (main.ts) e o serverless (api/index.ts). */
export function applyAppConfig(app: INestApplication) {
  app.use(helmet());
  app.setGlobalPrefix('api');
  const origins = (process.env.WEB_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // fail-closed: se WEB_URL vier vazio, NEGA tudo (false) em vez de refletir qualquer origem (true).
  app.enableCors({ origin: origins.length ? origins : false, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão nos DTOs
      forbidNonWhitelisted: true, // recusa com 400 quando há campos extras (não silencia)
      transform: true, // converte payload para a classe DTO (com defaults)
      transformOptions: { enableImplicitConversion: true }, // boolean string → boolean em query
    }),
  );
}
