import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { CollaboratorsController } from './collaborators.controller';
import { PublicCollaboratorsController } from './public-collaborators.controller';
import { CollaboratorsService } from './collaborators.service';

/** Colaboradores: cadastro por tenant + link único (CPF) para o diagnóstico.
 *  IamModule provê ModuleService/guards (AuthGuard, ModuleGuard, ScreenAccessGuard,
 *  RolesGuard). Reusa PsychosocialService (perguntas + submit anônimo com hook). */
@Module({
  imports: [IamModule, PsychosocialModule, DiagnosticsModule],
  controllers: [CollaboratorsController, PublicCollaboratorsController],
  providers: [CollaboratorsService],
  // IcdModule usa o cadastro/CPF para a campanha pública (QR nominal).
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}
