import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { FcmService } from './fcm.service';
import { PushTokensService } from './push-tokens.service';
import { NotificationSettingsService } from './notification-settings.service';
import { SendTestPushDto } from './dto';

/**
 * Diagnóstico de push (Super Admin). Duas rotas para validar a integração FCM
 * ponta-a-ponta SEM inventar nada novo: reaproveita FcmService, PushTokensService
 * e NotificationSettingsService. Exclusivo de super admins (mesmo guard de /admin).
 */
@Controller('admin/test')
@UseGuards(SuperAdminGuard)
export class AdminTestNotificationsController {
  constructor(
    private readonly fcm: FcmService,
    private readonly pushTokens: PushTokensService,
    private readonly settings: NotificationSettingsService,
  ) {}

  /**
   * Radiografia da configuração de push. NÃO dispara nada. Retorna: se as
   * credenciais Firebase Admin/FCM estão configuradas (só booleans/nomes, sem
   * segredos), contagem de tokens registrados por plataforma e o estado do gate
   * push de cada gatilho.
   */
  @Get('push-diag')
  async pushDiag() {
    const [fcm, tokens, triggers] = await Promise.all([
      Promise.resolve(this.fcm.diagnostics()),
      this.pushTokens.stats(),
      this.settings.list(),
    ]);

    return {
      fcm,
      tokens,
      triggers: triggers.map((t) => ({
        key: t.key,
        label: t.label,
        emailEnabled: t.emailEnabled,
        pushEnabled: t.pushEnabled,
      })),
    };
  }

  /**
   * Dispara um push de TESTE. Como o principal autenticado é um super admin (sem
   * dispositivo próprio), o alvo vem no body: `token` (FCM direto) OU `userId`
   * (resolve os tokens do usuário). Retorna o resultado do envio.
   */
  @Post('push')
  async push(@Body() dto: SendTestPushDto) {
    if (!this.fcm.enabled) {
      throw new BadRequestException(
        'FCM desabilitado: configure FCM_SERVICE_ACCOUNT (ou FCM_SERVICE_ACCOUNT_PATH) antes de testar.',
      );
    }

    let tokens: string[];
    if (dto.token?.trim()) {
      tokens = [dto.token.trim()];
    } else if (dto.userId) {
      tokens = await this.pushTokens.tokensForUsers([dto.userId]);
    } else {
      throw new BadRequestException('Informe um "token" FCM ou um "userId" para o teste.');
    }

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: [], note: 'Nenhum token encontrado para o alvo.' };
    }

    const res = await this.fcm.sendToTokens(tokens, {
      title: dto.title ?? 'CRIVO — push de teste',
      body: dto.body ?? 'Se você recebeu isto, o push está funcionando ponta-a-ponta.',
      data: { type: 'test' },
    });

    // Higieniza tokens inválidos (mesma política dos disparos reais).
    if (res.invalidTokens.length) await this.pushTokens.pruneInvalid(res.invalidTokens);

    return { targeted: tokens.length, ...res };
  }
}
