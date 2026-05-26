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
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
