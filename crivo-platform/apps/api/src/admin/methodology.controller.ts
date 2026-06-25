import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { MethodologyService } from './methodology.service';
import { UpdateMethodologyDto } from './methodology.dto';

/** Metodologia configurável (Fase 1) — versões/dimensões/perguntas/faixas. Super admin. */
@Controller('admin/methodology')
@UseGuards(SuperAdminGuard)
export class MethodologyController {
  constructor(private readonly svc: MethodologyService) {}

  @Get('instrument/:instrument/active')
  active(@Param('instrument') instrument: string) {
    return this.svc.getActive(instrument);
  }

  @Get('instrument/:instrument/versions')
  versions(@Param('instrument') instrument: string) {
    return this.svc.listVersions(instrument);
  }

  @Post('instrument/:instrument/draft')
  draft(@CurrentAdmin() admin: PlatformAdmin, @Param('instrument') instrument: string) {
    return this.svc.createDraft(instrument, { id: admin.id, email: admin.email });
  }

  @Get('version/:id')
  version(@Param('id') id: string) {
    return this.svc.getVersion(id);
  }

  @Put('version/:id')
  update(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateMethodologyDto,
  ) {
    return this.svc.updateDraft(id, dto, { id: admin.id, email: admin.email });
  }

  @Post('version/:id/publish')
  publish(@CurrentAdmin() admin: PlatformAdmin, @Param('id') id: string) {
    return this.svc.publish(id, { id: admin.id, email: admin.email });
  }

  @Delete('version/:id')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('id') id: string) {
    return this.svc.deleteDraft(id, { id: admin.id, email: admin.email });
  }
}
