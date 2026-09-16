import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { IamModule } from '../iam/iam.module';
import { PeopleAnalyticsController } from './people-analytics.controller';
import { PeopleAnalyticsService } from './people-analytics.service';

@Module({
  // AdminModule: AiSettingsService (chave OpenAI). IamModule: ModuleGuard (gate F4 "analytics").
  imports: [AdminModule, IamModule],
  controllers: [PeopleAnalyticsController],
  providers: [PeopleAnalyticsService],
})
export class PeopleAnalyticsModule {}
