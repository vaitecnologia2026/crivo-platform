import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ModuleService } from './module.service';
import type { SessionUser } from '@crivo/types';

/** Dados da sessão da própria empresa (data-driven nav — F6). */
@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly modules: ModuleService) {}

  /** Códigos dos módulos ativos da empresa do usuário (alimenta o menu). */
  @Get('modules')
  async myModules(@CurrentUser() user: SessionUser): Promise<string[]> {
    return [...(await this.modules.enabledFor(user.tenantId))];
  }
}
