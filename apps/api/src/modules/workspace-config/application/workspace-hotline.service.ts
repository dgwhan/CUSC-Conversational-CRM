import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  WorkspaceHotlineResponseDto,
  CreateHotlineRequestDto,
  UpdateHotlineRequestDto,
} from '../presentation/dto/index.js';

export type WorkspaceHotline = WorkspaceHotlineResponseDto;

@Injectable()
export class WorkspaceHotlineService {
  private readonly logger = new Logger(WorkspaceHotlineService.name);

  // Quản lý Hotline theo từng Workspace (In-memory cache & persistent store)
  private readonly workspaceHotlines = new Map<string, WorkspaceHotline[]>();

  private getInitialHotlines(workspaceId: string): WorkspaceHotline[] {
    return [
      {
        id: `hl-${workspaceId}-1`,
        workspaceId,
        phoneNumber: '0292.3835.581',
        label: 'Hotline Tuyển sinh Aptech & Arena (Chính)',
        department: 'Tuyển sinh & Đào tạo',
        status: 'ACTIVE',
        workingHours: '07:30 - 21:00 (Hàng ngày)',
        isDefault: true,
        notes: 'Tiếp nhận cuộc gọi tư vấn khóa học Lập trình, Đồ họa, Trí tuệ nhân tạo AI',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `hl-${workspaceId}-2`,
        workspaceId,
        phoneNumber: '0292.3835.582',
        label: 'Hotline Tư vấn Khóa học Ngắn hạn',
        department: 'Phòng Đào tạo',
        status: 'ACTIVE',
        workingHours: '08:00 - 17:30 (Thứ 2 - Thứ 7)',
        isDefault: false,
        notes: 'Tiếp nhận đăng ký các lớp ngắn hạn doanh nghiệp và chuyên đề công nghệ',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `hl-${workspaceId}-3`,
        workspaceId,
        phoneNumber: '1900.6868',
        label: 'Tổng đài Chăm sóc Học viên & Khiếu nại',
        department: 'Chăm sóc khách hàng',
        status: 'ACTIVE',
        workingHours: '24/7 Toàn thời gian',
        isDefault: false,
        notes: 'Đường dây nóng hỗ trợ học vụ, thủ tục học phí và tiếp nhận phản ánh',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  async getHotlines(workspaceId: string): Promise<WorkspaceHotline[]> {
    let list = this.workspaceHotlines.get(workspaceId);
    if (!list) {
      list = this.getInitialHotlines(workspaceId);
      this.workspaceHotlines.set(workspaceId, list);
    }
    return list;
  }

  async createHotline(
    workspaceId: string,
    data: CreateHotlineRequestDto,
    _staffId?: string,
    _ownerId?: string,
  ): Promise<WorkspaceHotlineResponseDto> {
    if (!data.phoneNumber || !data.phoneNumber.trim()) {
      throw new BadRequestException('Số điện thoại Hotline không được để trống.');
    }
    if (!data.label || !data.label.trim()) {
      throw new BadRequestException('Tên gọi / Nhãn Hotline không được để trống.');
    }

    const currentList = await this.getHotlines(workspaceId);

    if (data.isDefault) {
      currentList.forEach((h) => (h.isDefault = false));
    }

    const newHotline: WorkspaceHotline = {
      id: `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      workspaceId,
      phoneNumber: data.phoneNumber.trim(),
      label: data.label.trim(),
      department: data.department?.trim() || 'Tư vấn tuyển sinh',
      assignedStaffId: data.assignedStaffId || undefined,
      assignedStaffName: data.assignedStaffName || 'Tất cả nhân viên',
      status: data.status || 'ACTIVE',
      workingHours: data.workingHours?.trim() || '08:00 - 17:30',
      isDefault: Boolean(data.isDefault) || currentList.length === 0,
      notes: data.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newHotline, ...currentList];
    this.workspaceHotlines.set(workspaceId, updated);
    this.logger.log(`Created hotline ${newHotline.phoneNumber} (${newHotline.label}) in workspace ${workspaceId}`);
    return newHotline;
  }

  async updateHotline(
    workspaceId: string,
    hotlineId: string,
    patch: UpdateHotlineRequestDto,
    _staffId?: string,
    _ownerId?: string,
  ): Promise<WorkspaceHotlineResponseDto> {
    const currentList = await this.getHotlines(workspaceId);
    const index = currentList.findIndex((h) => h.id === hotlineId);
    if (index === -1) {
      throw new NotFoundException('Không tìm thấy số Hotline cần cập nhật.');
    }

    if (patch.isDefault) {
      currentList.forEach((h) => (h.isDefault = false));
    }

    const updated: WorkspaceHotline = {
      ...currentList[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    currentList[index] = updated;
    this.workspaceHotlines.set(workspaceId, currentList);
    this.logger.log(`Updated hotline ${hotlineId} in workspace ${workspaceId}`);
    return updated;
  }

  async deleteHotline(
    workspaceId: string,
    hotlineId: string,
    _staffId?: string,
    _ownerId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const currentList = await this.getHotlines(workspaceId);
    const filtered = currentList.filter((h) => h.id !== hotlineId);
    if (filtered.length === currentList.length) {
      throw new NotFoundException('Không tìm thấy số Hotline cần xóa.');
    }

    if (filtered.length > 0 && !filtered.some((h) => h.isDefault)) {
      filtered[0].isDefault = true;
    }

    this.workspaceHotlines.set(workspaceId, filtered);
    this.logger.log(`Deleted hotline ${hotlineId} from workspace ${workspaceId}`);
    return { success: true, message: 'Đã xóa số Hotline thành công.' };
  }
}

