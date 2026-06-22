import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { CreateUserDto, UpdateUserDto } from '../users/dto';
import type { PlatformAdmin } from '@crivo/types';

/**
 * Control plane — gestão de usuários de QUALQUER empresa pelo Super Admin.
 * O tenant vem da rota; isolamento garantido no service (filtro por tenantId).
 */
@Controller('admin/tenants/:tenantId/users')
@UseGuards(SuperAdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  /** Lista os usuários da empresa. */
  @Get()
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.users.list(tenantId);
  }

  /** Uso de assentos (usuários ativos / limite do plano) da empresa. */
  @Get('seats')
  seats(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.users.seats(tenantId);
  }

  /** Cria um usuário na empresa (senha gerada e retornada 1× se ausente). */
  @Post()
  create(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.users.create(tenantId, dto, { id: admin.id, email: admin.email });
  }

  /** Atualiza papel / (des)ativa / telas de um usuário da empresa. */
  @Patch(':id')
  update(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(tenantId, id, dto, { id: admin.id, email: admin.email });
  }
}
