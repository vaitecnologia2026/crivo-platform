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
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './require-permission.decorator';
import { CurrentUser } from './current-user.decorator';
import { TenantRolesService } from './tenant-roles.service';
import type { SessionUser } from '@crivo/types';

class CreateTenantRoleDto {
  @IsString() @MinLength(2) @MaxLength(60) code!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsArray() @IsString({ each: true }) permissions!: string[];
}

class UpdateTenantRoleDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

/**
 * RBAC dinâmico (#68) — gestão de papéis customizados.
 * Read aberto a qualquer autenticado; gestão requer `users:edit`.
 */
@Controller('tenant-roles')
@UseGuards(AuthGuard, PermissionGuard)
export class TenantRolesController {
  constructor(private readonly svc: TenantRolesService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.svc.list(user.tenantId);
  }

  /** Lista usuários do tenant com seus papéis (sistema + custom). */
  @Get('users')
  @RequirePermission('users:view')
  users(@CurrentUser() user: SessionUser) {
    return this.svc.usersWithRoles(user.tenantId);
  }

  @Post()
  @RequirePermission('users:edit')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateTenantRoleDto) {
    return this.svc.create(user.tenantId, dto, { id: user.id, email: user.email });
  }

  @Patch(':id')
  @RequirePermission('users:edit')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantRoleDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, { id: user.id, email: user.email });
  }

  @Delete(':id')
  @RequirePermission('users:edit')
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(user.tenantId, id, { id: user.id, email: user.email });
  }

  @Post(':id/users/:userId')
  @RequirePermission('users:edit')
  assign(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) roleId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.svc.assignToUser(user.tenantId, roleId, userId, {
      id: user.id,
      email: user.email,
    });
  }

  @Delete(':id/users/:userId')
  @RequirePermission('users:edit')
  unassign(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) roleId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.svc.unassignFromUser(user.tenantId, roleId, userId, {
      id: user.id,
      email: user.email,
    });
  }
}
