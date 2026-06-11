import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { CreateLibraryItemDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RequirePermission } from '../iam/require-permission.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

/** Biblioteca & Formação: leitura por library:view, gestão por library:manage. */
@Controller('library')
@UseGuards(AuthGuard, PermissionGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @RequirePermission('library:view')
  list(@CurrentUser() user: SessionUser) {
    return this.library.list(user.tenantId);
  }

  @Post()
  @RequirePermission('library:manage')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateLibraryItemDto) {
    return this.library.create(user.tenantId, dto);
  }

  @Delete(':id')
  @RequirePermission('library:manage')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.remove(user.tenantId, id);
  }
}
