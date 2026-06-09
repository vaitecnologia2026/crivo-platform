import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsIntakeController } from './leads-intake.controller';
import { LeadsService } from './leads.service';
import { IamModule } from '../iam/iam.module';

@Module({
  // IamModule fornece PermissionGuard + PermissionService (RBAC dinâmico).
  imports: [IamModule],
  controllers: [LeadsController, LeadsIntakeController],
  providers: [LeadsService],
})
export class LeadsModule {}
