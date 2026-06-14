import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { EssencialController } from './essencial.controller';
import { EssencialService } from './essencial.service';

/** Diagnóstico Essencial do tenant (Briefing §5). Guards via IamModule. */
@Module({
  imports: [IamModule],
  controllers: [EssencialController],
  providers: [EssencialService],
})
export class EssencialModule {}
