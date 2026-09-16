import { Module } from '@nestjs/common';
import { IcdCyclesController } from './icd-cycles.controller';
import { IcdCyclesService } from './icd-cycles.service';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [IamModule], // ModuleGuard (gate F4 do módulo "icd")
  controllers: [IcdCyclesController],
  providers: [IcdCyclesService],
})
export class IcdCyclesModule {}
