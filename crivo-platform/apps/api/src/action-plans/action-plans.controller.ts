import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { ActionPlansService } from './action-plans.service';
import { CyclesService } from './cycles.service';
import { DocumentsService } from './documents.service';
import {
  CreateActionItemDto,
  CreateActionPlanDto,
  CreateEvidenceDto,
  UpdateActionItemDto,
  CreateDevolutivaDto,
  OpenCycleDto,
} from './dto';

/**
 * Plano de Ação + Evidências do tenant (Briefing §8/§9). Gateado pelo módulo
 * "relatorios" (Relatórios, Evidências & Comunicações) já existente no catálogo.
 */
@Controller('action-plans')
@UseGuards(AuthGuard, ModuleGuard, ScreenAccessGuard)
@RequireModule('relatorios')
@RequireScreen('relatorios')
export class ActionPlansController {
  constructor(
    private readonly plans: ActionPlansService,
    private readonly documents: DocumentsService,
    private readonly cycles: CyclesService,
  ) {}

  // ── Documentos gerados (Briefing §15) ──

  /** Documentos disponíveis conforme método + saída técnica do contrato. */
  @Get('documents')
  availableDocuments(@CurrentUser() user: SessionUser) {
    return this.documents.available(user.tenantId);
  }

  /** Conteúdo estruturado de um documento (montado dos dados reais). */
  @Get('documents/emissions')
  listEmissions(@CurrentUser() user: SessionUser) {
    return this.documents.listEmissions(user.tenantId);
  }

  @Get('documents/emissions/:id')
  getEmission(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.documents.getEmission(user.tenantId, id);
  }

  @Post('documents/:type/emit')
  emitDocument(@CurrentUser() user: SessionUser, @Param('type') type: string) {
    return this.documents.emit(user.tenantId, type, user.email);
  }

  @Get('documents/:type')
  generateDocument(@CurrentUser() user: SessionUser, @Param('type') type: string) {
    return this.documents.generate(user.tenantId, type);
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.plans.list(user.tenantId);
  }

  /** §8 — Ações sugeridas automaticamente a partir do diagnóstico (tensão dominante). */
  @Get('suggested-actions')
  suggestedActions(@CurrentUser() user: SessionUser) {
    return this.plans.suggestedActions(user.tenantId);
  }

  @Post()
  createPlan(@CurrentUser() user: SessionUser, @Body() dto: CreateActionPlanDto) {
    return this.plans.createPlan(user.tenantId, dto);
  }

  // ── F4 — Ciclos formais de diagnóstico (snapshot p/ TPL-003) ──

  @Get('cycles')
  listCycles(@CurrentUser() user: SessionUser) {
    return this.cycles.list(user.tenantId);
  }

  /** Abrir/encerrar ciclo é ato FORMAL (encerramento é irreversível) — papéis de gestão. */
  @Post('cycles')
  @UseGuards(RolesGuard)
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  openCycle(@CurrentUser() user: SessionUser, @Body() dto: OpenCycleDto) {
    return this.cycles.open(user.tenantId, dto?.label, user.name ?? user.email);
  }

  @Post('cycles/:id/close')
  @UseGuards(RolesGuard)
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  closeCycle(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.close(user.tenantId, id, user.name ?? user.email);
  }

  /** F2 — Registro de comunicação e devolutiva (TPL-002 §10). */
  @Get('devolutivas')
  listDevolutivas(@CurrentUser() user: SessionUser) {
    return this.plans.listDevolutivas(user.tenantId);
  }

  @Post('devolutivas')
  createDevolutiva(@CurrentUser() user: SessionUser, @Body() dto: CreateDevolutivaDto) {
    return this.plans.createDevolutiva(user.tenantId, dto, user.name ?? user.email);
  }

  @Post(':planId/items')
  addItem(
    @CurrentUser() user: SessionUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreateActionItemDto,
  ) {
    return this.plans.addItem(user.tenantId, planId, dto, user.name ?? user.email);
  }

  /** #61 — Importa um ActionTemplate (Biblioteca de Ações global) como item. */
  @Post(':planId/items-from-template/:templateId')
  addItemFromTemplate(
    @CurrentUser() user: SessionUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.plans.addItemFromTemplate(user.tenantId, planId, templateId, user.name ?? user.email);
  }

  @Post(':planId/validate')
  validate(@CurrentUser() user: SessionUser, @Param('planId', ParseUUIDPipe) planId: string) {
    return this.plans.validatePlan(user.tenantId, planId, user.name ?? user.email);
  }

  @Patch('items/:itemId')
  updateItem(
    @CurrentUser() user: SessionUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateActionItemDto,
  ) {
    return this.plans.updateItem(user.tenantId, itemId, dto, user.name ?? user.email);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: SessionUser, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.plans.removeItem(user.tenantId, itemId);
  }

  @Post('items/:itemId/evidences')
  addEvidence(
    @CurrentUser() user: SessionUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateEvidenceDto,
  ) {
    return this.plans.addEvidence(user.tenantId, itemId, dto);
  }

  /** §9 — Evidência por UPLOAD de arquivo (multipart). Cap de 8 MB; bytes vão
   *  para evidence_files. kind/title/note vêm como campos do form. */
  @Post('items/:itemId/evidences/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadEvidence(
    @CurrentUser() user: SessionUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile()
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body() body: { kind?: string; title?: string; note?: string },
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório.');
    return this.plans.addFileEvidence(
      user.tenantId,
      itemId,
      { kind: body.kind || 'documento', title: body.title || file.originalname, note: body.note },
      file,
    );
  }

  /** §9 — Download do arquivo de uma evidência (sob RLS do próprio tenant). */
  @Get('evidences/:id/file')
  async downloadEvidence(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const f = await this.plans.getEvidenceFile(user.tenantId, id);
    res.set({
      'Content-Type': f.fileMime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(f.fileName)}"`,
    });
    return new StreamableFile(f.data);
  }
}
