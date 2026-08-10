import { Module } from '@nestjs/common';
import { PsychosocialController } from './psychosocial.controller';
import { PublicPsychosocialController } from './public-psychosocial.controller';
import { PsychosocialService } from './psychosocial.service';

@Module({
  controllers: [PsychosocialController, PublicPsychosocialController],
  providers: [PsychosocialService],
  exports: [PsychosocialService], // IcdModule usa na campanha pública
})
export class PsychosocialModule {}
