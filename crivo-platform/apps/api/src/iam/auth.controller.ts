import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './auth.dto';
import type { LoginRequest, SessionUser } from '@crivo/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
}
