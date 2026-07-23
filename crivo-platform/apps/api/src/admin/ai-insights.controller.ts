import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AiInsightsService } from './ai-insights.service';

/** IA da Plataforma — consumo, logs e contextos por cliente. Super admin. */
@Controller('admin/ai')
@UseGuards(SuperAdminGuard)
export class AiInsightsController {
  constructor(private readonly svc: AiInsightsService) {}

  @Get('usage')
  usage(@Query('days') days?: string) {
    const n = days ? Number(days) : 30;
    return this.svc.usage(Number.isFinite(n) && n > 0 && n <= 365 ? n : 30);
  }

  @Get('logs')
  logs(
    @Query('limit') limit?: string,
    @Query('useCase') useCase?: string,
    @Query('onlyErrors') onlyErrors?: string,
  ) {
    return this.svc.logs({
      limit: limit ? Number(limit) : undefined,
      useCase: useCase || undefined,
      onlyErrors: onlyErrors === '1' || onlyErrors === 'true',
    });
  }

  @Get('contexts')
  contexts() {
    return this.svc.contexts();
  }
}
