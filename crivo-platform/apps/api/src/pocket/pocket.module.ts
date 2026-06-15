import { Module } from '@nestjs/common';
import { PocketController } from './pocket.controller';
import { PocketService } from './pocket.service';

@Module({
  controllers: [PocketController],
  providers: [PocketService],
})
export class PocketModule {}
