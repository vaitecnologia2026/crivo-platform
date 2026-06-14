import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ActionPlansController } from './action-plans.controller';
import { ActionPlansService } from './action-plans.service';
import { DocumentsService } from './documents.service';

/** Plano de Ação + Evidências + Documentos do tenant (Briefing §8/§9/§15). */
@Module({
  imports: [IamModule],
  controllers: [ActionPlansController],
  providers: [ActionPlansService, DocumentsService],
})
export class ActionPlansModule {}
