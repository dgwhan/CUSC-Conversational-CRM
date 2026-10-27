import { Module } from '@nestjs/common';
import { WorkspaceConfigService } from './workspace-config.service.js';
import { WorkspaceConfigController } from './workspace-config.controller.js';
import { WorkspacesController } from './workspaces.controller.js';
import { StaffManagementService } from './staff-management.service.js';
import { StaffManagementController } from './staff-management.controller.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController, WorkspaceConfigController, StaffManagementController],
  providers: [WorkspaceConfigService, StaffManagementService],
  exports: [WorkspaceConfigService, StaffManagementService],
})
export class WorkspaceConfigModule {}
