import { Module } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { PublicDiagnosticsController } from './public-diagnostics.controller';
import { AdminDiagnosticsController } from './admin-diagnostics.controller';

/** Aplicação de diagnósticos do catálogo (motor dinâmico — call 14/07). */
@Module({
  controllers: [PublicDiagnosticsController, AdminDiagnosticsController],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
