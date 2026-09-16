import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AdminModule } from '../admin/admin.module';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';

/**
 * Workforce Intelligence (módulo 'workforce') — lado do CLIENTE (portal).
 * IamModule traz os guards; AdminModule traz o AuditService (trilha da decisão
 * humana). O controller do Super Admin (/admin/tenants/:id/workforce/*) vive
 * em admin/ e registra este mesmo service como provider lá — importar este
 * módulo de dentro do AdminModule fecharia um ciclo (IamModule → AdminModule).
 */
@Module({
  imports: [IamModule, AdminModule],
  controllers: [WorkforceController],
  providers: [WorkforceService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
