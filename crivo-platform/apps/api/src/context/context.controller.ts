import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequirePermission } from '../iam/require-permission.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { ContextService, type UploadedDocumentFile } from './context.service';
import {
  ChangeTenantDirectiveStatusDto,
  ChangeTenantDocumentStatusDto,
  RevokeTenantDocumentDto,
  UpdateTenantAiUseCaseContextDto,
  UpsertTenantDirectiveDto,
  UpsertTenantTermDto,
} from './dto';

/** Papéis de gestão que enxergam o programa (o LIDER fica fora por papel, não por lista de features). */
const ROLES = ['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR'] as const;

/** Cap do upload (mesmo teto das evidências e dos anexos de prompt). */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Programas › Contexto e Diretrizes (rota 'contexto' do portal). Padrão
 * completo de guards do parecer.controller: sessão + módulo 'contexto' ativo
 * no contrato + papel de gestão + tela liberada na checklist do usuário.
 * Leitura é por papel; toda ESCRITA (diretriz, documento, termo, caso de uso)
 * exige a permissão context:manage (RH/GESTOR/CEO/ADMIN por padrão; o
 * Consultor CRIVO só lê — quem aprova o contexto da empresa é a empresa).
 */
@Controller('context')
@UseGuards(AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard)
@RequireModule('contexto')
@RequireScreen('contexto')
@Roles(...ROLES)
export class ContextController {
  constructor(private readonly svc: ContextService) {}

  private actor(user: SessionUser) {
    return { id: user.id, name: user.name, email: user.email };
  }

  /** Metadados dos formulários (CNPJ, unidades) + gate comercial + contagens. */
  @Get('overview')
  overview(@CurrentUser() user: SessionUser) {
    return this.svc.overview(user.tenantId);
  }

  // ── Diretrizes ──

  @Get('directives')
  listDirectives(@CurrentUser() user: SessionUser) {
    return this.svc.listDirectives(user.tenantId);
  }

  @Post('directives')
  @RequirePermission('context:manage')
  createDirective(@CurrentUser() user: SessionUser, @Body() dto: UpsertTenantDirectiveDto) {
    return this.svc.createDirective(user.tenantId, dto, this.actor(user));
  }

  @Put('directives/:id')
  @RequirePermission('context:manage')
  updateDirective(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTenantDirectiveDto,
  ) {
    return this.svc.updateDirective(user.tenantId, id, dto, this.actor(user));
  }

  /** Rascunho → Em revisão → Aprovada | Revogada (justificativa obrigatória ao revogar). */
  @Post('directives/:id/status')
  @RequirePermission('context:manage')
  changeDirectiveStatus(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTenantDirectiveStatusDto,
  ) {
    return this.svc.changeDirectiveStatus(user.tenantId, id, dto, this.actor(user));
  }

  // ── Documentos autorizados ──

  @Get('documents')
  listDocuments(@CurrentUser() user: SessionUser, @Query('status') status?: string) {
    return this.svc.listDocuments(user.tenantId, status);
  }

  /**
   * "Adicionar documento": multipart (`file` + campos) OU JSON com `url`.
   * Entra como Rascunho; o texto do arquivo é extraído na hora (pdf/docx/…).
   */
  @Post('documents')
  @RequirePermission('context:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  createDocument(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.createDocument(user.tenantId, body ?? {}, file, this.actor(user));
  }

  @Get('documents/:id')
  getDocument(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getDocument(user.tenantId, id);
  }

  /** Download do arquivo enviado (sob RLS do próprio tenant). */
  @Get('documents/:id/file')
  async downloadDocument(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const f = await this.svc.getDocumentFile(user.tenantId, id);
    res.set({
      'Content-Type': f.fileMime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(f.fileName)}"`,
    });
    return new StreamableFile(f.data);
  }

  /** Rascunho ↔ Em revisão → Aprovado/Publicado (Revogar tem rota própria; Substituído só via replace). */
  @Post('documents/:id/status')
  @RequirePermission('context:manage')
  changeDocumentStatus(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTenantDocumentStatusDto,
  ) {
    return this.svc.changeDocumentStatus(user.tenantId, id, dto, this.actor(user));
  }

  /** Nova versão (multipart `file` ou JSON `url`, `version` opcional): a anterior vira Substituído. */
  @Post('documents/:id/replace')
  @RequirePermission('context:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  replaceDocument(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.replaceDocument(user.tenantId, id, body ?? {}, file, this.actor(user));
  }

  @Post('documents/:id/revoke')
  @RequirePermission('context:manage')
  revokeDocument(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeTenantDocumentDto,
  ) {
    return this.svc.revokeDocument(user.tenantId, id, dto.justification, this.actor(user));
  }

  // ── Terminologia ──

  @Get('terms')
  listTerms(@CurrentUser() user: SessionUser) {
    return this.svc.listTerms(user.tenantId);
  }

  @Post('terms')
  @RequirePermission('context:manage')
  createTerm(@CurrentUser() user: SessionUser, @Body() dto: UpsertTenantTermDto) {
    return this.svc.createTerm(user.tenantId, dto, this.actor(user));
  }

  @Put('terms/:id')
  @RequirePermission('context:manage')
  updateTerm(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTenantTermDto,
  ) {
    return this.svc.updateTerm(user.tenantId, id, dto, this.actor(user));
  }

  @Delete('terms/:id')
  @RequirePermission('context:manage')
  deleteTerm(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteTerm(user.tenantId, id, this.actor(user));
  }

  // ── Casos de uso da IA ──

  @Get('ai-use-cases')
  listAiUseCases(@CurrentUser() user: SessionUser) {
    return this.svc.listAiUseCases(user.tenantId);
  }

  /** Documentos permitidos + toggle "uso contextual ativo" (só liga com o adicional premium). */
  @Put('ai-use-cases/:useCase')
  @RequirePermission('context:manage')
  updateAiUseCase(
    @CurrentUser() user: SessionUser,
    @Param('useCase') useCase: string,
    @Body() dto: UpdateTenantAiUseCaseContextDto,
  ) {
    return this.svc.updateAiUseCase(user.tenantId, useCase, dto, this.actor(user));
  }

  // ── Histórico e Auditoria ──

  @Get('audit')
  audit(@CurrentUser() user: SessionUser) {
    return this.svc.auditTrail(user.tenantId);
  }
}
