import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsIntakeController } from './leads-intake.controller';
import { LeadsService } from './leads.service';
import { IamModule } from '../iam/iam.module';
import { MeteringModule } from '../metering/metering.module';

@Module({
  // IamModule: guards/RBAC (F3) + gate de módulo (F4). MeteringModule: limites de plano (F4).
  imports: [IamModule, MeteringModule],
  controllers: [LeadsController, LeadsIntakeController],
  providers: [LeadsService],
})
export class LeadsModule {}
