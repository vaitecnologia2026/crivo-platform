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
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequirePermission } from '../iam/require-permission.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { ParecerService } from './parecer.service';
import { UpsertParecerDto } from './dto';

/**
 * Parecer Consultivo CRIVO (Briefing §6). Gateado pelo módulo "parecer" (plano
 * Advisory). Leitura exige parecer:view; autoria/publicação exige parecer:manage
 * (papel Consultor CRIVO e gestão). Data plane (RLS por tenant).
 */
@Controller('parecer')
@UseGuards(AuthGuard, ModuleGuard, PermissionGuard)
@RequireModule('parecer')
@RequirePermission('parecer:view')
export class ParecerController {
  constructor(private readonly parecer: ParecerService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.parecer.list(user.tenantId);
  }

  @Get(':id/document')
  document(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parecer.generateDocument(user.tenantId, id);
  }

  @Post()
  @RequirePermission('parecer:manage')
  create(@CurrentUser() user: SessionUser, @Body() dto: UpsertParecerDto) {
    return this.parecer.create(user.tenantId, dto, user.name ?? user.email);
  }

  @Patch(':id')
  @RequirePermission('parecer:manage')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertParecerDto,
  ) {
    return this.parecer.update(user.tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermission('parecer:manage')
  publish(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parecer.publish(user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermission('parecer:manage')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parecer.remove(user.tenantId, id);
  }
}
