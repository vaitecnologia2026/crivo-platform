import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { IamModule } from '../iam/iam.module';
import { MeteringModule } from '../metering/metering.module';

@Module({
  // IamModule: guards/RBAC. MeteringModule: limite de usuários do plano (F4).
  imports: [IamModule, MeteringModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
