import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IamModule } from '../iam/iam.module';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { FcmService } from './fcm.service';
import { PushTokensService } from './push-tokens.service';
import { NotificationSettingsService } from './notification-settings.service';
import { PushTokensController } from './push-tokens.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminTestNotificationsController } from './admin-test-notifications.controller';
import { SiteNotificationsController } from './site-notifications.controller';

/**
 * Subsistema de notificações push (FCM) + gates por gatilho.
 *
 * @Global para que os services de disparo (IcdService, PreliminaryReportsService)
 * injetem NotificationSettingsService/FcmService/PushTokensService SEM que seus
 * módulos precisem importar este — evitando dependência circular.
 *
 * SuperAdminGuard é provido localmente (usa JwtService global + PrismaService) —
 * não depende do AdminModule, mantendo o grafo acíclico.
 */
@Global()
@Module({
  imports: [PrismaModule, IamModule],
  controllers: [
    PushTokensController,
    AdminNotificationsController,
    AdminTestNotificationsController,
    SiteNotificationsController,
  ],
  providers: [FcmService, PushTokensService, NotificationSettingsService, SuperAdminGuard],
  exports: [FcmService, PushTokensService, NotificationSettingsService],
})
export class NotificationsModule {}
