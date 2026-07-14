import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { InstrumentsService } from './instruments.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';

class InstrumentDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9-]{2,39}$/)
  slug?: string;

  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsIn(['MATURITY', 'RISK'])
  bandKind?: 'MATURITY' | 'RISK';

  @IsOptional() @IsIn(['MEDIA_PONDERADA', 'MEDIA_SIMPLES', 'SOMA_NORMALIZADA'])
  aggregation?: 'MEDIA_PONDERADA' | 'MEDIA_SIMPLES' | 'SOMA_NORMALIZADA';

  @IsOptional() @IsString() @MaxLength(600)
  description?: string | null;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

/** Catálogo de instrumentos do Motor de Diagnósticos. Owner-only. */
@Controller('admin/instruments')
@UseGuards(SuperAdminGuard)
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  list() {
    return this.instruments.list();
  }

  @Post()
  create(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: InstrumentDto) {
    return this.instruments.create(dto, { id: admin.id, email: admin.email });
  }

  @Put(':slug')
  update(@CurrentAdmin() admin: PlatformAdmin, @Param('slug') slug: string, @Body() dto: InstrumentDto) {
    return this.instruments.update(slug, dto, { id: admin.id, email: admin.email });
  }

  @Delete(':slug')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('slug') slug: string) {
    return this.instruments.remove(slug, { id: admin.id, email: admin.email });
  }
}
