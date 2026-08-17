import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  /** O que o cliente registra no Portal e não é ação: ciclos e devolutivas. */
  @Get('client-activity')
  clientActivity() {
    return this.engine.listClientActivity();
  }

  @Get('evidences')
  evidences(@Query('status') status?: string, @Query('kind') kind?: string) {
    return this.engine.listEvidences({ status, kind });
  }

  /**
   * Baixa o ARQUIVO que o cliente anexou como evidência. Sem esta rota o Super
   * Admin decidia aprovar/rejeitar sem conseguir abrir o anexo — o download que
   * existia é escopado pelo tenant do Portal.
   */
  @Get('evidences/:id/file')
  async downloadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const f = await this.engine.getEvidenceFile(id);
    res.set({
      'Content-Type': f.fileMime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(f.fileName)}"`,
    });
    return new StreamableFile(f.data);
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
