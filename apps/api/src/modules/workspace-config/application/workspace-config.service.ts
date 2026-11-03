import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
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
import { WorkspaceLifecycleService } from './workspace-lifecycle.service.js';
import { WorkspaceHotlineService } from './workspace-hotline.service.js';
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

const isUuid = (val?: string): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class WorkspaceConfigService {
  private readonly logger = new Logger(WorkspaceConfigService.name);

  // In-memory multi-tenant store fallback
  private readonly workspaceConfigs = new Map<string, WorkspaceConfig>();

  private readonly lifecycle: WorkspaceLifecycleService;
  private readonly hotline: WorkspaceHotlineService;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() lifecycleService?: WorkspaceLifecycleService,
    @Optional() hotlineService?: WorkspaceHotlineService,
  ) {
    this.lifecycle = lifecycleService || new WorkspaceLifecycleService(prisma);
    this.hotline = hotlineService || new WorkspaceHotlineService();
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

  // ================= Workspace Lifecycle Delegations =================

  async resolveOwnerId(ownerId?: string, workspaceId?: string, currentStaffId?: string): Promise<string | null> {
    return this.lifecycle.resolveOwnerId(ownerId, workspaceId, currentStaffId);
  }

  async getMyWorkspaces(currentStaffId?: string, ownerId?: string): Promise<WorkspaceItemResponseDto[]> {
    return this.lifecycle.getMyWorkspaces(currentStaffId, ownerId);
  }

  async createWorkspace(
    data: CreateWorkspaceRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceItemResponseDto> {
    return this.lifecycle.createWorkspace(data, staffId, ownerId);
  }

  async updateWorkspace(
    workspaceId: string,
    data: UpdateWorkspaceRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceItemResponseDto> {
    return this.lifecycle.updateWorkspace(workspaceId, data, staffId, ownerId);
  }

  async deleteWorkspace(
    workspaceId: string,
    staffId?: string,
    ownerId?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.lifecycle.deleteWorkspace(workspaceId, staffId, ownerId);
  }

  async resolveWorkspaceForOwner(resolvedOwner: string, workspaceId?: string): Promise<string | null> {
    return this.lifecycle.resolveWorkspaceForOwner(resolvedOwner, workspaceId);
  }

  // ================= Hotline Delegations =================

  async getHotlines(workspaceId: string): Promise<WorkspaceHotlineResponseDto[]> {
    return this.hotline.getHotlines(workspaceId);
  }

  async createHotline(
    workspaceId: string,
    data: CreateHotlineRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceHotlineResponseDto> {
    return this.hotline.createHotline(workspaceId, data, staffId, ownerId);
  }

  async updateHotline(
    workspaceId: string,
    hotlineId: string,
    patch: UpdateHotlineRequestDto,
    staffId?: string,
    ownerId?: string,
  ): Promise<WorkspaceHotlineResponseDto> {
    return this.hotline.updateHotline(workspaceId, hotlineId, patch, staffId, ownerId);
  }

  async deleteHotline(
    workspaceId: string,
    hotlineId: string,
    staffId?: string,
    ownerId?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.hotline.deleteHotline(workspaceId, hotlineId, staffId, ownerId);
  }

  // ================= Workspace Configuration & Domain Presets =================

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

          let dbConfig = await this.prisma.workspaceConfiguration.findFirst({
            where: { OR: [...(actualWsId ? [{ workspaceId: actualWsId }] : []), { ownerId: resolvedOwner }] },
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
        ...patch.terminology,
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
