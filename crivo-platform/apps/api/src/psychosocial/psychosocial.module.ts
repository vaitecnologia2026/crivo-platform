import { Module } from '@nestjs/common';
import { PsychosocialController } from './psychosocial.controller';
import { PsychosocialService } from './psychosocial.service';

@Module({
  controllers: [PsychosocialController],
  providers: [PsychosocialService],
})
export class PsychosocialModule {}
