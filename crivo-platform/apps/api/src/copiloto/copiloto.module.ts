import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AdminModule } from '../admin/admin.module';
import { CopilotoController } from './copiloto.controller';
import { CopilotoService } from './copiloto.service';

/** Copiloto CRIVO (Área do Líder) — apoio reflexivo por IA. Reusa a config
 *  global de IA (AiSettingsService) exportada pelo AdminModule. */
@Module({
  imports: [IamModule, AdminModule],
  controllers: [CopilotoController],
  providers: [CopilotoService],
})
export class CopilotoModule {}
