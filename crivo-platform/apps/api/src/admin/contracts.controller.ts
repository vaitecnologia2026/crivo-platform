import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { ContractsService } from './contracts.service';

/**
 * Lista central de contratos ("Contratos e Liberações" — modelo aprovado).
 * O CRUD por empresa/grupo segue nas rotas de tenants/groups; aqui é a visão
 * consolidada em tabela. Super admin only.
 */
@Controller('admin/contracts')
@UseGuards(SuperAdminGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  list() {
    return this.contracts.listAll();
  }
}
