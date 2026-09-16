import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MODULE_CATALOG_STATUSES, type ModuleCatalogStatus, type PlatformAdmin } from '@crivo/types';
import { ModuleCatalogService } from './module-catalog.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';

class ModuleCatalogUpdateDto {
  @IsOptional() @IsString() @MaxLength(600)
  description?: string | null;

  @IsOptional() @IsString() @MaxLength(240)
  dependenciesNote?: string | null;

  @IsOptional() @IsString() @MaxLength(240)
  permissionsNote?: string | null;

  @IsOptional() @IsString() @MaxLength(400)
  releaseRule?: string | null;

  @IsOptional() @IsIn(MODULE_CATALOG_STATUSES as unknown as string[])
  status?: ModuleCatalogStatus;
}

/** Módulos Técnicos (Catálogo Comercial) — registro interno, owner-only. */
@Controller('admin/module-catalog')
@UseGuards(SuperAdminGuard)
export class ModuleCatalogController {
  constructor(private readonly catalog: ModuleCatalogService) {}

  @Get()
  list() {
    return this.catalog.list();
  }

  /** Só os campos editoriais mudam aqui; código/nome/plano mínimo vêm do deploy. */
  @Put(':code')
  update(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('code') code: string,
    @Body() dto: ModuleCatalogUpdateDto,
  ) {
    return this.catalog.update(code, dto, { id: admin.id, email: admin.email });
  }
}
