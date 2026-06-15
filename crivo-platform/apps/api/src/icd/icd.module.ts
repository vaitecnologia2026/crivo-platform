import { Module } from '@nestjs/common';
import { IcdController } from './icd.controller';
import { IcdService } from './icd.service';
import { PublicCampaignsController } from './public-campaigns.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule], // exporta EditableTextsService (#60)
  controllers: [IcdController, PublicCampaignsController],
  providers: [IcdService],
})
export class IcdModule {}
