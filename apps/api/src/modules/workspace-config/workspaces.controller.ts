import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { WorkspaceConfigService } from './workspace-config.service.js';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard.js';

@Controller('workspaces')
@UseGuards(WorkspaceRolesGuard)
export class WorkspacesController {
  constructor(private readonly configService: WorkspaceConfigService) {}

  /**
   * Lấy danh sách tất cả Workspace mà tài khoản hiện tại sở hữu hoặc là thành viên
   */
  @Get('my-workspaces')
  async getMyWorkspaces(
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-owner-id') ownerId?: string,
  ) {
    return this.configService.getMyWorkspaces(staffId, ownerId);
  }
}
