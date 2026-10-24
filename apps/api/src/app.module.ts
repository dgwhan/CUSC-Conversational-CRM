import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './platform/health/health.module.js';
import { AppConfigModule } from './platform/config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PasswordRecoveryModule } from './modules/password-recovery/password-recovery.module.js';

@Module({
  imports: [AppConfigModule, HealthModule, AuthModule, PasswordRecoveryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
