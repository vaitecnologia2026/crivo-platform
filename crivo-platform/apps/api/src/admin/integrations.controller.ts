import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { IntegrationsService, type IntegrationProvider } from './integrations.service';
import { ChargeDto, SaveIntegrationDto, SignContractDto, UploadTemplateDto } from './integrations.dto';

/** Integrações (Clicksign/Asaas/Mercado Pago) + modelos de contrato. Super admin. */
@Controller('admin')
@UseGuards(SuperAdminGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get('integrations')
  status() {
    return this.svc.status();
  }

  @Put('integrations/:provider')
  save(@Param('provider') provider: string, @Body() dto: SaveIntegrationDto) {
    return this.svc.saveConfig(provider as IntegrationProvider, dto);
  }

  @Get('contract-templates')
  templates() {
    return this.svc.listTemplates();
  }

  @Post('contract-templates')
  upload(@Body() dto: UploadTemplateDto) {
    return this.svc.uploadTemplate(dto);
  }

  @Delete('contract-templates/:id')
  remove(@Param('id') id: string) {
    return this.svc.deleteTemplate(id);
  }

  @Post('integrations/sign')
  sign(@Body() dto: SignContractDto) {
    return this.svc.sendForSignature(dto);
  }

  @Post('integrations/charge')
  charge(@Body() dto: ChargeDto) {
    return this.svc.createCharge(dto.provider, dto);
  }
}
