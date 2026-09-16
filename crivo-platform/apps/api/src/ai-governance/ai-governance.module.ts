import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AdminModule } from '../admin/admin.module';
import { AiGovernanceController } from './ai-governance.controller';
import { AiGovernanceService } from './ai-governance.service';

/**
 * Governança de IA (módulo 'govia') — lado do CLIENTE (portal). IamModule
 * traz os guards; AdminModule traz o AuditService (trilha da decisão humana).
 * O controller do Super Admin (/admin/tenants/:id/ai-governance/*) vive em
 * admin/ e registra este mesmo service como provider lá — importar este
 * módulo de dentro do AdminModule fecharia um ciclo (IamModule → AdminModule).
 */
@Module({
  imports: [IamModule, AdminModule],
  controllers: [AiGovernanceController],
  providers: [AiGovernanceService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}
