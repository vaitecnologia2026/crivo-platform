import { Module } from '@nestjs/common';
import { InvisibleCostsController } from './invisible-costs.controller';
import { InvisibleCostsService } from './invisible-costs.service';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [IamModule], // ModuleGuard (gate F4 do módulo "custo")
  controllers: [InvisibleCostsController],
  providers: [InvisibleCostsService],
})
export class InvisibleCostsModule {}
