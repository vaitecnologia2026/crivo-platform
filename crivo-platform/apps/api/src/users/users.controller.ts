import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RequirePermission } from '../iam/require-permission.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

/** Gestão do time da empresa. Autorização por permissão (users:*), dados sob RLS. */
@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users:view')
  list(@CurrentUser() user: SessionUser) {
    return this.users.list(user.tenantId);
  }

  /** Cria um usuário (senha gerada e retornada 1× se ausente). Respeita maxUsers. */
  @Post()
  @RequirePermission('users:create')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId, dto);
  }

  /** Atualiza papel / (des)ativa um usuário. */
  @Patch(':id')
  @RequirePermission('users:edit')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user.tenantId, id, dto);
  }
}
