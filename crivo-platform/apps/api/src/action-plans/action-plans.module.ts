import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ActionPlansController } from './action-plans.controller';
import { ActionPlansService } from './action-plans.service';
import { CyclesService } from './cycles.service';
import { DocumentsService } from './documents.service';

/** Plano de Ação + Evidências + Documentos + Ciclos do tenant (Briefing §8/§9/§15 + F4). */
@Module({
  imports: [IamModule],
  controllers: [ActionPlansController],
  providers: [ActionPlansService, DocumentsService, CyclesService],
})
export class ActionPlansModule {}
