import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './platform/health/health.module.js';
import { AppConfigModule } from './platform/config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { PasswordRecoveryModule } from './modules/password-recovery/password-recovery.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { ChannelConnectionModule } from './modules/channel-connection/channel-connection.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { WorkspaceConfigModule } from './modules/workspace-config/workspace-config.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    AuditModule,
    AuthModule,
    PasswordRecoveryModule,
    MessagingModule,
    ChannelConnectionModule,
    RealtimeModule,
    WorkspaceConfigModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
