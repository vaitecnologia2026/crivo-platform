import { Module } from '@nestjs/common';
import { IcdController } from './icd.controller';
import { IcdService } from './icd.service';
import { PublicCampaignsController } from './public-campaigns.controller';
import { AdminModule } from '../admin/admin.module';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';

@Module({
  imports: [AdminModule, PsychosocialModule], // EditableTextsService (#60) + coleta da campanha pública
  controllers: [IcdController, PublicCampaignsController],
  providers: [IcdService],
})
export class IcdModule {}
