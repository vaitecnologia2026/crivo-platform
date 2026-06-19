import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { CreateLibraryItemDto, UpdateLibraryItemDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequirePermission } from '../iam/require-permission.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

/** Biblioteca & Formação: leitura por library:view, gestão por library:manage. */
@Controller('library')
@UseGuards(AuthGuard, PermissionGuard, ScreenAccessGuard)
@RequireScreen('biblioteca')
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

  @Put(':id')
  @RequirePermission('library:manage')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryItemDto,
  ) {
    return this.library.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('library:manage')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.remove(user.tenantId, id);
  }

  /** #62 — Importa um GlobalAcademyContent (catálogo Super Admin) para a
   *  biblioteca do tenant. Requer library:manage. */
  @Post('import-global/:contentId')
  @RequirePermission('library:manage')
  importFromGlobal(
    @CurrentUser() user: SessionUser,
    @Param('contentId', ParseUUIDPipe) contentId: string,
  ) {
    return this.library.importFromGlobal(user.tenantId, contentId);
  }
}
