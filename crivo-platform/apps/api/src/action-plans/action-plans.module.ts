import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';
import { AdminModule } from '../admin/admin.module';
import { ActionPlansController } from './action-plans.controller';
import { ActionPlansService } from './action-plans.service';
import { CyclesService } from './cycles.service';
import { DocumentsService } from './documents.service';
import { RiskSuggestionsService } from './risk-suggestions.service';

/** Plano de Ação + Evidências + Documentos + Ciclos do tenant (Briefing §8/§9/§15 + F4).
 *  Importa AdminModule para consumir AiSettingsService (IA da plataforma no Dossiê).
 *  Sem ciclo: AdminModule só importa MeteringModule (nenhum caminho volta a este módulo). */
@Module({
  imports: [IamModule, PsychosocialModule, AdminModule],
  controllers: [ActionPlansController],
  providers: [ActionPlansService, DocumentsService, CyclesService, RiskSuggestionsService],
})
export class ActionPlansModule {}
