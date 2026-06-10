import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { ProvisioningService } from './provisioning.service';
import { TenantModulesService } from './tenant-modules.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { CreateTenantDto, SetModuleDto } from './dto';
import type { PlatformAdmin } from '@crivo/types';

/** Control plane — gestão de empresas-cliente. Exclusivo de super admins. */
@Controller('admin/tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: ProvisioningService,
    private readonly modules: TenantModulesService,
  ) {}

  /** Lista todas as empresas. */
  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.get(id);
  }

  /** Provisiona uma nova empresa (org + tenant + admin inicial). */
  @Post()
  create(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: CreateTenantDto) {
    return this.provisioning.provision(dto, { id: admin.id, email: admin.email });
  }

  /** Bloqueia a empresa (usuários deixam de conseguir logar). */
  @Patch(':id/suspend')
  suspend(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.setStatus(id, 'SUSPENDED', { id: admin.id, email: admin.email });
  }

  /** Reativa uma empresa bloqueada. */
  @Patch(':id/activate')
  activate(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.setStatus(id, 'ACTIVE', { id: admin.id, email: admin.email });
  }

  /** Exclusão lógica (reversível). */
  @Delete(':id')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.softDelete(id, { id: admin.id, email: admin.email });
  }

  // ── Módulos (F4) ──

  /** Catálogo de módulos + estado (ativo / disponível no plano) da empresa. */
  @Get(':id/modules')
  listModules(@Param('id', ParseUUIDPipe) id: string) {
    return this.modules.list(id);
  }

  /** (Des)ativa um módulo da empresa. Ativar exige que o plano permita. */
  @Patch(':id/modules/:code')
  setModule(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('code') code: string,
    @Body() dto: SetModuleDto,
  ) {
    return this.modules.setEnabled(id, code, dto.enabled, { id: admin.id, email: admin.email });
  }
}
