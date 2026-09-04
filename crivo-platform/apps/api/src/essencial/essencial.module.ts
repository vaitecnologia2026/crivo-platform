import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { EssencialController } from './essencial.controller';
import { EssencialService } from './essencial.service';

/** Diagnóstico Essencial do tenant (Briefing §5). Guards via IamModule. */
@Module({
  // O agregado das respostas dos colaboradores é o MESMO cálculo que o super
  // admin já usa (diagnostics.results) — reusar evita duas contas divergindo.
  imports: [IamModule, DiagnosticsModule],
  controllers: [EssencialController],
  providers: [EssencialService],
})
export class EssencialModule {}
