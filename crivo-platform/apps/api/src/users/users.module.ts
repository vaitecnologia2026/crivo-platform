import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { IamModule } from '../iam/iam.module';
import { MeteringModule } from '../metering/metering.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  // IamModule: guards/RBAC. MeteringModule: limite de usuários do plano (F4).
  // AdminModule: AuditService (trilha de usuários/papéis/acesso — S12-09).
  imports: [IamModule, MeteringModule, AdminModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
