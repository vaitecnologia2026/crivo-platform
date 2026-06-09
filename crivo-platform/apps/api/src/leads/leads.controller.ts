import { Body, Controller, Get, Param, Patch, Post, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RequirePermission } from '../iam/require-permission.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

// Piloto do RBAC dinâmico (F3): autorização por permissão (modulo:acao) em vez
// de lista de papéis hard-coded. As permissões vêm do catálogo (PermissionGuard).
@Controller('leads')
@UseGuards(AuthGuard, PermissionGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Pipeline de leads do tenant. */
  @Get()
  @RequirePermission('leads:view')
  list(@CurrentUser() user: SessionUser) {
    return this.leads.list(user.tenantId);
  }

  /** Cria um lead (cadastro manual). */
  @Post()
  @RequirePermission('leads:create')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user.tenantId, dto);
  }

  /** Move um lead de estágio / atualiza notas. */
  @Patch(':id')
  @RequirePermission('leads:edit')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user.tenantId, id, dto);
  }
}
