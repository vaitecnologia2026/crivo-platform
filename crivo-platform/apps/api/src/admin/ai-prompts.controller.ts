import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { AiPromptsService } from './ai-prompts.service';

/**
 * Central de prompts da IA (Caderno §10 · P0-c). Super admin edita/versiona todos
 * os prompts técnicos aqui. Rotas sob /admin/ai/prompts (após o prefixo /api).
 */
@Controller('admin/ai/prompts')
@UseGuards(SuperAdminGuard)
export class AiPromptsController {
  constructor(private readonly svc: AiPromptsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Put(':useCase')
  update(
    @Param('useCase') useCase: string,
    @Body('content') content: string,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.upsert(useCase, content, { id: admin.id, email: admin.email });
  }

  @Delete(':useCase')
  reset(@Param('useCase') useCase: string, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.reset(useCase, { id: admin.id, email: admin.email });
  }
}
