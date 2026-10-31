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
import { StaffManagementService } from '../../application/staff-management.service.js';
import type {
  CreateStaffRequestDto,
  UpdateStaffRequestDto,
  ToggleStaffLockRequestDto,
  StaffItemResponseDto,
} from '../dto/index.js';
import { Roles } from '../../../../common/decorators/roles.decorator.js';
import { WorkspaceRolesGuard } from '../../../../common/guards/workspace-roles.guard.js';

@Controller('workspaces/current/staff')
@UseGuards(WorkspaceRolesGuard)
export class StaffManagementController {
  constructor(private readonly staffService: StaffManagementService) {}

  /**
   * Lấy danh sách nhân viên thuộc Workspace / Owner quản lý
   */
  @Get()
  @Roles('OWNER', 'STAFF')
  async getStaffList(
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<StaffItemResponseDto[]> {
    return this.staffService.getStaffList(ownerId || staffId || '', workspaceId);
  }

  /**
   * Tạo nhân viên mới dưới quyền Owner (hoặc mời nhân viên đã có tài khoản vào Workspace)
   */
  @Post()
  @Roles('OWNER')
  async createStaff(
    @Body() dto: CreateStaffRequestDto,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<StaffItemResponseDto> {
    return this.staffService.createStaff(ownerId || staffId || '', dto, workspaceId);
  }

  /**
   * Cập nhật thông tin nhân viên
   */
  @Put(':id')
  @Roles('OWNER')
  async updateStaff(
    @Param('id') targetStaffId: string,
    @Body() dto: UpdateStaffRequestDto,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<StaffItemResponseDto> {
    return this.staffService.updateStaff(ownerId || staffId || '', targetStaffId, dto);
  }

  /**
   * Khóa / Mở khóa tài khoản nhân viên
   */
  @Patch(':id/lock')
  @Roles('OWNER')
  async toggleLock(
    @Param('id') targetStaffId: string,
    @Body() body: ToggleStaffLockRequestDto,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<StaffItemResponseDto> {
    return this.staffService.toggleLockStaff(ownerId || staffId || '', targetStaffId, body.lock);
  }

  /**
   * Xóa nhân viên hoặc rời khỏi Không gian làm việc
   */
  @Delete(':id')
  @Roles('OWNER', 'STAFF')
  async deleteStaff(
    @Param('id') targetStaffId: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.staffService.deleteStaff(ownerId || staffId || '', targetStaffId, workspaceId);
  }
}
