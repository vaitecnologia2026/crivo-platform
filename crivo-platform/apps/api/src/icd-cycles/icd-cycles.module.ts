import { Module } from '@nestjs/common';
import { IcdCyclesController } from './icd-cycles.controller';
import { IcdCyclesService } from './icd-cycles.service';

@Module({
  controllers: [IcdCyclesController],
  providers: [IcdCyclesService],
})
export class IcdCyclesModule {}
