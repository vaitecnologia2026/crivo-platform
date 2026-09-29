import { Module } from '@nestjs/common';
import { IcdCyclesController } from './icd-cycles.controller';
import { IcdCyclesService } from './icd-cycles.service';
import { IamModule } from '../iam/iam.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  // IamModule: ModuleGuard (gate F4 do módulo "icd"). AdminModule: AuditService
  // (abrir/fechar ciclo vai para a trilha — S12-09).
  imports: [IamModule, AdminModule],
  controllers: [IcdCyclesController],
  providers: [IcdCyclesService],
  // Plano de Ação prioriza as ações sugeridas pelo eixo mais fraco do ICD.
  exports: [IcdCyclesService],
})
export class IcdCyclesModule {}
