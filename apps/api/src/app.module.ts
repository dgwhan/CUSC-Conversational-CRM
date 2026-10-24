import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './platform/health/health.module.js';
import { AppConfigModule } from './platform/config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { ChannelConnectionModule } from './modules/channel-connection/channel-connection.module.js';

@Module({
  imports: [AppConfigModule, HealthModule, AuthModule, MessagingModule, ChannelConnectionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
