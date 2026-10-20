import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './platform/health/health.module.js';
import { AppConfigModule } from './platform/config/config.module.js';

@Module({
  imports: [AppConfigModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
