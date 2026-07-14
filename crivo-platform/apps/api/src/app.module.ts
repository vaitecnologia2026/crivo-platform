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
import { ActionPlansModule } from './action-plans/action-plans.module';
import { EssencialModule } from './essencial/essencial.module';
import { ParecerModule } from './parecer/parecer.module';
import { CopilotoModule } from './copiloto/copiloto.module';
import { DecisionsModule } from './decisions/decisions.module';
import { IcdCyclesModule } from './icd-cycles/icd-cycles.module';
import { PocketModule } from './pocket/pocket.module';
import { PsychosocialModule } from './psychosocial/psychosocial.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { CnaeModule } from './cnae/cnae.module';
import { InvisibleCostsModule } from './invisible-costs/invisible-costs.module';
import { PeopleAnalyticsModule } from './people-analytics/people-analytics.module';
import { AlertsModule } from './alerts/alerts.module';
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
    ActionPlansModule,
    EssencialModule,
    ParecerModule,
    CopilotoModule,
    DecisionsModule,
    IcdCyclesModule,
    PocketModule,
    PsychosocialModule,
    DiagnosticsModule,
    CnaeModule,
    InvisibleCostsModule,
    PeopleAnalyticsModule,
    AlertsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Metering de api_calls por tenant (F4) — conta requisições autenticadas.
    { provide: APP_INTERCEPTOR, useClass: MeteringInterceptor },
  ],
})
export class AppModule {}
