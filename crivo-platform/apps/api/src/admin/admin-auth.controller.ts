import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { PlatformLoginDto } from './dto';
import type { PlatformAdmin } from '@crivo/types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  // Anti-brute-force: máx. 5 tentativas/min por IP (login de plataforma).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() body: PlatformLoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(SuperAdminGuard)
  me(@CurrentAdmin() admin: PlatformAdmin) {
    return admin;
  }
}
