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
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CreateTenantDto } from './dto';

/** Control plane — gestão de empresas-cliente. Exclusivo de super admins. */
@Controller('admin/tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: ProvisioningService,
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
  create(@Body() dto: CreateTenantDto) {
    return this.provisioning.provision(dto);
  }

  /** Bloqueia a empresa (usuários deixam de conseguir logar). */
  @Patch(':id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.setStatus(id, 'SUSPENDED');
  }

  /** Reativa uma empresa bloqueada. */
  @Patch(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.setStatus(id, 'ACTIVE');
  }

  /** Exclusão lógica (reversível). */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.softDelete(id);
  }
}
