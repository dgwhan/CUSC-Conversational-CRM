import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { WorkspaceConfigModule } from '../workspace-config/workspace-config.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, WorkspaceConfigModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
