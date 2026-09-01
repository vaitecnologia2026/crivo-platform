import { Module } from '@nestjs/common';
import { IcdController } from './icd.controller';
import { IcdService } from './icd.service';
import { PublicCampaignsController } from './public-campaigns.controller';
import { AdminModule } from '../admin/admin.module';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

@Module({
  // DiagnosticsModule: a campanha aplica o instrumento do método contratado, e
  // quando não é o psicossocial a gravação vai por submitForTenant.
  imports: [AdminModule, PsychosocialModule, DiagnosticsModule],
  controllers: [IcdController, PublicCampaignsController],
  providers: [IcdService],
})
export class IcdModule {}
