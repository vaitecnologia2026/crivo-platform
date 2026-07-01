import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationSettingsService } from './notification-settings.service';
import { findTrigger } from './triggers';

interface SiteEventBody {
  title?: string;
  body?: string;
}

/**
 * Ponte para os gatilhos que disparam no site de marketing (apps/site), que roda
 * como app Next separado. O site chama este endpoint com o segredo compartilhado
 * (SITE_NOTIFY_SECRET); recebe de volta se o e-mail está habilitado (para
 * respeitar o toggle) e este backend dispara o push (tópico da equipe CRIVO).
 */
@Controller('notifications/site-event')
export class SiteNotificationsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Post(':key')
  async event(
    @Param('key') key: string,
    @Headers('x-site-secret') secret: string | undefined,
    @Body() body: SiteEventBody,
  ): Promise<{ emailEnabled: boolean; pushEnabled: boolean; pushed: boolean }> {
    const trigger = findTrigger(key);
    if (!trigger) throw new UnauthorizedException('Gatilho desconhecido.');

    const expected = process.env.SITE_NOTIFY_SECRET;
    // Se o segredo está configurado, exige-o (efeito colateral de push). O
    // segredo protege o disparo; a leitura dos flags não é sensível.
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Segredo do site inválido.');
    }

    const [emailEnabled, pushEnabled] = await Promise.all([
      this.settings.isEnabled(key, 'email'),
      this.settings.isEnabled(key, 'push'),
    ]);

    let pushed = false;
    if (pushEnabled) {
      const r = await this.settings.dispatchPush(key, {
        title: body?.title ?? trigger.label,
        body: body?.body ?? trigger.description,
      });
      pushed = r.pushed;
    }
    return { emailEnabled, pushEnabled, pushed };
  }
}
