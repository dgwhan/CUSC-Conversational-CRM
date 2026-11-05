import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/index.js';
import {
  RateLimiterService,
  RateLimitGuard,
  CsrfGuard,
  SecurityHeadersInterceptor,
  XssSanitizerPipe,
} from './common/security/index.js';
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
import { NotificationModule } from './modules/notification/notification.module.js';
import { NlpModule } from './modules/nlp/nlp.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    NotificationModule,
    NlpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RateLimiterService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityHeadersInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_PIPE,
      useClass: XssSanitizerPipe,
    },
  ],
})
export class AppModule {}
