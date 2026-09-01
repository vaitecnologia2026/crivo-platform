import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { PasswordResetService } from './password-reset.service';
import type { LoginRequest, SessionUser } from '@crivo/types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly reset: PasswordResetService,
  ) {}

  // Anti-brute-force: máx. 5 tentativas de login por minuto por IP.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginRequest) {
    return this.auth.login(body.email, body.password, body.tenantSlug);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  /** Usuário troca a própria senha (exige a senha atual). */
  @Patch('password')
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: SessionUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changeOwnPassword(user.tenantId, user.id, dto.currentPassword, dto.newPassword);
  }

  // ── Recuperação de senha (PÚBLICA — a pessoa está trancada para fora) ──
  // Antes daqui, "Esqueci minha senha" abria o WhatsApp do suporte.

  /** Passo 1 — pede o link. Resposta é sempre a mesma (anti-enumeração), então
   *  o limite baixo é o que impede varrer e-mails e inundar caixas alheias. */
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.reset.request(dto.email);
  }

  /** Passo 2 — a tela do link mostra de qual conta/empresa é, antes de digitar. */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('reset-password/:token')
  verifyReset(@Param('token') token: string) {
    return this.reset.verify(token);
  }

  /** Passo 3 — grava a senha nova, consome o link e derruba as sessões abertas. */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.reset.confirm(dto.token, dto.newPassword);
  }

  /** Logout: revoga todas as sessões do usuário (incrementa a versão de token). */
  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: SessionUser) {
    return this.auth.logout(user.tenantId, user.id);
  }
}
