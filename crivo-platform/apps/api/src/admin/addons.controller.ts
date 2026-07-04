import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { AddonsService } from './addons.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';

class AddonUpsertDto {
  @IsOptional() @IsString() @MaxLength(120)
  label?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000)
  monthlyPriceCents?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000)
  setupPriceCents?: number;

  @IsOptional() @IsBoolean()
  recurring?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

/** Adicionais precificados (Tela 05 · modelo Adicional). Owner-only. */
@Controller('admin/addons')
@UseGuards(SuperAdminGuard)
export class AddonsController {
  constructor(private readonly addons: AddonsService) {}

  @Get()
  list() {
    return this.addons.list();
  }

  @Put(':moduleCode')
  upsert(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('moduleCode') moduleCode: string,
    @Body() dto: AddonUpsertDto,
  ) {
    return this.addons.upsert(moduleCode, dto, { id: admin.id, email: admin.email });
  }
}
