import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { IamModule } from './iam/iam.module';
import { IcdModule } from './icd/icd.module';
import { LeadsModule } from './leads/leads.module';
import { UsersModule } from './users/users.module';
import { LibraryModule } from './library/library.module';
import { MeteringModule } from './metering/metering.module';
import { MeteringInterceptor } from './metering/metering.interceptor';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit global: 60 req/min por IP (em serverless, considerar store Redis).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    IamModule,
    IcdModule,
    LeadsModule,
    UsersModule,
    LibraryModule,
    MeteringModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Metering de api_calls por tenant (F4) — conta requisições autenticadas.
    { provide: APP_INTERCEPTOR, useClass: MeteringInterceptor },
  ],
})
export class AppModule {}
