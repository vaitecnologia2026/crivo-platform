import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { CollaboratorsService } from './collaborators.service';
import {
  CreateCollaboratorDto,
  ImportCollaboratorsDto,
  InviteManyDto,
  SendInviteDto,
  UpdateCollaboratorDto,
} from './dto';

/** Cadastro de colaboradores do tenant (link único p/ o diagnóstico contratado).
 *  Gate pelo módulo "campanhas" (mesmo dos diagnósticos) + tela "colaboradores". */
@Controller('collaborators')
@UseGuards(AuthGuard, ModuleGuard, ScreenAccessGuard, RolesGuard)
@RequireModule('campanhas')
@RequireScreen('colaboradores')
export class CollaboratorsController {
  constructor(private readonly svc: CollaboratorsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.svc.list(user.tenantId);
  }

  @Post()
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateCollaboratorDto) {
    return this.svc.create(user.tenantId, dto);
  }

  @Post('import')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  importMany(@CurrentUser() user: SessionUser, @Body() dto: ImportCollaboratorsDto) {
    return this.svc.importMany(user.tenantId, dto.rows);
  }

  @Patch(':id')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    return this.svc.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  remove(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(user.tenantId, id);
  }

  /** Participantes de uma campanha (todo o cadastro + status DAQUELE ciclo). */
  @Get('campaign/:cycleId')
  participants(@CurrentUser() user: SessionUser, @Param('cycleId', new ParseUUIDPipe()) cycleId: string) {
    return this.svc.participants(user.tenantId, cycleId);
  }

  /** Convite em lote pela tela da Campanha (sem ids = todos os pendentes). */
  @Post('campaign/:cycleId/invite')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  inviteMany(
    @CurrentUser() user: SessionUser,
    @Param('cycleId', new ParseUUIDPipe()) cycleId: string,
    @Body() dto: InviteManyDto,
  ) {
    return this.svc.inviteMany(user.tenantId, cycleId, dto.ids);
  }

  /** Link do convite para copiar — também dentro de uma campanha. */
  @Post(':id/link')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  inviteLink(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendInviteDto,
  ) {
    return this.svc.inviteLink(user.tenantId, id, dto.cycleId);
  }

  /** Convite SEMPRE dentro de uma campanha: o corpo traz o ciclo escolhido. */
  @Post(':id/send-email')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  sendEmail(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendInviteDto,
  ) {
    return this.svc.sendEmailInvite(user.tenantId, id, dto.cycleId);
  }

  @Post(':id/send-whatsapp')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  sendWhatsapp(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendInviteDto,
  ) {
    return this.svc.sendWhatsappInvite(user.tenantId, id, dto.cycleId);
  }
}
