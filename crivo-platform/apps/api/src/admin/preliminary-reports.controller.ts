import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PreliminaryReportsService } from './preliminary-reports.service';

class GenerateDto {
  @IsUUID()
  platformLeadId!: string;

  @IsOptional()
  @IsEmail()
  sendTo?: string;
}

class ResendDto {
  @IsEmail()
  sendTo!: string;
}

class ListQueryDto {
  @IsOptional()
  @IsUUID()
  platformLeadId?: string;
}

/** Relatório Preliminar CRIVO — endpoint do Super Admin (control plane). */
@Controller('admin/preliminary-reports')
@UseGuards(SuperAdminGuard)
export class PreliminaryReportsController {
  constructor(private readonly svc: PreliminaryReportsService) {}

  /** Lista relatórios. Filtro por platformLeadId quando informado. */
  @Get()
  list(@Query() q: ListQueryDto) {
    if (!q.platformLeadId) {
      // Sem filtro: devolve vazio para evitar varredura ampla na UI.
      return [];
    }
    return this.svc.listByLead(q.platformLeadId);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getById(id);
  }

  /** Gera um novo relatório. Retorna o registro final (PRONTO, ENVIADO ou ERRO). */
  @Post('generate')
  generate(@Body() dto: GenerateDto) {
    return this.svc.generate({ platformLeadId: dto.platformLeadId, sendTo: dto.sendTo });
  }

  /** Reenvia um relatório já gerado para outro destinatário. */
  @Post(':id/resend')
  resend(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ResendDto) {
    return this.svc.resend(id, dto.sendTo);
  }
}
