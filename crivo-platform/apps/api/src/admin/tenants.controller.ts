import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { TenantsService } from './tenants.service';
import { GroupsService } from './groups.service';
import { ProvisioningService } from './provisioning.service';
import { TenantModulesService } from './tenant-modules.service';
import { TenantBrandingService } from './tenant-branding.service';
import { DomainsService } from './domains.service';
import { ContractsService } from './contracts.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { AddDomainDto, CreateTenantDto, SetModuleDto, SetPlanDto, UpdateBrandingDto } from './dto';
import { UpsertContractDto } from './commerce.dto';
import type { PlatformAdmin } from '@crivo/types';

class SetTenantGroupDto {
  /** null/ausente = desvincular do grupo. */
  @IsOptional() @IsUUID()
  groupId?: string | null;
}

/** Control plane — gestão de empresas-cliente. Exclusivo de super admins. */
@Controller('admin/tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly groups: GroupsService,
    private readonly provisioning: ProvisioningService,
    private readonly modules: TenantModulesService,
    private readonly branding: TenantBrandingService,
    private readonly domains: DomainsService,
    private readonly contracts: ContractsService,
  ) {}

  /** Vincula/desvincula a empresa a um Grupo Empresarial (F1 · Tela 06). */
  @Patch(':id/group')
  setGroup(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTenantGroupDto,
  ) {
    return this.groups.assignTenant(id, dto.groupId ?? null, { id: admin.id, email: admin.email });
  }

  // ── Contrato (Briefing §11) ──

  /** Contrato vigente da empresa (ou null). */
  @Get(':id/contract')
  getContract(@Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.get(id);
  }

  /** Cria/atualiza o contrato da empresa (produto, prazo, AEP/PGR, módulos, status). */
  @Put(':id/contract')
  upsertContract(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertContractDto,
  ) {
    return this.contracts.upsert(id, dto, { id: admin.id, email: admin.email });
  }

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

  /** Troca o plano da empresa (re-sincroniza os módulos). */
  @Patch(':id/plan')
  setPlan(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPlanDto,
  ) {
    return this.tenants.setPlan(id, dto.plan, { id: admin.id, email: admin.email });
  }

  /** Uso corrente da empresa vs. limites do plano. */
  @Get(':id/usage')
  usage(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.usage(id);
  }

  // ── White-label (F5) ──

  /** Identidade visual da empresa. */
  @Get(':id/branding')
  getBranding(@Param('id', ParseUUIDPipe) id: string) {
    return this.branding.get(id);
  }

  /** Atualiza a identidade visual (logo, cores, contatos, rodapé). */
  @Put(':id/branding')
  updateBranding(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.branding.update(id, dto, { id: admin.id, email: admin.email });
  }

  // ── Domínios próprios (F5) ──

  /** Domínios da empresa (primary primeiro). */
  @Get(':id/domains')
  listDomains(@Param('id', ParseUUIDPipe) id: string) {
    return this.domains.list(id);
  }

  /** Adiciona um domínio (o 1º vira canônico). */
  @Post(':id/domains')
  addDomain(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDomainDto,
  ) {
    return this.domains.add(id, dto.domain, { id: admin.id, email: admin.email });
  }

  /** Define o domínio canônico (primary). */
  @Patch(':id/domains/:domainId/primary')
  setPrimaryDomain(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.domains.setPrimary(id, domainId, { id: admin.id, email: admin.email });
  }

  /** Verifica posse do domínio via DNS TXT em `_crivo.<domain>`. */
  @Post(':id/domains/:domainId/verify')
  verifyDomain(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.domains.verify(id, domainId, { id: admin.id, email: admin.email });
  }

  /** Remove um domínio da empresa. */
  @Delete(':id/domains/:domainId')
  removeDomain(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.domains.remove(id, domainId, { id: admin.id, email: admin.email });
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
