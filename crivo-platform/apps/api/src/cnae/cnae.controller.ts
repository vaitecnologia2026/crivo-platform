import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { CurrentAdmin } from '../admin/platform-admin.decorator';
import { CnaeDecisionEngine } from './cnae-decision.engine';
import { CnaeRulesService } from './cnae-rules.service';
import { CnpjProviderService } from './cnpj-provider.service';
import type { CnaeEvaluationInput } from './cnae-decision.types';
import { ConsultCnpjDto, EvaluateCnaeDto, ReviewDecisionDto, UpdateCnaeDivisionDto } from './cnae.dto';

/**
 * Motor de Decisão CNAE/NR-1 — exclusivo do super admin/especialista.
 * Rotas (após o prefixo global /api):
 *   POST /cnpj/consult                      → consulta CNPJ (provedor externo)
 *   POST /cnae-decision/evaluate            → recomendação a partir de dados informados
 *   POST /cnae-decision/from-cnpj           → consulta + recomendação em um passo
 *   GET  /cnae-decision/history             → histórico de decisões
 *   PATCH /cnae-decision/history/:id/review → marca como revisado por especialista
 *   GET  /cnae-divisions                    → lista regras (filtros risk/method/q/active)
 *   GET  /cnae-divisions/:code              → regra por código de divisão
 *   PUT  /cnae-divisions/:id                → edita a regra (admin)
 */
@Controller()
@UseGuards(SuperAdminGuard)
export class CnaeController {
  constructor(
    private readonly engine: CnaeDecisionEngine,
    private readonly rules: CnaeRulesService,
    private readonly cnpj: CnpjProviderService,
  ) {}

  @Post('cnpj/consult')
  async consult(@Body() dto: ConsultCnpjDto) {
    const data = await this.cnpj.consult(dto.cnpj);
    if (!data) return { ok: false, error: 'CNPJ não encontrado ou indisponível no provedor.' };
    return { ok: true, data };
  }

  @Post('cnae-decision/evaluate')
  evaluate(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: EvaluateCnaeDto) {
    return this.engine.evaluate(dto, { id: admin.id, email: admin.email });
  }

  /** Consulta o CNPJ e já roda o motor com os sinais operacionais informados. */
  @Post('cnae-decision/from-cnpj')
  async fromCnpj(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: EvaluateCnaeDto) {
    const company = dto.cnpj ? await this.cnpj.consult(dto.cnpj) : null;
    const input: CnaeEvaluationInput = {
      ...dto,
      cnpj: company?.cnpj ?? dto.cnpj ?? null,
      razaoSocial: company?.razaoSocial ?? dto.razaoSocial ?? null,
      nomeFantasia: company?.nomeFantasia ?? dto.nomeFantasia ?? null,
      cnaePrincipalCodigo: company?.cnaePrincipalCodigo ?? dto.cnaePrincipalCodigo ?? null,
      cnaePrincipalDescricao: company?.cnaePrincipalDescricao ?? dto.cnaePrincipalDescricao ?? null,
      cnaesSecundarios: company?.cnaesSecundarios?.map((c) => c.codigo) ?? dto.cnaesSecundarios ?? [],
      situacaoCadastral: company?.situacaoCadastral ?? dto.situacaoCadastral ?? null,
      porte: company?.porte ?? dto.porte ?? null,
    };
    const decision = await this.engine.evaluate(input, { id: admin.id, email: admin.email });
    return { ok: true, company, decision };
  }

  @Get('cnae-decision/history')
  history(@Query('limit') limit?: string) {
    return this.rules.listHistory(limit ? parseInt(limit, 10) : 100);
  }

  @Patch('cnae-decision/history/:id/review')
  review(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.rules.markReviewed(id, { email: admin.email }, dto.reviewNotes);
  }

  @Get('cnae-divisions')
  listDivisions(
    @Query('risk') risk?: string,
    @Query('method') method?: string,
    @Query('q') q?: string,
    @Query('active') active?: string,
  ) {
    return this.rules.listDivisions({ risk, method, q, active });
  }

  @Get('cnae-divisions/:code')
  getDivision(@Param('code') code: string) {
    return this.rules.getDivision(code);
  }

  @Put('cnae-divisions/:id')
  updateDivision(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCnaeDivisionDto) {
    return this.rules.updateDivision(id, dto);
  }
}
