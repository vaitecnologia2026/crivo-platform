import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ADDON_RECURRENCES, ADDON_STATUSES, type AddonRecurrence, type AddonStatus, type PlatformAdmin } from '@crivo/types';
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

  // Catálogo do cliente (mockup 14/07)
  @IsOptional() @IsString() @MaxLength(400)
  description?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string | null;

  @IsOptional() @IsIn(ADDON_RECURRENCES as unknown as string[])
  recurrence?: AddonRecurrence;

  @IsOptional() @IsString() @MaxLength(80)
  priceLabel?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  compatibleSolutions?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  activatedModules?: string[];

  @IsOptional() @IsString() @MaxLength(160)
  limitsNote?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  dependenciesNote?: string | null;

  @IsOptional() @IsString() @MaxLength(240)
  releaseRule?: string | null;

  @IsOptional() @IsIn(ADDON_STATUSES as unknown as string[])
  statusEx?: AddonStatus;
}

/** Catálogo de adicionais (upsells) — tabela do cliente. Owner-only. */
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

  @Delete(':moduleCode')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('moduleCode') moduleCode: string) {
    return this.addons.remove(moduleCode, { id: admin.id, email: admin.email });
  }
}
