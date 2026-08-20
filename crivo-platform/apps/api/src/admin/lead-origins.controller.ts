import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { LeadOriginsService } from './lead-origins.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';

class LeadOriginUpsertDto {
  @IsOptional() @IsString() @MaxLength(80)
  label?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

/** Catálogo de origens/canais do lead (Governança · Origens e Canais). Owner-only. */
@Controller('admin/lead-origins')
@UseGuards(SuperAdminGuard)
export class LeadOriginsController {
  constructor(private readonly origins: LeadOriginsService) {}

  @Get()
  list() {
    return this.origins.list();
  }

  /** Cadastra ou edita. O `value` é o código; o serviço normaliza ("Google Ads" → GOOGLE_ADS). */
  @Put(':value')
  upsert(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('value') value: string,
    @Body() dto: LeadOriginUpsertDto,
  ) {
    return this.origins.upsert(value, dto, { id: admin.id, email: admin.email });
  }

  @Delete(':value')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('value') value: string) {
    return this.origins.remove(value, { id: admin.id, email: admin.email });
  }
}
