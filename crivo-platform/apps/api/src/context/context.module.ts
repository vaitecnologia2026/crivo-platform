import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AdminModule } from '../admin/admin.module';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';

/**
 * Contexto e Diretrizes (módulo 'contexto') — lado do CLIENTE (portal).
 * IamModule traz os guards; AdminModule traz o AuditService (trilha da aba
 * Histórico) e o pipeline de extração de texto. A LEITURA do que está
 * aprovado para o prompt não passa por aqui: AiSettingsService (admin/) lê as
 * tabelas com tenantId explícito — importar este módulo de dentro do
 * AdminModule fecharia um ciclo (IamModule → AdminModule).
 */
@Module({
  imports: [IamModule, AdminModule],
  controllers: [ContextController],
  providers: [ContextService],
  exports: [ContextService],
})
export class ContextModule {}
