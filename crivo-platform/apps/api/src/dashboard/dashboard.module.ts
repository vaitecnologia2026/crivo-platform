import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PortalDashboardService } from './portal-dashboard.service';
import { IamModule } from '../iam/iam.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

/** Visão Geral do portal do cliente. */
@Module({
  imports: [IamModule, DiagnosticsModule],
  controllers: [DashboardController],
  providers: [PortalDashboardService],
})
export class DashboardModule {}
