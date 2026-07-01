import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationSettingData,
  UpdateNotificationSettingRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { PushTokensService } from './push-tokens.service';
import { NOTIFICATION_TRIGGERS, findTrigger } from './triggers';

type Actor = { id?: string; email?: string };

/**
 * Config dos gatilhos de notificação. O registry (triggers.ts) é a fonte da
 * verdade dos gatilhos; o banco guarda só o override de ativação por canal.
 * Ausência de linha = ambos os canais ATIVOS (padrão pedido pelo produto).
 *
 * `isEnabled` é consultado no MOMENTO DO DISPARO (icd/preliminary/site) para
 * respeitar de verdade o que o admin ligou/desligou.
 */
@Injectable()
export class NotificationSettingsService {
  private readonly log = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly pushTokens: PushTokensService,
  ) {}

  /** Lista os 4 gatilhos (registry) mesclados com os overrides do banco. */
  async list(): Promise<NotificationSettingData[]> {
    const rows = await this.prisma.admin.notificationSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return NOTIFICATION_TRIGGERS.map((t) => {
      const row = byKey.get(t.key);
      return {
        key: t.key,
        label: t.label,
        description: t.description,
        event: t.event,
        channels: t.channels,
        emailEnabled: row?.emailEnabled ?? true,
        pushEnabled: row?.pushEnabled ?? true,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    });
  }

  /** Um canal está ativo para um gatilho? Default true (sem linha = ativo). */
  async isEnabled(key: string, channel: NotificationChannel): Promise<boolean> {
    const row = await this.prisma.admin.notificationSetting.findUnique({ where: { key } });
    if (!row) return true;
    return channel === 'email' ? row.emailEnabled : row.pushEnabled;
  }

  /** Atualiza o override de um gatilho. Só aceita chaves do registry. */
  async update(
    key: string,
    dto: UpdateNotificationSettingRequest,
    actor: Actor,
  ): Promise<NotificationSettingData> {
    const trigger = findTrigger(key);
    if (!trigger) throw new NotFoundException('Gatilho de notificação desconhecido.');

    const data = {
      ...(dto.emailEnabled !== undefined ? { emailEnabled: dto.emailEnabled } : {}),
      ...(dto.pushEnabled !== undefined ? { pushEnabled: dto.pushEnabled } : {}),
      updatedBy: actor.email ?? null,
    };

    await this.prisma.admin.notificationSetting.upsert({
      where: { key },
      create: {
        key,
        emailEnabled: dto.emailEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
        updatedBy: actor.email ?? null,
      },
      update: data,
    });

    // Auditoria (best-effort) — mesma trilha do control plane.
    try {
      await this.prisma.admin.auditLog.create({
        data: {
          action: 'notification.config.update',
          actorId: actor.id,
          actorEmail: actor.email,
          target: key,
          meta: dto as object,
        },
      });
    } catch (e) {
      this.log.warn(`Falha ao auditar notification.config.update: ${String(e)}`);
    }

    return (await this.list()).find((s) => s.key === key)!;
  }

  /**
   * Dispara o push de um gatilho SE `pushEnabled`. Resolve a audiência a partir
   * do registry: 'users' → tokens dos userIds informados; 'topic' → tópico FCM.
   * Best-effort: nunca lança (uma falha de push não derruba a operação de
   * negócio que a chamou).
   */
  async dispatchPush(
    key: string,
    payload: { title: string; body: string; userIds?: string[]; data?: Record<string, string> },
  ): Promise<{ pushed: boolean }> {
    try {
      const trigger = findTrigger(key);
      if (!trigger) return { pushed: false };
      if (!(await this.isEnabled(key, 'push'))) return { pushed: false };

      const msg = { title: payload.title, body: payload.body, data: { key, ...(payload.data ?? {}) } };

      if (trigger.pushAudience.kind === 'topic') {
        await this.fcm.sendToTopic(trigger.pushAudience.topic, msg);
        return { pushed: true };
      }

      // Audiência 'users': tokens dos destinatários informados.
      const tokens = await this.pushTokens.tokensForUsers(payload.userIds ?? []);
      if (tokens.length === 0) return { pushed: false };
      const res = await this.fcm.sendToTokens(tokens, msg);
      if (res.invalidTokens.length) await this.pushTokens.pruneInvalid(res.invalidTokens);
      return { pushed: res.sent > 0 };
    } catch (e) {
      this.log.warn(`Falha ao disparar push (${key}): ${String(e)}`);
      return { pushed: false };
    }
  }
}
