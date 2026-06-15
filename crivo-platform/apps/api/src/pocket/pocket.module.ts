import { Module } from '@nestjs/common';
import { PocketController } from './pocket.controller';
import { PocketService } from './pocket.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule], // exporta AiSettingsService (Mentoria IA, Anexo Pocket §10)
  controllers: [PocketController],
  providers: [PocketService],
})
export class PocketModule {}
