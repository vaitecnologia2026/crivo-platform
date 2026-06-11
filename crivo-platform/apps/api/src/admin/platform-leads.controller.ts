import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { PlatformLeadsService } from './platform-leads.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { SetLeadNotesDto, SetLeadStageDto } from './commerce.dto';

/** CRM do super admin (funil comercial da CRIVO). Exclusivo de super admins. */
@Controller('admin/leads')
@UseGuards(SuperAdminGuard)
export class PlatformLeadsController {
  constructor(private readonly leads: PlatformLeadsService) {}

  @Get()
  list() {
    return this.leads.list();
  }

  /** Move o lead no funil (Kanban). */
  @Patch(':id/stage')
  setStage(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLeadStageDto,
  ) {
    return this.leads.setStage(id, dto.stage, { id: admin.id, email: admin.email });
  }

  @Patch(':id/notes')
  setNotes(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLeadNotesDto,
  ) {
    return this.leads.setNotes(id, dto.notes, { id: admin.id, email: admin.email });
  }
}
