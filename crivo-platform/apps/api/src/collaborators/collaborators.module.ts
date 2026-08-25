import { Module } from '@nestjs/common';
import { PsychosocialModule } from '../psychosocial/psychosocial.module';
import { CollaboratorsController } from './collaborators.controller';
import { PublicCollaboratorsController } from './public-collaborators.controller';
import { CollaboratorsService } from './collaborators.service';

/** Colaboradores: cadastro por tenant + link único (CPF) para o diagnóstico.
 *  Reusa PsychosocialService (perguntas + submit anônimo com hook de participação). */
@Module({
  imports: [PsychosocialModule],
  controllers: [CollaboratorsController, PublicCollaboratorsController],
  providers: [CollaboratorsService],
})
export class CollaboratorsModule {}
