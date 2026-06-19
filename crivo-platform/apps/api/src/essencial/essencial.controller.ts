import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { RequireModule } from '../iam/require-module.decorator';
import { RequireScreen } from '../iam/require-screen.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import { EssencialService } from './essencial.service';
import { CreateEssentialRecordDto, SubmitSelfAssessmentDto } from './dto';

/** Diagnóstico Essencial do tenant (Briefing §5). Gate pelo módulo "campanhas". */
@Controller('essencial')
@UseGuards(AuthGuard, ModuleGuard, ScreenAccessGuard)
@RequireModule('campanhas')
@RequireScreen('essencial')
export class EssencialController {
  constructor(private readonly svc: EssencialService) {}

  @Get('self-assessment')
  latest(@CurrentUser() user: SessionUser) {
    return this.svc.latestSelfAssessment(user.tenantId);
  }

  @Post('self-assessment')
  submit(@CurrentUser() user: SessionUser, @Body() dto: SubmitSelfAssessmentDto) {
    return this.svc.submitSelfAssessment(user.tenantId, dto);
  }

  @Get('records')
  records(@CurrentUser() user: SessionUser) {
    return this.svc.listRecords(user.tenantId);
  }

  @Post('records')
  createRecord(@CurrentUser() user: SessionUser, @Body() dto: CreateEssentialRecordDto) {
    return this.svc.createRecord(user.tenantId, dto);
  }
}
