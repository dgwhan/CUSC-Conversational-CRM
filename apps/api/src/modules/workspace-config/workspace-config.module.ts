import { Module } from '@nestjs/common';
import { WorkspaceConfigService } from './application/workspace-config.service.js';
import { WorkspaceLifecycleService } from './application/workspace-lifecycle.service.js';
import { WorkspaceHotlineService } from './application/workspace-hotline.service.js';
import { StaffManagementService } from './application/staff-management.service.js';
import { WorkspacesController } from './presentation/controllers/workspaces.controller.js';
import { WorkspaceConfigController } from './presentation/controllers/workspace-config.controller.js';
import { StaffManagementController } from './presentation/controllers/staff-management.controller.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController, WorkspaceConfigController, StaffManagementController],
  providers: [
    WorkspaceConfigService,
    WorkspaceLifecycleService,
    WorkspaceHotlineService,
    StaffManagementService,
  ],
  exports: [
    WorkspaceConfigService,
    WorkspaceLifecycleService,
    WorkspaceHotlineService,
    StaffManagementService,
  ],
})
export class WorkspaceConfigModule {}
