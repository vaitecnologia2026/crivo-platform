import { Module } from '@nestjs/common';
import { CnaeController } from './cnae.controller';
import { CnaeDecisionEngine } from './cnae-decision.engine';
import { CnaeRulesService } from './cnae-rules.service';
import { CnpjProviderService } from './cnpj-provider.service';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';

/**
 * Motor de Decisão CNAE/NR-1 (control plane). Usa o JwtModule global (IamModule)
 * + a conexão owner do PrismaService. Rotas sob SuperAdminGuard.
 */
@Module({
  controllers: [CnaeController],
  providers: [CnaeDecisionEngine, CnaeRulesService, CnpjProviderService, SuperAdminGuard],
  exports: [CnaeDecisionEngine],
})
export class CnaeModule {}
