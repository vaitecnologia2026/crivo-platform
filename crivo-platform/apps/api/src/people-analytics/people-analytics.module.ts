import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PeopleAnalyticsController } from './people-analytics.controller';
import { PeopleAnalyticsService } from './people-analytics.service';

@Module({
  imports: [AdminModule], // AiSettingsService (chave OpenAI) é exportado pelo AdminModule
  controllers: [PeopleAnalyticsController],
  providers: [PeopleAnalyticsService],
})
export class PeopleAnalyticsModule {}
