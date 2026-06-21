import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { ChangeAdminPasswordDto, MfaCodeDto, PlatformLoginDto } from './dto';
import type { PlatformAdmin } from '@crivo/types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  // Anti-brute-force: máx. 5 tentativas/min por IP (login de plataforma).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() body: PlatformLoginDto) {
    return this.auth.login(body.email, body.password, body.totp);
  }

  @Get('me')
  @UseGuards(SuperAdminGuard)
  me(@CurrentAdmin() admin: PlatformAdmin) {
    return admin;
  }

  /** Troca a senha do super admin logado (exige a senha atual). */
  @Patch('password')
  @UseGuards(SuperAdminGuard)
  changePassword(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: ChangeAdminPasswordDto) {
    return this.auth.changePassword(admin.id, dto.currentPassword, dto.newPassword);
  }

  /** Logout: revoga todas as sessões do super admin (incrementa a versão de token). */
  @Post('logout')
  @UseGuards(SuperAdminGuard)
  logout(@CurrentAdmin() admin: PlatformAdmin) {
    return this.auth.logout(admin.id);
  }

  // ── MFA / TOTP (F2) ──

  /** Inicia o setup do MFA: devolve o segredo + otpauth URI (QR no autenticador). */
  @Post('mfa/setup')
  @UseGuards(SuperAdminGuard)
  setupMfa(@CurrentAdmin() admin: PlatformAdmin) {
    return this.auth.setupMfa(admin.id);
  }

  /** Confirma e ativa o MFA (valida um código do segredo pendente). */
  @Post('mfa/enable')
  @UseGuards(SuperAdminGuard)
  enableMfa(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: MfaCodeDto) {
    return this.auth.enableMfa(admin.id, dto.code);
  }

  /** Desativa o MFA (exige um código válido). */
  @Post('mfa/disable')
  @UseGuards(SuperAdminGuard)
  disableMfa(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: MfaCodeDto) {
    return this.auth.disableMfa(admin.id, dto.code);
  }
}
