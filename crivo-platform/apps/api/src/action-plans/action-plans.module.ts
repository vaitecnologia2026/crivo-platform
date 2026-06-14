import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ActionPlansController } from './action-plans.controller';
import { ActionPlansService } from './action-plans.service';

/** Plano de Ação + Evidências do tenant (Briefing §8/§9). Guards via IamModule. */
@Module({
  imports: [IamModule],
  controllers: [ActionPlansController],
  providers: [ActionPlansService],
})
export class ActionPlansModule {}
