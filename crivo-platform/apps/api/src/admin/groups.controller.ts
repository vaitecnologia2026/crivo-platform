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
import { IsString, MaxLength, MinLength } from 'class-validator';
import { GroupsService } from './groups.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import type { PlatformAdmin } from '@crivo/types';

class UpsertGroupDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;
}

/** Control plane — Grupos Empresariais (F1 · Caderno Tela 06). Só super admins. */
@Controller('admin/groups')
@UseGuards(SuperAdminGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  /** Lista os grupos com os CNPJs vinculados. */
  @Get()
  list() {
    return this.groups.list();
  }

  /** F2 — Visão consolidada do grupo (agregados por CNPJ; acesso auditado). */
  @Get(':id/overview')
  overview(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.overview(id, { id: admin.id, email: admin.email });
  }

  /** Cria um grupo empresarial. */
  @Post()
  create(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: UpsertGroupDto) {
    return this.groups.create(dto.name, { id: admin.id, email: admin.email });
  }

  /** Renomeia um grupo. */
  @Patch(':id')
  rename(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertGroupDto,
  ) {
    return this.groups.rename(id, dto.name, { id: admin.id, email: admin.email });
  }

  /** Remove um grupo (apenas vazio). */
  @Delete(':id')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.remove(id, { id: admin.id, email: admin.email });
  }
}
