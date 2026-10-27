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
        const ownerWorkspace = await this.prisma.workspace.findFirst({
          where: { ownerId: resolvedOwner },
        });

        // Tự động tìm và liên kết các tài khoản STAFF chưa có ownerId (orphaned) vào Workspace của Owner
        if (ownerWorkspace) {
          const orphanStaff = await this.prisma.staff.findMany({
            where: {
              role: 'STAFF',
              ownerId: null,
              id: { not: resolvedOwner },
            },
          });
          if (orphanStaff.length > 0) {
            for (const s of orphanStaff) {
              await this.prisma.staff.update({
                where: { id: s.id },
                data: { ownerId: resolvedOwner },
              }).catch(() => {});
              await this.prisma.workspaceMember.upsert({
                where: {
                  workspaceId_staffId: {
                    workspaceId: ownerWorkspace.id,
                    staffId: s.id,
                  },
                },
                create: {
                  workspaceId: ownerWorkspace.id,
                  staffId: s.id,
                  role: 'STAFF',
                },
                update: { isActive: true },
              }).catch(() => {});
            }
          }
        }

        const staffMembers = await this.prisma.staff.findMany({
          where: {
            OR: [
              { ownerId: resolvedOwner },
              { id: resolvedOwner }, // Bao gồm cả tài khoản Owner để dễ theo dõi
              ...(ownerWorkspace
                ? [
                    {
                      memberships: {
                        some: {
                          workspaceId: ownerWorkspace.id,
                        },
                      },
                    },
                  ]
                : []),
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
   * Tạo hoặc Mời nhân viên mới trực thuộc Owner
   * CHỈ SUCCESS KHI TÀI KHOẢN ĐÃ CÓ SẴN TRONG HỆ THỐNG DB
   */
  async createStaff(ownerId: string, dto: CreateStaffDto, workspaceId?: string): Promise<StaffItemResponse> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (!normalizedEmail || !dto.fullName.trim()) {
      throw new BadRequestException('Email và Họ tên nhân viên không được để trống.');
    }

    if (this.prisma) {
      try {
        let ownerWorkspace = workspaceId
          ? await this.prisma.workspace.findUnique({ where: { id: workspaceId } })
          : await this.prisma.workspace.findFirst({ where: { ownerId: resolvedOwner } });

        if (!ownerWorkspace) {
          const ownerStaff = await this.prisma.staff.findUnique({ where: { id: resolvedOwner } });
          const ownerName = ownerStaff?.fullName || 'PolarisX';
          const cleanSlug = `ws-${resolvedOwner.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString(36)}`;
          ownerWorkspace = await this.prisma.workspace.create({
            data: {
              name: ownerStaff?.fullName ? `Workspace của ${ownerName}` : 'PolarisX',
              slug: cleanSlug,
              ownerId: resolvedOwner,
              isActive: true,
            },
          });
        }

        // Kiểm tra xem email này đã tồn tại trong bảng staff chưa
        const existing = await this.prisma.staff.findUnique({
          where: { email: normalizedEmail },
        });

        // RÀNG BUỘC: Chỉ thành công khi tài khoản đã có trong hệ thống DB
        if (!existing) {
          throw new NotFoundException(
            `Tài khoản với email "${normalizedEmail}" chưa tồn tại trong hệ thống. Vui lòng yêu cầu thành viên đăng ký tài khoản trước khi mời vào Workspace.`
          );
        }

        if (existing.id === resolvedOwner) {
          throw new BadRequestException('Không thể thêm chính tài khoản Chủ doanh nghiệp làm nhân viên.');
        }

        // Kiểm tra xem tài khoản này đã là thành viên trong Workspace chưa
        const existingMember = await this.prisma.workspaceMember.findUnique({
          where: {
            workspaceId_staffId: {
              workspaceId: ownerWorkspace.id,
              staffId: existing.id,
            },
          },
        });

        if (existingMember && existingMember.isActive) {
          throw new BadRequestException(`Tài khoản "${existing.email}" đã là thành viên trong Workspace này.`);
        }

        // Tạo hoặc kích hoạt bản ghi WorkspaceMember
        const targetMemberRole = dto.role === 'OWNER' ? 'OWNER' : 'STAFF';
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_staffId: {
              workspaceId: ownerWorkspace.id,
              staffId: existing.id,
            },
          },
          create: {
            workspaceId: ownerWorkspace.id,
            staffId: existing.id,
            role: targetMemberRole,
            isActive: true,
          },
          update: {
            role: targetMemberRole,
            isActive: true,
          },
        });

        // Cập nhật thông tin staff nếu là STAFF thông thường (KHÔNG ghi đè quyền OWNER của họ ở workspace khác)
        const updateData: any = {
          status: 'ACTIVE',
        };
        if (existing.role !== 'OWNER' && !existing.ownerId) {
          updateData.ownerId = resolvedOwner;
        }

        const updated = await this.prisma.staff.update({
          where: { id: existing.id },
          data: updateData,
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

        this.logger.log(`Linked existing staff "${updated.email}" to workspace ${ownerWorkspace.id} of owner ${resolvedOwner}`);
        return updated as StaffItemResponse;
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
        this.logger.warn(`Could not invite staff in DB: ${(err as Error).message}`);
        throw err;
      }
    }

    // In-memory fallback (cho môi trường test cô lập không có DB)
    const list = this.inMemoryStaff.get(resolvedOwner) || [];
    const mockStaff: StaffItemResponse = {
      id: `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      role: dto.role || 'STAFF',
      status: 'ACTIVE',
      ownerId: resolvedOwner,
      lockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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
        const staff = await this.prisma.staff.findUnique({
          where: { id: staffId },
          include: { memberships: true },
        });
        if (!staff) {
          throw new NotFoundException('Không tìm thấy nhân viên.');
        }

        const ownerWorkspace = await this.prisma.workspace.findFirst({
          where: { ownerId: resolvedOwner },
        });
        const belongsToWorkspace = ownerWorkspace && staff.memberships.some((m) => m.workspaceId === ownerWorkspace.id);
        const isManagedByOwner = staff.ownerId === resolvedOwner || staff.id === resolvedOwner || belongsToWorkspace;

        if (!isManagedByOwner) {
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
        const staff = await this.prisma.staff.findUnique({
          where: { id: staffId },
          include: { memberships: true },
        });
        if (!staff) throw new NotFoundException('Không tìm thấy nhân viên.');

        const ownerWorkspace = await this.prisma.workspace.findFirst({
          where: { ownerId: resolvedOwner },
        });
        const belongsToWorkspace = ownerWorkspace && staff.memberships.some((m) => m.workspaceId === ownerWorkspace.id);
        const isManagedByOwner = staff.ownerId === resolvedOwner || belongsToWorkspace;

        if (!isManagedByOwner) {
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
   * Xóa hoặc Loại nhân viên khỏi hệ thống của Owner
   */
  async deleteStaff(ownerId: string, staffId: string): Promise<{ success: boolean; message: string }> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (staffId === resolvedOwner) {
      throw new BadRequestException('Không thể xóa tài khoản Chủ doanh nghiệp.');
    }

    if (this.prisma) {
      try {
        const staff = await this.prisma.staff.findUnique({
          where: { id: staffId },
          include: { memberships: true },
        });
        if (!staff) throw new NotFoundException('Không tìm thấy nhân viên.');

        const ownerWorkspace = await this.prisma.workspace.findFirst({
          where: { ownerId: resolvedOwner },
        });
        const belongsToWorkspace = ownerWorkspace && staff.memberships.some((m) => m.workspaceId === ownerWorkspace.id);
        const isManagedByOwner = staff.ownerId === resolvedOwner || belongsToWorkspace;

        if (!isManagedByOwner) {
          throw new ForbiddenException('Bạn chỉ có quyền xóa nhân viên thuộc quyền quản lý của mình.');
        }

        // Xóa liên kết workspace_members của nhân viên khỏi workspace của owner
        if (ownerWorkspace) {
          await this.prisma.workspaceMember.deleteMany({
            where: {
              workspaceId: ownerWorkspace.id,
              staffId,
            },
          }).catch(() => {});
        }
        await this.prisma.refreshToken.deleteMany({ where: { staffId } }).catch(() => {});

        // Nếu tài khoản là OWNER ở nơi khác, KHÔNG xóa bảng Staff, chỉ ngắt liên kết
        if (staff.role === 'OWNER') {
          this.logger.log(`Removed staff ${staffId} (Owner of other workspace) from workspace ${ownerWorkspace?.id}`);
          return { success: true, message: `Đã loại nhân viên ${staff.fullName} (${staff.email}) khỏi Workspace.` };
        }

        // Thử xóa hoàn toàn tài khoản staff hoặc ngắt liên kết ownerId
        try {
          await this.prisma.staff.delete({ where: { id: staffId } });
        } catch {
          await this.prisma.staff.update({
            where: { id: staffId },
            data: { ownerId: null, status: 'LOCKED' },
          });
        }

        this.logger.log(`Deleted staff ${staffId} by owner ${resolvedOwner}`);
        return { success: true, message: `Đã loại nhân viên ${staff.fullName} (${staff.email}) khỏi Workspace.` };
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
