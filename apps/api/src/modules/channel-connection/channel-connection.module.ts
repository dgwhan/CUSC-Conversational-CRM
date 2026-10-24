import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../platform/config/config.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { TokenEncryptionService } from './infrastructure/token-encryption.service.js';
import { OAuthService } from './application/oauth.service.js';
import { ChannelManagerService } from './application/channel-manager.service.js';
import { ChannelConnectorController } from './presentation/channel-connector.controller.js';

@Module({
  imports: [AppConfigModule, PrismaModule],
  controllers: [ChannelConnectorController],
  providers: [TokenEncryptionService, OAuthService, ChannelManagerService],
  exports: [TokenEncryptionService, OAuthService, ChannelManagerService],
})
export class ChannelConnectionModule {}
