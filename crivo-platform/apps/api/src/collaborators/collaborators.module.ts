import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';
import { CollaboratorsController } from './collaborators.controller';
import { PublicCollaboratorsController } from './public-collaborators.controller';
import { CollaboratorsService } from './collaborators.service';

/** Colaboradores: cadastro por tenant + link único (CPF) para o diagnóstico.
 *  IamModule provê ModuleService/guards (AuthGuard, ModuleGuard, ScreenAccessGuard,
 *  RolesGuard). Reusa PsychosocialService (perguntas + submit anônimo com hook). */
@Module({
  imports: [IamModule, PsychosocialModule],
  controllers: [CollaboratorsController, PublicCollaboratorsController],
  providers: [CollaboratorsService],
})
export class CollaboratorsModule {}
