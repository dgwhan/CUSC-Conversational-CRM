import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from '../../../contracts/workspace-config.js';
import { WorkspaceConfigSchema } from '../../../contracts/workspace-config.js';
import { INDUSTRY_PRESETS } from '../domain/workspace-config.presets.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  WorkspaceHotlineResponseDto,
  CreateWorkspaceRequestDto,
  UpdateWorkspaceRequestDto,
  WorkspaceItemResponseDto,
  CreateHotlineRequestDto,
  UpdateHotlineRequestDto,
} from '../presentation/dto/index.js';

export type {
  WorkspaceHotline,
  WorkspaceHotlineResponseDto,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
  CreateHotlineDto,
  UpdateHotlineDto,
} from '../presentation/dto/index.js';

type WorkspaceHotline = WorkspaceHotlineResponseDto;

const isUuid = (val?: string): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class WorkspaceConfigService {
  private readonly logger = new Logger(WorkspaceConfigService.name);

  // In-memory multi-tenant store fallback
  private readonly workspaceConfigs = new Map<string, WorkspaceConfig>();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    // Khởi tạo workspace mặc định cho PolarisX (Education)
    this.initDefaultWorkspace('ws-default-001', 'EDUCATION');
  }

  private initDefaultWorkspace(workspaceId: string, domain: BusinessDomain = 'EDUCATION'): WorkspaceConfig {
    const preset = INDUSTRY_PRESETS[domain];
    const defaultConfig: WorkspaceConfig = {
      workspaceId,
      workspaceName: preset.workspaceName,
      domain: preset.domain,
      terminology: { ...preset.terminology },
      pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
      productCatalog: preset.productCatalog.map((p) => ({ ...p })),
      criteria: preset.criteria.map((c) => ({ ...c })),
    };
    this.workspaceConfigs.set(workspaceId, defaultConfig);
    return defaultConfig;
  }

  /**
   * Tìm ownerId hợp lệ từ Staff hoặc Workspace trong DB.
   * Nếu có workspaceId hợp lệ, ưu tiên lấy ownerId của chính Workspace đó.
   */
  async resolveOwnerId(ownerId?: string, workspaceId?: string, currentStaffId?: string): Promise<string | null> {
    if (!this.prisma) return null;

    try {
      // 1. Kiểm tra theo workspaceId truyền lên (nếu chuyển Workspace thì lấy ownerId của Workspace đó)
      if (workspaceId && isUuid(workspaceId)) {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (ws?.ownerId) return ws.ownerId;
      }

      // 2. Kiểm tra theo currentStaffId (từ JWT / header)
      if (currentStaffId && isUuid(currentStaffId)) {
        const user = await this.prisma.user.findUnique({ where: { id: currentStaffId } });
        if (user) {
          return user.id;
        }
      }

      // 3. Kiểm tra theo ownerId truyền lên
      if (ownerId && isUuid(ownerId)) {
        const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
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
      const currentUser = await this.prisma.user.findUnique({
        where: { id: targetStaffId },
      });

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

    const user = await this.prisma.user.findUnique({ where: { id: resolvedOwner } });

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
    staffId?: string,
    ownerId?: string,
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
    staffId?: string,
    ownerId?: string,
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
    staffId?: string,
    ownerId?: string,
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
      const user = await this.prisma.user.findUnique({ where: { id: resolvedOwner } });
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

  /**
   * Lấy cấu hình của workspace hiện tại theo ownerId lưu trong Database.
   * Nếu staff thuộc ownerId thì tự động lấy workspace của ownerId đó.
   * Đảm bảo workspace_id luôn được nối với workspaces.id trong DB (không để null).
   */
  async getConfig(
    workspaceId = 'ws-default-001',
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    if (this.prisma) {
      try {
        const resolvedOwner = await this.resolveOwnerId(ownerId, workspaceId, currentStaffId);
        if (resolvedOwner) {
          const actualWsId = await this.resolveWorkspaceForOwner(resolvedOwner, workspaceId);

          let dbConfig = actualWsId
            ? await this.prisma.workspaceConfiguration.findFirst({
                where: { workspaceId: actualWsId },
              })
            : await this.prisma.workspaceConfiguration.findFirst({
                where: { ownerId: resolvedOwner, workspaceId: null },
              });

          // Tự động khởi tạo và lưu vào DB nếu Owner này chưa có cấu hình
          if (!dbConfig) {
            const preset = INDUSTRY_PRESETS.EDUCATION;
            dbConfig = await this.prisma.workspaceConfiguration.create({
              data: {
                ownerId: resolvedOwner,
                workspaceId: actualWsId,
                domain: 'EDUCATION',
                workspaceName: preset.workspaceName,
                terminology: preset.terminology as any,
                pipelineStages: preset.pipelineStages as any,
                productCatalog: preset.productCatalog as any,
                criteria: preset.criteria as any,
              },
            });
            this.logger.log(`Initialized default workspace configuration in DB for owner ${resolvedOwner} linked to workspace ${actualWsId}`);
          } else if (!dbConfig.workspaceId && actualWsId) {
            // TỰ ĐỘNG NỐI LẠI VÀO WORKSPACES NẾU TRƯỚC ĐÓ DB ĐANG NULL
            dbConfig = await this.prisma.workspaceConfiguration.update({
              where: { id: dbConfig.id },
              data: { workspaceId: actualWsId },
            });
            this.logger.log(`Linked existing workspace configuration to workspace ${actualWsId} for owner ${resolvedOwner}`);
          }

          if (dbConfig) {
            const finalWsId = dbConfig.workspaceId || actualWsId || workspaceId;
            const config: WorkspaceConfig = {
              workspaceId: finalWsId,
              workspaceName: dbConfig.workspaceName || 'PolarisX',
              domain: (dbConfig.domain as BusinessDomain) || 'EDUCATION',
              terminology: (dbConfig.terminology as any) || INDUSTRY_PRESETS.EDUCATION.terminology,
              pipelineStages: ((dbConfig.pipelineStages as any[]) || []).map((s) => ({ ...s })),
              productCatalog: ((dbConfig.productCatalog as any[]) || []).map((p) => ({ ...p })),
              criteria: ((dbConfig.criteria as any[]) || []).map((c) => ({ ...c })),
            };
            this.workspaceConfigs.set(workspaceId, config);
            if (finalWsId && finalWsId !== workspaceId) {
              this.workspaceConfigs.set(finalWsId, config);
            }
            return config;
          }
        }
      } catch (err) {
        this.logger.warn(`Could not read workspace config from DB: ${(err as Error).message}`);
      }
    }

    let config = this.workspaceConfigs.get(workspaceId);
    if (!config) {
      config = this.initDefaultWorkspace(workspaceId, 'EDUCATION');
    }
    return config;
  }

  /**
   * Cập nhật toàn diện hoặc từng phần cấu hình workspace và LƯU TRỰC TIẾP VÀO DB theo ownerId.
   * Luôn kết nối workspace_id với workspaces.id trong DB (không để null).
   */
  async updateConfig(
    workspaceId = 'ws-default-001',
    patch: Partial<WorkspaceConfig>,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId, ownerId, currentStaffId);

    const merged: WorkspaceConfig = {
      ...current,
      ...patch,
      workspaceId,
      terminology: {
        ...current.terminology,
        ...(patch.terminology || {}),
      },
      pipelineStages: patch.pipelineStages || current.pipelineStages,
      productCatalog: patch.productCatalog || current.productCatalog,
      criteria: patch.criteria || current.criteria,
    };

    // Kiểm tra tính hợp lệ qua Zod
    const validation = WorkspaceConfigSchema.safeParse(merged);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      this.logger.warn(`Invalid workspace configuration update: ${errorMsg}`);
      throw new BadRequestException(`Cấu hình không hợp lệ: ${errorMsg}`);
    }

    // Đảm bảo pipeline có ít nhất 2 stage
    const stages = validation.data.pipelineStages;
    if (stages.length < 2) {
      throw new BadRequestException('Phễu bán hàng / tuyển sinh phải có ít nhất 2 giai đoạn.');
    }

    // LƯU VÀO DATABASE POSTGRESQL THEO OWNERID
    if (this.prisma) {
      try {
        const resolvedOwner = await this.resolveOwnerId(ownerId, workspaceId, currentStaffId);
        if (resolvedOwner) {
          const actualWsId = await this.resolveWorkspaceForOwner(resolvedOwner, workspaceId);

          const existing = actualWsId
            ? await this.prisma.workspaceConfiguration.findFirst({
                where: { workspaceId: actualWsId },
              })
            : await this.prisma.workspaceConfiguration.findFirst({
                where: { ownerId: resolvedOwner, workspaceId: null },
              });

          const wsToLink = actualWsId || existing?.workspaceId || (isUuid(workspaceId) ? workspaceId : null);

          if (existing) {
            await this.prisma.workspaceConfiguration.update({
              where: { id: existing.id },
              data: {
                workspaceId: wsToLink,
                domain: validation.data.domain,
                workspaceName: validation.data.workspaceName,
                terminology: validation.data.terminology as any,
                pipelineStages: validation.data.pipelineStages as any,
                productCatalog: validation.data.productCatalog as any,
                criteria: validation.data.criteria as any,
                updatedAt: new Date(),
              },
            });
            this.logger.log(`[SUCCESS] Updated workspace configuration in DB for owner ${resolvedOwner} linked to workspace ${wsToLink}`);
          } else {
            await this.prisma.workspaceConfiguration.create({
              data: {
                ownerId: resolvedOwner,
                workspaceId: wsToLink,
                domain: validation.data.domain,
                workspaceName: validation.data.workspaceName,
                terminology: validation.data.terminology as any,
                pipelineStages: validation.data.pipelineStages as any,
                productCatalog: validation.data.productCatalog as any,
                criteria: validation.data.criteria as any,
              },
            });
            this.logger.log(`[SUCCESS] Created new workspace configuration in DB for owner ${resolvedOwner} linked to workspace ${wsToLink}`);
          }

          if (wsToLink) {
            validation.data.workspaceId = wsToLink;
          }
        }
      } catch (err) {
        this.logger.error(`Could not persist workspace config to DB: ${(err as Error).message}`, (err as Error).stack);
      }
    }

    this.workspaceConfigs.set(workspaceId, validation.data);
    if (validation.data.workspaceId && validation.data.workspaceId !== workspaceId) {
      this.workspaceConfigs.set(validation.data.workspaceId, validation.data);
    }
    this.logger.log(`Updated workspace config for ${workspaceId} [Domain: ${validation.data.domain}]`);
    return validation.data;
  }

  /**
   * Áp dụng 1 mẫu cấu hình ngành nghề định sẵn (1-click preset)
   */
  async applyPreset(
    workspaceId = 'ws-default-001',
    presetKey: BusinessDomain,
    customWorkspaceName?: string,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const preset = INDUSTRY_PRESETS[presetKey];
    if (!preset) {
      throw new BadRequestException(`Ngành nghề "${presetKey}" không tồn tại.`);
    }

    const newConfig: WorkspaceConfig = {
      workspaceId,
      workspaceName: customWorkspaceName?.trim() || preset.workspaceName,
      domain: preset.domain,
      terminology: { ...preset.terminology },
      pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
      productCatalog: preset.productCatalog.map((p) => ({ ...p })),
      criteria: preset.criteria.map((c) => ({ ...c })),
    };

    return this.updateConfig(workspaceId, newConfig, ownerId, currentStaffId);
  }

  /**
   * Lấy danh sách các mẫu ngành nghề định sẵn để hiển thị cho Admin chọn
   */
  getPresetsList() {
    return Object.entries(INDUSTRY_PRESETS).map(([key, value]) => ({
      key,
      name: value.workspaceName,
      domain: value.domain,
      terminology: value.terminology,
      stagesCount: value.pipelineStages.length,
      sampleStages: value.pipelineStages.map((s) => s.name),
      productsCount: value.productCatalog.length,
      sampleProducts: value.productCatalog.map((p) => p.name),
    }));
  }

  /**
   * Thêm 1 giai đoạn mới vào phễu
   */
  async addStage(
    workspaceId = 'ws-default-001',
    stage: Omit<PipelineStageConfig, 'id' | 'order'>,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId, ownerId, currentStaffId);
    const newStage: PipelineStageConfig = {
      ...stage,
      id: `STAGE_${Date.now()}`,
      order: current.pipelineStages.length + 1,
    };

    return this.updateConfig(
      workspaceId,
      {
        pipelineStages: [...current.pipelineStages, newStage],
      },
      ownerId,
      currentStaffId,
    );
  }

  /**
   * Thêm 1 sản phẩm / khóa học / ngành đào tạo mới vào danh mục
   */
  async addProduct(
    workspaceId = 'ws-default-001',
    product: Omit<ProductItemConfig, 'id'>,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId, ownerId, currentStaffId);
    const newProduct: ProductItemConfig = {
      ...product,
      id: `PROD_${Date.now()}`,
    };

    return this.updateConfig(
      workspaceId,
      {
        productCatalog: [...current.productCatalog, newProduct],
      },
      ownerId,
      currentStaffId,
    );
  }

  /**
   * Thêm tiêu chí đánh giá / phân loại mới
   */
  async addCriteria(
    workspaceId = 'ws-default-001',
    criteria: Omit<LeadQualificationCriteria, 'id'>,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId, ownerId, currentStaffId);
    const newCriteria: LeadQualificationCriteria = {
      ...criteria,
      id: `CRIT_${Date.now()}`,
    };

    return this.updateConfig(
      workspaceId,
      {
        criteria: [...current.criteria, newCriteria],
      },
      ownerId,
      currentStaffId,
    );
  }

  /**
   * Xóa tiêu chí
   */
  async deleteCriteria(
    workspaceId = 'ws-default-001',
    criteriaId: string,
    ownerId?: string,
    currentStaffId?: string,
  ): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId, ownerId, currentStaffId);
    return this.updateConfig(
      workspaceId,
      {
        criteria: current.criteria.filter((c) => c.id !== criteriaId),
      },
      ownerId,
      currentStaffId,
    );
  }
}
