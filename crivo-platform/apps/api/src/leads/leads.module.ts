import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsIntakeController } from './leads-intake.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController, LeadsIntakeController],
  providers: [LeadsService],
})
export class LeadsModule {}
