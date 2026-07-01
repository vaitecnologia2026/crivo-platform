import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { CurrentUser } from '../iam/current-user.decorator';
import { PushTokensService } from './push-tokens.service';
import { RegisterPushTokenDto } from './dto';

/** Registro de tokens push do dispositivo do usuário logado (app mobile). */
@Controller('me/push-tokens')
@UseGuards(AuthGuard)
export class PushTokensController {
  constructor(private readonly tokens: PushTokensService) {}

  /** Registra/renova o token FCM deste dispositivo. */
  @Post()
  register(@CurrentUser() user: SessionUser, @Body() dto: RegisterPushTokenDto) {
    return this.tokens.register(
      { id: user.id, tenantId: user.tenantId, role: user.role },
      { token: dto.token, platform: dto.platform },
    );
  }

  /** Remove o token deste dispositivo (logout / desinstalação). */
  @Delete(':token')
  remove(@CurrentUser() user: SessionUser, @Param('token') token: string) {
    return this.tokens.remove({ id: user.id }, token);
  }
}
