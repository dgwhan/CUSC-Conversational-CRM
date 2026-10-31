import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type {
  CreateStaffRequestDto,
  UpdateStaffRequestDto,
  StaffItemResponseDto,
  StaffItemResponse,
  CreateStaffDto,
  UpdateStaffDto,
} from '../presentation/dto/index.js';

export type { CreateStaffDto, UpdateStaffDto, StaffItemResponse } from '../presentation/dto/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (val?: string): val is string => Boolean(val && UUID_REGEX.test(val));

@Injectable()
export class StaffManagementService {
  private readonly logger = new Logger(StaffManagementService.name);

  // In-memory fallback cho môi trường test không có DB
  private inMemoryStaff = new Map<string, StaffItemResponse[]>();

  constructor(@Optional() private readonly prisma?: PrismaService) { }

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
   * Danh sách nhân viên do Owner này quản lý hoặc theo Workspace
   */
  async getStaffList(ownerId: string, workspaceId?: string): Promise<StaffItemResponse[]> {
    const resolvedOwner = await this.resolveOwnerId(ownerId);

    if (this.prisma) {
      try {
        const targetWorkspace = isUuid(workspaceId)
          ? await this.prisma.workspace.findUnique({ where: { id: workspaceId } })
          : await this.prisma.workspace.findFirst({
            where: { ownerId: resolvedOwner },
          });

        // Tự động tìm và liên kết các tài khoản STAFF chưa có ownerId (orphaned) vào Workspace của Owner
        if (targetWorkspace) {
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
              }).catch(() => { });
              await this.prisma.workspaceMember.upsert({
                where: {
                  workspaceId_staffId: {
                    workspaceId: targetWorkspace.id,
                    staffId: s.id,
                  },
                },
                create: {
                  workspaceId: targetWorkspace.id,
                  staffId: s.id,
                  role: 'STAFF',
                },
                update: { isActive: true },
              }).catch(() => { });
            }
          }
        }

        const staffMembers = await this.prisma.staff.findMany({
          where: {
            OR: [
              ...(targetWorkspace
                ? [
                  { id: targetWorkspace.ownerId },
                  {
                    memberships: {
                      some: {
                        workspaceId: targetWorkspace.id,
                        isActive: true,
                      },
                    },
                  },
                ]
                : [
                  { ownerId: resolvedOwner },
                  { id: resolvedOwner },
                ]),
            ],
          },
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            fullName: true,
            role: true,
            status: true,
            ownerId: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
            memberships: targetWorkspace
              ? {
                where: { workspaceId: targetWorkspace.id },
                select: { role: true },
              }
              : false,
          },
          orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        });

        // Map role theo membership nếu có
        const mappedStaff = staffMembers.map((s: any) => {
          let role = s.role;
          if (targetWorkspace && s.id === targetWorkspace.ownerId) {
            role = 'OWNER';
          } else if (s.memberships && s.memberships[0]?.role) {
            role = s.memberships[0].role;
          }
          const { memberships, ...rest } = s;
          return {
            ...rest,
            role,
          };
        });

        return mappedStaff as StaffItemResponse[];
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
        let ownerWorkspace = isUuid(workspaceId)
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
        if (dto.phoneNumber?.trim()) {
          updateData.phoneNumber = dto.phoneNumber.trim();
        }

        const updated = await this.prisma.staff.update({
          where: { id: existing.id },
          data: updateData,
          select: {
            id: true,
            email: true,
            phoneNumber: true,
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
        if (dto.phoneNumber !== undefined) {
          dataToUpdate.phoneNumber = dto.phoneNumber?.trim() || null;
        }
        if (dto.password) {
          dataToUpdate.passwordHash = await argon2.hash(dto.password);
        }

        const updated = await this.prisma.staff.update({
          where: { id: staffId },
          data: dataToUpdate,
          select: {
            id: true,
            email: true,
            phoneNumber: true,
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
          }).catch(() => { });
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
   * Xóa thành viên hoặc Rời khỏi Không gian làm việc
   * Quy tắc nghiệp vụ:
   * - 1 Workspace phải có ít nhất 1 Chủ sở hữu (Owner).
   * - Nếu Workspace có từ 2 Chủ sở hữu trở lên (>= 2 Owners), cho phép Chủ sở hữu rời hoặc bị xóa khỏi Workspace.
   */
  async deleteStaff(
    ownerId: string,
    targetStaffId: string,
    workspaceId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const resolvedCaller = await this.resolveOwnerId(ownerId);

    if (this.prisma) {
      try {
        const targetStaff = await this.prisma.staff.findUnique({
          where: { id: targetStaffId },
          include: { memberships: true },
        });
        if (!targetStaff) throw new NotFoundException('Không tìm thấy thành viên.');

        // Xác định Không gian làm việc
        const targetWs = workspaceId
          ? await this.prisma.workspace.findUnique({ where: { id: workspaceId } })
          : await this.prisma.workspace.findFirst({ where: { ownerId: resolvedCaller } });

        if (!targetWs) {
          throw new NotFoundException('Không tìm thấy không gian làm việc.');
        }

        // Lấy tất cả thành viên đang hoạt động trong workspace
        const activeMembers = await this.prisma.workspaceMember.findMany({
          where: { workspaceId: targetWs.id, isActive: true },
        });

        // Tập hợp danh sách các ID chủ sở hữu (Owner) của workspace này
        const ownerStaffIds = new Set<string>();
        if (targetWs.ownerId) {
          ownerStaffIds.add(targetWs.ownerId);
        }
        for (const m of activeMembers) {
          if (m.role === 'OWNER') {
            ownerStaffIds.add(m.staffId);
          }
        }

        const isTargetOwner = ownerStaffIds.has(targetStaffId);
        const isSelfLeaving = targetStaffId === resolvedCaller;

        // Nếu target là Owner:
        if (isTargetOwner) {
          // Bắt buộc 1 workspace ít nhất 1 owner
          if (ownerStaffIds.size <= 1) {
            throw new BadRequestException(
              'Không thể rời hoặc xóa Chủ sở hữu. Không gian làm việc phải có ít nhất 1 Chủ sở hữu (Owner).'
            );
          }

          // Nếu có >= 2 owners và người rời là primary owner (targetWs.ownerId),
          // tự động bàn giao quyền primary owner sang cho một Owner khác còn lại
          if (targetWs.ownerId === targetStaffId) {
            const nextOwnerId = Array.from(ownerStaffIds).find((id) => id !== targetStaffId);
            if (nextOwnerId) {
              await this.prisma.workspace.update({
                where: { id: targetWs.id },
                data: { ownerId: nextOwnerId },
              });
              this.logger.log(`Transferred primary ownership of workspace ${targetWs.id} to ${nextOwnerId}`);
            }
          }
        }

        // Xóa liên kết workspace_members của thành viên khỏi workspace
        await this.prisma.workspaceMember.deleteMany({
          where: {
            workspaceId: targetWs.id,
            staffId: targetStaffId,
          },
        }).catch(() => { });

        await this.prisma.refreshToken.deleteMany({ where: { staffId: targetStaffId } }).catch(() => { });

        // Nếu tài khoản là OWNER, hoặc còn thuộc workspace khác: chỉ ngắt liên kết khỏi workspace này
        const remainingMemberships = await this.prisma.workspaceMember.count({
          where: { staffId: targetStaffId },
        });

        if (isTargetOwner || targetStaff.role === 'OWNER' || remainingMemberships > 0) {
          const actionText = isSelfLeaving ? 'đã rời khỏi' : 'đã loại bỏ khỏi';
          this.logger.log(`Member ${targetStaffId} removed from workspace ${targetWs.id}`);
          return { success: true, message: `Thành viên ${targetStaff.fullName} ${actionText} Không gian làm việc.` };
        }

        // Nếu là staff thông thường và không còn thuộc workspace nào:
        try {
          await this.prisma.staff.delete({ where: { id: targetStaffId } });
        } catch {
          await this.prisma.staff.update({
            where: { id: targetStaffId },
            data: { ownerId: null, status: 'LOCKED' },
          });
        }

        this.logger.log(`Deleted staff ${targetStaffId} from workspace ${targetWs.id}`);
        return { success: true, message: `Đã loại bỏ nhân viên ${targetStaff.fullName} (${targetStaff.email}) khỏi Workspace.` };
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException || err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Could not delete staff in DB: ${(err as Error).message}`);
        throw err;
      }
    }

    const list = this.inMemoryStaff.get(resolvedCaller) || [];
    this.inMemoryStaff.set(resolvedCaller, list.filter((s) => s.id !== targetStaffId));
    return { success: true, message: 'Đã xóa thành viên.' };
  }
}
