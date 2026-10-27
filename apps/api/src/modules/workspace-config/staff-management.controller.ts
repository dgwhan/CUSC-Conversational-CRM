import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { StaffManagementService } from './staff-management.service.js';
import type { CreateStaffDto, UpdateStaffDto } from './staff-management.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard.js';

@Controller('workspaces/current/staff')
@UseGuards(WorkspaceRolesGuard)
export class StaffManagementController {
  constructor(private readonly staffService: StaffManagementService) {}

  /**
   * Lấy danh sách nhân viên thuộc Owner quản lý
   */
  @Get()
  @Roles('OWNER', 'ADMIN')
  async getStaffList(
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ) {
    return this.staffService.getStaffList(ownerId || staffId || '');
  }

  /**
   * Tạo nhân viên mới dưới quyền Owner (hoặc mời nhân viên đã có tài khoản vào Workspace)
   */
  @Post()
  @Roles('OWNER', 'ADMIN')
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ) {
    return this.staffService.createStaff(ownerId || staffId || '', dto, workspaceId);
  }

  /**
   * Cập nhật thông tin nhân viên
   */
  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async updateStaff(
    @Param('id') targetStaffId: string,
    @Body() dto: UpdateStaffDto,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ) {
    return this.staffService.updateStaff(ownerId || staffId || '', targetStaffId, dto);
  }

  /**
   * Khóa / Mở khóa tài khoản nhân viên
   */
  @Patch(':id/lock')
  @Roles('OWNER', 'ADMIN')
  async toggleLock(
    @Param('id') targetStaffId: string,
    @Body() body: { lock: boolean },
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ) {
    return this.staffService.toggleLockStaff(ownerId || staffId || '', targetStaffId, body.lock);
  }

  /**
   * Xóa nhân viên khỏi hệ thống của Owner
   */
  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async deleteStaff(
    @Param('id') targetStaffId: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ) {
    return this.staffService.deleteStaff(ownerId || staffId || '', targetStaffId);
  }
}
