import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { AiSettingsService } from './ai-settings.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { AiTestDto, UpsertAiSettingsDto } from './commerce.dto';

/** Configuração de IA (token OpenAI, modelo, módulos). Exclusivo de super admins. */
@Controller('admin/ai-settings')
@UseGuards(SuperAdminGuard)
export class AiSettingsController {
  constructor(private readonly ai: AiSettingsService) {}

  /** Config atual (sem o token — só máscara + status). */
  @Get()
  get() {
    return this.ai.get();
  }

  /** Salva token (criptografado), modelo, ativação e módulos habilitados. */
  @Put()
  update(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: UpsertAiSettingsDto) {
    return this.ai.update(dto, { id: admin.id, email: admin.email });
  }

  /** Testa a conexão com a OpenAI (token informado ou armazenado). */
  @Post('test')
  test(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: AiTestDto) {
    return this.ai.test(dto.apiKey, { id: admin.id, email: admin.email });
  }
}
