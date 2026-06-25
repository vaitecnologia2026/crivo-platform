import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { BenchmarksService } from './benchmarks.service';

/** Base CRIVO / Benchmarks (Fase 5 — §11). Agregado anonimizado. Super admin. */
@Controller('admin/benchmarks')
@UseGuards(SuperAdminGuard)
export class BenchmarksController {
  constructor(private readonly svc: BenchmarksService) {}

  @Get()
  get(@CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.compute({ id: admin.id, email: admin.email });
  }
}
