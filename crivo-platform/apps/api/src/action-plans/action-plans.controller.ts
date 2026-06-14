import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { ActionPlansService } from './action-plans.service';
import { DocumentsService } from './documents.service';
import {
  CreateActionItemDto,
  CreateActionPlanDto,
  CreateEvidenceDto,
  UpdateActionItemDto,
} from './dto';

/**
 * Plano de Ação + Evidências do tenant (Briefing §8/§9). Gateado pelo módulo
 * "relatorios" (Relatórios, Evidências & Comunicações) já existente no catálogo.
 */
@Controller('action-plans')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('relatorios')
export class ActionPlansController {
  constructor(
    private readonly plans: ActionPlansService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Documentos gerados (Briefing §15) ──

  /** Documentos disponíveis conforme método + saída técnica do contrato. */
  @Get('documents')
  availableDocuments(@CurrentUser() user: SessionUser) {
    return this.documents.available(user.tenantId);
  }

  /** Conteúdo estruturado de um documento (montado dos dados reais). */
  @Get('documents/:type')
  generateDocument(@CurrentUser() user: SessionUser, @Param('type') type: string) {
    return this.documents.generate(user.tenantId, type);
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.plans.list(user.tenantId);
  }

  @Post()
  createPlan(@CurrentUser() user: SessionUser, @Body() dto: CreateActionPlanDto) {
    return this.plans.createPlan(user.tenantId, dto);
  }

  @Post(':planId/items')
  addItem(
    @CurrentUser() user: SessionUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreateActionItemDto,
  ) {
    return this.plans.addItem(user.tenantId, planId, dto);
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
    return this.plans.updateItem(user.tenantId, itemId, dto);
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
}
