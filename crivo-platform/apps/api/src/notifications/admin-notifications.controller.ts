import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { CurrentAdmin } from '../admin/platform-admin.decorator';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingDto } from './dto';

/**
 * Configuração de Notificações (Super Admin). Lista os gatilhos reais do sistema
 * e liga/desliga cada canal (e-mail / push). Exclusivo de super admins.
 */
@Controller('admin/notification-settings')
@UseGuards(SuperAdminGuard)
export class AdminNotificationsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  /** Lista os 4 gatilhos com o estado atual de cada canal. */
  @Get()
  list() {
    return this.settings.list();
  }

  /** Liga/desliga os canais de um gatilho. */
  @Put(':key')
  update(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('key') key: string,
    @Body() dto: UpdateNotificationSettingDto,
  ) {
    return this.settings.update(key, dto, { id: admin.id, email: admin.email });
  }
}
