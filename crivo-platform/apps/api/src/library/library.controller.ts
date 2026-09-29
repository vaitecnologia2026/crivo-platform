import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { CreateLibraryItemDto, UpdateLibraryItemDto } from './dto';
import { AuthGuard } from '../iam/guards/auth.guard';
import { OrganizacaoGuard } from '../iam/guards/organizacao.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequirePermission } from '../iam/require-permission.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

/** Biblioteca & Formação: leitura por library:view, gestão por library:manage.
 *  Gate de módulo "biblioteca" (F4): o menu escondia, a API não barrava.
 *  A LEITURA é a Academia de Minha Jornada e fica aberta ao Líder; a GESTÃO do
 *  acervo é da Área da Organização (OrganizacaoGuard por rota) — nem um papel
 *  customizado com library:manage a abre para o perfil Líder.
 *
 *  Checklist de telas (@RequireScreen): é só da Área da Organização, por isso
 *  vai nas rotas de GESTÃO e não na classe. A Academia de Minha Jornada é
 *  governada pelo contrato (módulo "biblioteca") + library:view — mesmo
 *  tratamento do Pocket. Com a tela na classe, um líder com checklist antiga
 *  sem 'biblioteca' (ou um Líder + Administrador com checklist restrita) levava
 *  403 no GET /library, e o shell mostra a Academia na Jornada sem checklist. */
@Controller('library')
@UseGuards(AuthGuard, ModuleGuard, PermissionGuard, ScreenAccessGuard)
@RequireModule('biblioteca')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @RequirePermission('library:view')
  list(@CurrentUser() user: SessionUser) {
    return this.library.list(user.tenantId);
  }

  @Post()
  @UseGuards(OrganizacaoGuard)
  @RequirePermission('library:manage')
  @RequireScreen('biblioteca')
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateLibraryItemDto) {
    return this.library.create(user.tenantId, dto);
  }

  @Put(':id')
  @UseGuards(OrganizacaoGuard)
  @RequirePermission('library:manage')
  @RequireScreen('biblioteca')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryItemDto,
  ) {
    return this.library.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(OrganizacaoGuard)
  @RequirePermission('library:manage')
  @RequireScreen('biblioteca')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.remove(user.tenantId, id);
  }

  /** #62 — Importa um GlobalAcademyContent (catálogo Super Admin) para a
   *  biblioteca do tenant. Requer library:manage. */
  @Post('import-global/:contentId')
  @UseGuards(OrganizacaoGuard)
  @RequirePermission('library:manage')
  @RequireScreen('biblioteca')
  importFromGlobal(
    @CurrentUser() user: SessionUser,
    @Param('contentId', ParseUUIDPipe) contentId: string,
  ) {
    return this.library.importFromGlobal(user.tenantId, contentId);
  }
}
