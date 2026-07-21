import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { EngineService } from './engine.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';

class ReviewEvidenceDto {
  @IsIn(['approve', 'reject', 'supersede'])
  action!: 'approve' | 'reject' | 'supersede';

  @IsOptional() @IsString() @MaxLength(400)
  reason?: string;
}

class EngineConfigDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  minRespondents?: number;

  @IsOptional() @IsIn(['MEDIA_PONDERADA', 'MEDIA_SIMPLES', 'SOMA_NORMALIZADA'])
  defaultAggregation?: 'MEDIA_PONDERADA' | 'MEDIA_SIMPLES' | 'SOMA_NORMALIZADA';

  @IsOptional() @IsIn(['MATURITY', 'RISK'])
  defaultBandKind?: 'MATURITY' | 'RISK';

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(60, { each: true })
  defaultScaleLabels?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(3)
  defaultRounding?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  defaultMinValidCompletionPercent?: number;
}

/** Motores CRIVO (Configuração do Motor · Evolução · Evidências). Owner-only. */
@Controller('admin/engine')
@UseGuards(SuperAdminGuard)
export class EngineController {
  constructor(private readonly engine: EngineService) {}

  @Get('config')
  getConfig() {
    return this.engine.getConfig();
  }

  @Put('config')
  saveConfig(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: EngineConfigDto) {
    return this.engine.saveConfig(dto, { id: admin.id, email: admin.email });
  }

  @Get('overview')
  overview() {
    return this.engine.overview();
  }

  @Get('actions')
  actions(
    @Query('status') status?: string,
    @Query('withoutEvidence') withoutEvidence?: string,
    @Query('q') q?: string,
  ) {
    return this.engine.listActions({ status, withoutEvidence: withoutEvidence === '1', q });
  }

  @Get('evidences')
  evidences(@Query('status') status?: string, @Query('kind') kind?: string) {
    return this.engine.listEvidences({ status, kind });
  }

  @Post('evidences/:id/review')
  reviewEvidence(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: ReviewEvidenceDto,
  ) {
    return this.engine.reviewEvidence(id, dto.action, { id: admin.id, email: admin.email }, dto.reason);
  }
}
