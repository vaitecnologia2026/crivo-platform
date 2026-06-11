import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [IamModule], // guards + RBAC
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
