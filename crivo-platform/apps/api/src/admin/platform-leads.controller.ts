import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { PlatformLeadsService } from './platform-leads.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { ConvertLeadDto, CreateLeadFromCnpjDto, SetLeadNotesDto, SetLeadStageDto } from './commerce.dto';

/** CRM do super admin (funil comercial da CRIVO). Exclusivo de super admins. */
@Controller('admin/leads')
@UseGuards(SuperAdminGuard)
export class PlatformLeadsController {
  constructor(private readonly leads: PlatformLeadsService) {}

  @Get()
  list() {
    return this.leads.list();
  }

  /** Move o lead no funil (Kanban). */
  @Patch(':id/stage')
  setStage(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLeadStageDto,
  ) {
    return this.leads.setStage(id, dto.stage, { id: admin.id, email: admin.email });
  }

  @Patch(':id/notes')
  setNotes(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLeadNotesDto,
  ) {
    return this.leads.setNotes(id, dto.notes, { id: admin.id, email: admin.email });
  }

  /** Converte o lead em cliente, provisionando a empresa pelo produto contratado. */
  @Post(':id/convert')
  convert(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leads.convert(id, dto.productId, { id: admin.id, email: admin.email });
  }

  /** Cria um lead a partir da consulta de CNPJ (Dashboard); converte se houver productId. */
  @Post('from-cnpj')
  fromCnpj(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: CreateLeadFromCnpjDto) {
    return this.leads.createFromCnpj(dto, { id: admin.id, email: admin.email });
  }

  /** #12 — Envia o acesso do cliente por e-mail (gera nova senha temporária). */
  @Post(':id/send-access')
  sendAccess(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.sendAccess(id, { id: admin.id, email: admin.email });
  }

  /**
   * #18 — Zera os DADOS de teste (super admin + confirmação explícita).
   * MANTÉM login, catálogo de produtos e RBAC. Exige body { "confirm": "ZERAR" }.
   */
  @Post('reset-data')
  resetData(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: { confirm?: string }) {
    if (dto?.confirm !== 'ZERAR') {
      throw new BadRequestException('Confirmação inválida. Envie { "confirm": "ZERAR" } para zerar a base.');
    }
    return this.leads.resetTestData({ id: admin.id, email: admin.email });
  }

  /** Remove leads duplicados pelo mesmo CNPJ (mantém convertidos + o melhor aberto). */
  @Post('dedup')
  dedup(@CurrentAdmin() admin: PlatformAdmin) {
    return this.leads.dedupLeads({ id: admin.id, email: admin.email });
  }
}
