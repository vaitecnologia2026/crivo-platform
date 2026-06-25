import { Module } from '@nestjs/common';
import { InvisibleCostsController } from './invisible-costs.controller';
import { InvisibleCostsService } from './invisible-costs.service';

@Module({
  controllers: [InvisibleCostsController],
  providers: [InvisibleCostsService],
})
export class InvisibleCostsModule {}
