import { Module, forwardRef } from '@nestjs/common';
import { AppConfigModule } from '../../platform/config/config.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { TokenEncryptionService } from './infrastructure/token-encryption.service.js';
import { OAuthService } from './application/oauth.service.js';
import { ChannelManagerService } from './application/channel-manager.service.js';
import { ChannelConnectorController } from './presentation/channel-connector.controller.js';

@Module({
  imports: [AppConfigModule, PrismaModule, forwardRef(() => MessagingModule), RealtimeModule],
  controllers: [ChannelConnectorController],
  providers: [TokenEncryptionService, OAuthService, ChannelManagerService],
  exports: [TokenEncryptionService, OAuthService, ChannelManagerService],
})
export class ChannelConnectionModule {}
