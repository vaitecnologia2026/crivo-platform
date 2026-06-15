import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ParecerController } from './parecer.controller';
import { ParecerService } from './parecer.service';

/** Parecer Consultivo CRIVO (Briefing §6) — módulo de autoria do consultor. */
@Module({
  imports: [IamModule],
  controllers: [ParecerController],
  providers: [ParecerService],
})
export class ParecerModule {}
