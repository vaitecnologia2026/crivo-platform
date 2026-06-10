import { Module } from '@nestjs/common';
import { MeteringService } from './metering.service';

/** Metering (F4): limites de plano + contadores de uso. Sem estado próprio —
 *  opera sobre o `tx` escopado por tenant fornecido pelos serviços de negócio. */
@Module({
  providers: [MeteringService],
  exports: [MeteringService],
})
export class MeteringModule {}
