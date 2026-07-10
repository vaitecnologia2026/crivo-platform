import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { PlatformUsersService } from './platform-users.service';

class CreatePlatformUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  role?: string;
}

class UpdatePlatformUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  role?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  resetPassword?: boolean;
}

/**
 * Usuários CRIVO do painel (contas de super_admins com função organizacional).
 * Rotas sob /admin/platform-users (após o prefixo /api). Super admin only.
 */
@Controller('admin/platform-users')
@UseGuards(SuperAdminGuard)
export class PlatformUsersController {
  constructor(private readonly svc: PlatformUsersService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreatePlatformUserDto, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.create(dto, { id: admin.id, email: admin.email });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformUserDto,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.update(id, dto, { id: admin.id, email: admin.email });
  }
}
