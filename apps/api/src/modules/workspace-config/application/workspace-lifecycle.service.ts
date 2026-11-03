import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import type { BusinessDomain } from '../../../contracts/workspace-config.js';
import { INDUSTRY_PRESETS } from '../domain/workspace-config.presets.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  CreateWorkspaceRequestDto,
  UpdateWorkspaceRequestDto,
  WorkspaceItemResponseDto,
} from '../presentation/dto/index.js';

const isUuid = (val?: string): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class WorkspaceLifecycleService {
  private readonly logger = new Logger(WorkspaceLifecycleService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private getUserDelegate() {
    return (this.prisma as any)?.user || (this.prisma as any)?.staff;
  }

  /**
   * Tìm ownerId hợp lệ từ Staff hoặc Workspace trong DB.
   * Nếu có workspaceId hợp lệ, ưu tiên lấy ownerId của chính Workspace đó.
   */
  async resolveOwnerId(ownerId?: string, workspaceId?: string, currentStaffId?: string): Promise<string | null> {
    if (!this.prisma) return null;

    try {
      const userDelegate = this.getUserDelegate();

      // 1. Kiểm tra theo workspaceId truyền lên (nếu chuyển Workspace thì lấy ownerId của Workspace đó)
      if (workspaceId && isUuid(workspaceId)) {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (ws?.ownerId) return ws.ownerId;
      }

      // 2. Kiểm tra theo currentStaffId (từ JWT / header)
      if (currentStaffId && isUuid(currentStaffId) && userDelegate) {
        const user = await userDelegate.findUnique({ where: { id: currentStaffId } });
        if (user) {
          return user.id;
        }
      }

      // 3. Kiểm tra theo ownerId truyền lên
      if (ownerId && isUuid(ownerId) && userDelegate) {
        const user = await userDelegate.findUnique({ where: { id: ownerId } });
        if (user) {
          return user.id;
        }
      }

      // 4. Fallback tìm Owner mặc định từ Workspace đầu tiên trong DB
      const defaultWs = await this.prisma.workspace.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return defaultWs?.ownerId || null;
    } catch {
      return null;
    }
  }

  /**
   * Lấy danh sách tất cả Workspace mà tài khoản người dùng tham gia (là Owner hoặc Member)
   */
  async getMyWorkspaces(currentStaffId?: string, ownerId?: string): Promise<WorkspaceItemResponseDto[]> {
    const targetStaffId = currentStaffId || ownerId;
    if (!targetStaffId || !this.prisma) {
      return [
        {
          id: 'ws-default-001',
          name: 'PolarisX',
          slug: 'polarisx-default',
          role: 'OWNER',
          isOwner: true,
          domain: 'EDUCATION',
          ownerId: targetStaffId || undefined,
          ownerName: 'Chủ sở hữu',
          createdAt: new Date(),
        },
      ];
    }

    try {
      const userDelegate = this.getUserDelegate();
      const currentUser = userDelegate
        ? await userDelegate.findUnique({
            where: { id: targetStaffId },
          })
        : null;

      if (!currentUser) {
        return [
          {
            id: 'ws-default-001',
            name: 'PolarisX',
            slug: 'polarisx-default',
            role: 'OWNER',
            isOwner: true,
            domain: 'EDUCATION',
            ownerId: targetStaffId,
            ownerName: 'Chủ sở hữu',
            createdAt: new Date(),
          },
        ];
      }

      // 1. Workspaces do người này làm Chủ sở hữu
      const ownedWorkspaces = await this.prisma.workspace.findMany({
        where: { ownerId: targetStaffId, isActive: true },
        include: {
          configuration: true,
          owner: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      // 2. Workspaces người này tham gia với tư cách thành viên
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId: targetStaffId, isActive: true },
        include: {
          workspace: {
            include: {
              configuration: true,
              owner: { select: { fullName: true, email: true } },
            },
          },
        },
      });

      const resultMap = new Map<string, any>();

      // Đưa owned workspaces vào trước
      for (const ws of ownedWorkspaces) {
        resultMap.set(ws.id, {
          id: ws.id,
          name: ws.name || ws.configuration?.workspaceName || 'PolarisX Workspace',
          slug: ws.slug,
          role: 'OWNER',
          isOwner: true,
          domain: ws.configuration?.domain || 'EDUCATION',
          ownerId: ws.ownerId,
          ownerName: ws.owner?.fullName || currentUser?.fullName || 'Chủ sở hữu',
          createdAt: ws.createdAt,
        });
      }

      // Đưa workspaces từ membership vào
      for (const m of memberships) {
        if (!m.workspace || !m.workspace.isActive) continue;
        if (!resultMap.has(m.workspace.id)) {
          const isWsOwner = m.workspace.ownerId === targetStaffId || m.role === 'OWNER';
          resultMap.set(m.workspace.id, {
            id: m.workspace.id,
            name: m.workspace.configuration?.workspaceName || m.workspace.name || 'PolarisX Workspace',
            slug: m.workspace.slug,
            role: isWsOwner ? 'OWNER' : (m.role as 'OWNER' | 'STAFF'),
            isOwner: isWsOwner,
            domain: m.workspace.configuration?.domain || 'EDUCATION',
            ownerId: m.workspace.ownerId,
            ownerName: m.workspace.owner?.fullName || 'Chủ doanh nghiệp',
            createdAt: m.workspace.createdAt,
          });
        }
      }

      const list = Array.from(resultMap.values());
      if (list.length === 0) {
        list.push({
          id: 'ws-default-001',
          name: 'PolarisX',
          slug: 'polarisx-default',
          role: 'OWNER',
          isOwner: true,
          domain: 'EDUCATION',
          ownerId: currentUser.id,
          ownerName: currentUser.fullName,
          createdAt: new Date(),
        });
      }

      return list;
    } catch (err) {
      this.logger.error(`Error in getMyWorkspaces: ${(err as Error).message}`);
      return [
        {
          id: 'ws-default-001',
          name: 'PolarisX',
          slug: 'polarisx-default',
          role: 'OWNER',
          isOwner: true,
          domain: 'EDUCATION',
          ownerId: targetStaffId,
          ownerName: 'Chủ sở hữu',
          createdAt: new Date(),
        },
      ];
    }
  }

  /**
   * Tạo một Workspace mới trong Database kèm cấu hình theo ngành nghề
   */
  async createWorkspace(
    data: CreateWorkspaceRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceItemResponseDto> {
    if (!this.prisma) {
      throw new BadRequestException('Database service is unavailable');
    }

    const resolvedOwner = await this.resolveOwnerId(ownerId, undefined, staffId);
    if (!resolvedOwner) {
      throw new BadRequestException('Không thể xác định chủ sở hữu (Owner) của Workspace');
    }

    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Tên Workspace / Doanh nghiệp không được để trống');
    }

    // Ánh xạ domain chuẩn sang BusinessDomain
    let domainKey: BusinessDomain = 'EDUCATION';
    const rawDomain = (data.domain || '').toString().toUpperCase();
    if (rawDomain.includes('RETAIL') || rawDomain.includes('BÁN LẺ') || rawDomain.includes('THƯƠNG MẠI')) {
      domainKey = 'RETAIL';
    } else if (rawDomain.includes('SAAS') || rawDomain.includes('B2B') || rawDomain.includes('CÔNG NGHỆ') || rawDomain.includes('PHẦN MỀM')) {
      domainKey = 'B2B_SAAS';
    } else if (rawDomain.includes('REAL_ESTATE') || rawDomain.includes('BẤT ĐỘNG SẢN')) {
      domainKey = 'REAL_ESTATE';
    } else if (rawDomain.includes('BEAUTY') || rawDomain.includes('SPA') || rawDomain.includes('LÀM ĐẸP')) {
      domainKey = 'BEAUTY_SPA';
    } else if (rawDomain.includes('EDUCATION') || rawDomain.includes('GIÁO DỤC') || rawDomain.includes('TUYỂN SINH')) {
      domainKey = 'EDUCATION';
    } else if (INDUSTRY_PRESETS[rawDomain as BusinessDomain]) {
      domainKey = rawDomain as BusinessDomain;
    }

    const preset = INDUSTRY_PRESETS[domainKey] || INDUSTRY_PRESETS.EDUCATION;

    // Sinh slug duy nhất
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'ws';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const newWs = await this.prisma.workspace.create({
      data: {
        name,
        slug,
        ownerId: resolvedOwner,
        isActive: true,
      },
    });

    // Tạo cấu hình theo preset
    await this.prisma.workspaceConfiguration.create({
      data: {
        workspaceId: newWs.id,
        ownerId: resolvedOwner,
        domain: domainKey,
        workspaceName: name,
        terminology: preset.terminology as any,
        pipelineStages: preset.pipelineStages as any,
        productCatalog: preset.productCatalog as any,
        criteria: preset.criteria as any,
      },
    });

    // Tự động gán quyền OWNER cho người tạo Không gian làm việc
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: newWs.id,
        userId: resolvedOwner,
        role: 'OWNER',
      },
    }).catch(() => { });

    const userDelegate = this.getUserDelegate();
    const user = userDelegate ? await userDelegate.findUnique({ where: { id: resolvedOwner } }) : null;

    this.logger.log(`Created new workspace ${newWs.id} (${newWs.name}) for owner ${resolvedOwner}`);

    return {
      id: newWs.id,
      name: newWs.name,
      slug: newWs.slug,
      role: 'OWNER',
      isOwner: true,
      domain: domainKey,
      ownerName: user?.fullName || 'Chủ sở hữu',
      createdAt: newWs.createdAt,
    };
  }

  /**
   * Cập nhật thông tin cơ bản của Workspace (Tên, Ngành nghề/Domain)
   */
  async updateWorkspace(
    workspaceId: string,
    data: UpdateWorkspaceRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceItemResponseDto> {
    if (!this.prisma) {
      throw new BadRequestException('Database service is unavailable');
    }

    const resolvedOwner = await this.resolveOwnerId(ownerId, workspaceId, staffId);
    if (!resolvedOwner) {
      throw new BadRequestException('Không thể xác định tài khoản thao tác');
    }

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        configuration: true,
        owner: { select: { fullName: true, email: true } },
      },
    });

    if (!ws) {
      throw new NotFoundException('Không tìm thấy Không gian làm việc');
    }

    if (ws.ownerId !== resolvedOwner) {
      throw new ForbiddenException('Chỉ Chủ sở hữu mới có quyền chỉnh sửa Không gian làm việc này');
    }

    const updateName = data.name?.trim();
    const updateData: { name?: string } = {};
    if (updateName) {
      updateData.name = updateName;
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      include: {
        configuration: true,
        owner: { select: { fullName: true, email: true } },
      },
    });

    if (updated.configuration) {
      const configPatch: { workspaceName?: string; domain?: string } = {};
      if (updateName) {
        configPatch.workspaceName = updateName;
      }
      if (data.domain?.trim()) {
        configPatch.domain = data.domain.trim();
      }
      if (Object.keys(configPatch).length > 0) {
        await this.prisma.workspaceConfiguration.update({
          where: { id: updated.configuration.id },
          data: configPatch,
        });
      }
    }

    this.logger.log(`Updated workspace ${updated.id} (${updated.name})`);

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      role: 'OWNER',
      isOwner: true,
      domain: data.domain?.trim() || updated.configuration?.domain || 'EDUCATION',
      ownerName: updated.owner?.fullName || 'Chủ sở hữu',
      createdAt: updated.createdAt,
    };
  }

  /**
   * Xóa Không gian làm việc (Chỉ Chủ sở hữu, không được xóa nếu là workspace duy nhất)
   */
  async deleteWorkspace(
    workspaceId: string,
    staffId?: string,
    ownerId?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.prisma) {
      throw new BadRequestException('Database service is unavailable');
    }

    const resolvedOwner = await this.resolveOwnerId(ownerId, workspaceId, staffId);
    if (!resolvedOwner) {
      throw new BadRequestException('Không thể xác định tài khoản thao tác');
    }

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) {
      throw new NotFoundException('Không tìm thấy Không gian làm việc');
    }

    if (ws.ownerId !== resolvedOwner) {
      throw new ForbiddenException('Chỉ Chủ sở hữu mới có quyền xóa Không gian làm việc này');
    }

    const count = await this.prisma.workspace.count({
      where: { ownerId: resolvedOwner, isActive: true },
    });

    if (count <= 1) {
      throw new BadRequestException('Không thể xóa Không gian làm việc duy nhất của bạn. Bạn cần có ít nhất 1 không gian làm việc để hoạt động.');
    }

    try {
      await this.prisma.workspace.delete({
        where: { id: workspaceId },
      });
    } catch {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { isActive: false },
      });
    }

    this.logger.log(`Deleted workspace ${workspaceId} by owner ${resolvedOwner}`);

    return {
      success: true,
      message: 'Đã xóa Không gian làm việc thành công',
    };
  }

  /**
   * Tìm workspaceId hợp lệ từ DB cho Owner.
   * Nếu owner đã có workspace trong bảng workspaces, trả về workspace.id.
   * Nếu owner chưa có workspace, tự động tạo mới 1 workspace trong bảng workspaces
   * để workspace_id của workspace_configurations LUÔN LUÔN được nối với workspaces.id, không bao giờ null.
   */
  async resolveWorkspaceForOwner(resolvedOwner: string, workspaceId?: string): Promise<string | null> {
    if (!this.prisma) return (workspaceId && isUuid(workspaceId)) ? workspaceId : null;

    try {
      // 1. Nếu workspaceId truyền lên hợp lệ, kiểm tra xem có thuộc về Owner này không
      if (workspaceId && workspaceId !== 'ws-default-001') {
        const directWs = await this.prisma.workspace.findFirst({
          where: isUuid(workspaceId)
            ? { id: workspaceId, ownerId: resolvedOwner }
            : { OR: [{ id: workspaceId }, { slug: workspaceId }] },
        });
        if (directWs) return directWs.id;
      }

      // 2. Fallback sang workspace đầu tiên của Owner nếu không truyền hoặc không khớp
      const existingOwnerWs = await this.prisma.workspace.findFirst({
        where: { ownerId: resolvedOwner },
        orderBy: { createdAt: 'asc' },
      });
      if (existingOwnerWs) {
        return existingOwnerWs.id;
      }

      // 3. Nếu Owner này chưa có bất kỳ workspace nào trong bảng workspaces, tự động tạo mới
      const userDelegate = this.getUserDelegate();
      const user = userDelegate ? await userDelegate.findUnique({ where: { id: resolvedOwner } }) : null;
      const ownerName = user?.fullName || 'PolarisX';
      const cleanSlug = `ws-${resolvedOwner.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString(36)}`;

      const newWs = await this.prisma.workspace.create({
        data: {
          name: user?.fullName ? `Workspace của ${ownerName}` : 'PolarisX',
          slug: cleanSlug,
          ownerId: resolvedOwner,
          isActive: true,
        },
      });
      this.logger.log(`Created new workspace ${newWs.id} (${newWs.slug}) for owner ${resolvedOwner}`);
      return newWs.id;
    } catch (err) {
      this.logger.error(`Error resolving workspace for owner ${resolvedOwner}: ${(err as Error).message}`);
      return null;
    }
  }
}

