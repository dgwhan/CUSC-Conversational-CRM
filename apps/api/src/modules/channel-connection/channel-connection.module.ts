import { Module, forwardRef } from '@nestjs/common';
import { AppConfigModule } from '../../platform/config/config.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenEncryptionService } from './infrastructure/token-encryption.service.js';
import { OAuthService } from './application/oauth.service.js';
import { ChannelManagerService } from './application/channel-manager.service.js';
import { MessageDispatcherService } from './application/message-dispatcher.service.js';
import { ChannelSyncService } from './application/channel-sync.service.js';
import { ZcaPersonalService } from './application/zca-personal.service.js';
import { ZaloTokenMonitorService } from './application/zalo-token-monitor.service.js';
import { ChannelConnectorController } from './presentation/channel-connector.controller.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    forwardRef(() => MessagingModule),
    RealtimeModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [ChannelConnectorController],
  providers: [
    TokenEncryptionService,
    OAuthService,
    ChannelManagerService,
    MessageDispatcherService,
    ChannelSyncService,
    ZcaPersonalService,
    ZaloTokenMonitorService,
  ],
  exports: [
    TokenEncryptionService,
    OAuthService,
    ChannelManagerService,
    MessageDispatcherService,
    ChannelSyncService,
    ZcaPersonalService,
    ZaloTokenMonitorService,
  ],
})
export class ChannelConnectionModule {}
