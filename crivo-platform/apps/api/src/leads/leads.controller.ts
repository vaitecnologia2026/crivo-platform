import { Body, Controller, Get, Param, Patch, Post, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

@Controller('leads')
@UseGuards(AuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Pipeline de leads do tenant. */
  @Get()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  list(@CurrentUser() user: SessionUser) {
    return this.leads.list(user.tenantId);
  }

  /** Cria um lead (cadastro manual). */
  @Post()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user.tenantId, dto);
  }

  /** Move um lead de estágio / atualiza notas. */
  @Patch(':id')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user.tenantId, id, dto);
  }
}
