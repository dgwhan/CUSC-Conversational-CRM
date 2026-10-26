import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

export interface CreateStaffDto {
  email: string;
  fullName: string;
  password?: string;
  role?: 'STAFF' | 'OWNER';
}

export interface UpdateStaffDto {
  fullName?: string;
  email?: string;
  password?: string;
  role?: 'STAFF' | 'OWNER';
}

export interface StaffItemResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED';
  ownerId: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StaffManagementService {
  private readonly logger = new Logger(StaffManagementService.name);

  // In-memory fallback cho môi trường test không có DB
  private inMemoryStaff = new Map<string, StaffItemResponse[]>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Tìm ownerId hợp lệ
   */
  async resolveOwnerId(ownerId?: string, currentStaffId?: string): Promise<string> {
    if (this.prisma) {
      try {
        if (currentStaffId) {
          const staff = await this.prisma.staff.findUnique({ where: { id: currentStaffId } });
          if (staff) {
            return staff.role === 'OWNER' ? staff.id : (staff.ownerId || staff.id);
          }
        }
        if (ownerId) {
          const staff = await this.prisma.staff.findUnique({ where: { id: ownerId } });
          if (staff) {
            return staff.role === 'OWNER' ? staff.id : (staff.ownerId || staff.id);
          }
        }

        const defaultOwner = await this.prisma.staff.findFirst({
          where: { role: 'OWNER' },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultOwner) return defaultOwner.id;
      } catch (err) {
        this.logger.warn(`Could not resolve ownerId in DB: ${(err as Error).message}`);
      }
    }
    return ownerId || currentStaffId || 'owner-default-001';
  }

  /**
   * Danh sách nhân viên do Owner này quản lý
   */
  async getStaffList(ownerId: string): Promise<StaffItemResponse[]> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (this.prisma) {
      try {
        const staffMembers = await this.prisma.staff.findMany({
          where: {
            OR: [
              { ownerId: resolvedOwner },
              { id: resolvedOwner }, // Bao gồm cả tài khoản Owner để dễ theo dõi
            ],
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            ownerId: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        });

        return staffMembers as StaffItemResponse[];
      } catch (err) {
        this.logger.warn(`Could not fetch staff from DB: ${(err as Error).message}`);
      }
    }

    return this.inMemoryStaff.get(resolvedOwner) || [];
  }

  /**
   * Tạo nhân viên mới trực thuộc Owner
   */
  async createStaff(ownerId: string, dto: CreateStaffDto): Promise<StaffItemResponse> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (!normalizedEmail || !dto.fullName.trim()) {
      throw new BadRequestException('Email và Họ tên nhân viên không được để trống.');
    }

    const defaultPassword = dto.password || 'PolarisX123456!';
    const passwordHash = await argon2.hash(defaultPassword);

    if (this.prisma) {
      try {
        // Kiểm tra trùng email
        const existing = await this.prisma.staff.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing) {
          throw new BadRequestException(`Email "${normalizedEmail}" đã được sử dụng trong hệ thống.`);
        }

        const newStaff = await this.prisma.staff.create({
          data: {
            email: normalizedEmail,
            fullName: dto.fullName.trim(),
            passwordHash,
            role: dto.role || 'STAFF',
            status: 'ACTIVE',
            ownerId: resolvedOwner,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            ownerId: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Gán nhân viên vào Workspace của Owner
        const ownerWorkspace = await this.prisma.workspace.findFirst({
          where: { ownerId: resolvedOwner },
        });

        if (ownerWorkspace) {
          await this.prisma.workspaceMember.create({
            data: {
              workspaceId: ownerWorkspace.id,
              staffId: newStaff.id,
              role: 'STAFF',
            },
          }).catch(() => {}); // bỏ qua nếu đã tồn tại
        }

        this.logger.log(`Created new staff "${newStaff.email}" for owner ${resolvedOwner}`);
        return newStaff as StaffItemResponse;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Could not create staff in DB: ${(err as Error).message}`);
      }
    }

    // In-memory fallback
    const mockStaff: StaffItemResponse = {
      id: `staff-${Date.now()}`,
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      role: dto.role || 'STAFF',
      status: 'ACTIVE',
      ownerId: resolvedOwner,
      lockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const list = this.inMemoryStaff.get(resolvedOwner) || [];
    list.push(mockStaff);
    this.inMemoryStaff.set(resolvedOwner, list);
    return mockStaff;
  }

  /**
   * Cập nhật thông tin nhân viên (Họ tên, mật khẩu, quyền)
   */
  async updateStaff(ownerId: string, staffId: string, dto: UpdateStaffDto): Promise<StaffItemResponse> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (this.prisma) {
      try {
        const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
        if (!staff) {
          throw new NotFoundException('Không tìm thấy nhân viên.');
        }

        if (staff.ownerId !== resolvedOwner && staff.id !== resolvedOwner) {
          throw new ForbiddenException('Bạn chỉ có quyền chỉnh sửa nhân viên thuộc quyền quản lý của mình.');
        }

        const dataToUpdate: any = {};
        if (dto.fullName) dataToUpdate.fullName = dto.fullName.trim();
        if (dto.role) dataToUpdate.role = dto.role;
        if (dto.password) {
          dataToUpdate.passwordHash = await argon2.hash(dto.password);
        }

        const updated = await this.prisma.staff.update({
          where: { id: staffId },
          data: dataToUpdate,
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            ownerId: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        this.logger.log(`Updated staff "${updated.email}" by owner ${resolvedOwner}`);
        return updated as StaffItemResponse;
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
        this.logger.warn(`Could not update staff in DB: ${(err as Error).message}`);
      }
    }

    const list = this.inMemoryStaff.get(resolvedOwner) || [];
    const item = list.find((s) => s.id === staffId);
    if (!item) throw new NotFoundException('Không tìm thấy nhân viên.');
    if (dto.fullName) item.fullName = dto.fullName.trim();
    if (dto.role) item.role = dto.role;
    item.updatedAt = new Date();
    return item;
  }

  /**
   * Khóa hoặc Mở khóa tài khoản nhân viên
   */
  async toggleLockStaff(ownerId: string, staffId: string, lock: boolean): Promise<StaffItemResponse> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (staffId === resolvedOwner) {
      throw new BadRequestException('Không thể tự khóa tài khoản Chủ doanh nghiệp (Owner).');
    }

    if (this.prisma) {
      try {
        const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
        if (!staff) throw new NotFoundException('Không tìm thấy nhân viên.');

        if (staff.ownerId !== resolvedOwner) {
          throw new ForbiddenException('Bạn chỉ có quyền khóa tài khoản nhân viên thuộc quyền quản lý của mình.');
        }

        const newStatus = lock ? 'LOCKED' : 'ACTIVE';
        const lockedAt = lock ? new Date() : null;

        const updated = await this.prisma.staff.update({
          where: { id: staffId },
          data: {
            status: newStatus,
            lockedAt,
            lockedUntil: null,
            failedLoginAttempts: 0,
            tokenVersion: { increment: 1 }, // Hủy hiệu lực các JWT token cũ
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            ownerId: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Xóa các Refresh Token đang hoạt động để đăng xuất tài khoản bị khóa ngay lập tức
        if (lock) {
          await this.prisma.refreshToken.deleteMany({
            where: { staffId },
          }).catch(() => {});
        }

        this.logger.log(`Set staff "${updated.email}" status to ${newStatus}`);
        return updated as StaffItemResponse;
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException || err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Could not toggle staff lock in DB: ${(err as Error).message}`);
      }
    }

    const list = this.inMemoryStaff.get(resolvedOwner) || [];
    const item = list.find((s) => s.id === staffId);
    if (!item) throw new NotFoundException('Không tìm thấy nhân viên.');
    item.status = lock ? 'LOCKED' : 'ACTIVE';
    item.lockedAt = lock ? new Date() : null;
    item.updatedAt = new Date();
    return item;
  }

  /**
   * Xóa nhân viên khỏi hệ thống của Owner
   */
  async deleteStaff(ownerId: string, staffId: string): Promise<{ success: boolean; message: string }> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (staffId === resolvedOwner) {
      throw new BadRequestException('Không thể xóa tài khoản Chủ doanh nghiệp.');
    }

    if (this.prisma) {
      try {
        const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
        if (!staff) throw new NotFoundException('Không tìm thấy nhân viên.');

        if (staff.ownerId !== resolvedOwner) {
          throw new ForbiddenException('Bạn chỉ có quyền xóa nhân viên thuộc quyền quản lý của mình.');
        }

        // Xóa liên kết workspace_members và staff
        await this.prisma.workspaceMember.deleteMany({ where: { staffId } });
        await this.prisma.refreshToken.deleteMany({ where: { staffId } });
        await this.prisma.staff.delete({ where: { id: staffId } });

        this.logger.log(`Deleted staff ${staffId} by owner ${resolvedOwner}`);
        return { success: true, message: `Đã xóa nhân viên ${staff.fullName} (${staff.email}).` };
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException || err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Could not delete staff in DB: ${(err as Error).message}`);
      }
    }

    const list = this.inMemoryStaff.get(resolvedOwner) || [];
    this.inMemoryStaff.set(resolvedOwner, list.filter((s) => s.id !== staffId));
    return { success: true, message: 'Đã xóa nhân viên.' };
  }
}
