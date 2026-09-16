import { Module } from '@nestjs/common';
import { PocketController } from './pocket.controller';
import { PocketService } from './pocket.service';
import { AdminModule } from '../admin/admin.module';
import { IamModule } from '../iam/iam.module';

@Module({
  // AdminModule exporta AiSettingsService (Mentoria IA, Anexo Pocket §10);
  // IamModule, o ModuleGuard (gate F4 do módulo "pocket").
  imports: [AdminModule, IamModule],
  controllers: [PocketController],
  providers: [PocketService],
})
export class PocketModule {}
