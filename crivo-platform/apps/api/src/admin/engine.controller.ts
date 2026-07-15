import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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

/** Motores CRIVO (Configuração do Motor · Evolução · Evidências). Owner-only. */
@Controller('admin/engine')
@UseGuards(SuperAdminGuard)
export class EngineController {
  constructor(private readonly engine: EngineService) {}

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
