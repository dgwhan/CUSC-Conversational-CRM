import { Module } from '@nestjs/common';
import { WorkspaceConfigService } from './workspace-config.service.js';
import { WorkspaceConfigController } from './workspace-config.controller.js';

@Module({
  controllers: [WorkspaceConfigController],
  providers: [WorkspaceConfigService],
  exports: [WorkspaceConfigService],
})
export class WorkspaceConfigModule {}
