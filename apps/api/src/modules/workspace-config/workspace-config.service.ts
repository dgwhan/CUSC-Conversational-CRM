import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from '../../contracts/workspace-config.js';
import { WorkspaceConfigSchema } from '../../contracts/workspace-config.js';
import { INDUSTRY_PRESETS } from './workspace-config.presets.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

const isUuid = (val?: string): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class WorkspaceConfigService {
  private readonly logger = new Logger(WorkspaceConfigService.name);

  // In-memory multi-tenant store fallback
  private readonly workspaceConfigs = new Map<string, WorkspaceConfig>();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    // Khởi tạo workspace mặc định cho CUSC (Education)
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
   * RÀNG BUỘC ĐA NGƯỜI DÙNG: Nếu là Staff, hệ thống tự động tìm và trả về ownerId của Staff đó,
   * đảm bảo Staff chỉ xem được workspace của Owner quản lý mình.
   */
  async resolveOwnerId(ownerId?: string, workspaceId?: string, currentStaffId?: string): Promise<string | null> {
    if (!this.prisma) return null;

    try {
      // 1. Kiểm tra theo currentStaffId (từ JWT / header)
      if (currentStaffId && isUuid(currentStaffId)) {
        const staff = await this.prisma.staff.findUnique({ where: { id: currentStaffId } });
        if (staff) {
          // Nếu là OWNER: chính là ownerId. Nếu là STAFF: trả về ownerId quản lý staff này
          return staff.role === 'OWNER' ? staff.id : (staff.ownerId || staff.id);
        }
      }

      // 2. Kiểm tra theo ownerId truyền lên
      if (ownerId && isUuid(ownerId)) {
        const staff = await this.prisma.staff.findUnique({ where: { id: ownerId } });
        if (staff) {
          return staff.role === 'OWNER' ? staff.id : (staff.ownerId || staff.id);
        }
      }

      // 3. Kiểm tra theo workspaceId
      if (workspaceId && isUuid(workspaceId)) {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (ws?.ownerId) return ws.ownerId;
      }

      // 4. Fallback tìm Owner mặc định từ DB (ví dụ tài khoản owner@cusc.com)
      const defaultOwner = await this.prisma.staff.findFirst({
        where: { role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
      });
      return defaultOwner?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Tìm workspaceId hợp lệ từ DB cho Owner.
   * Nếu owner đã có workspace trong bảng workspaces, trả về workspace.id.
   * Nếu owner chưa có workspace, tự động tạo mới 1 workspace trong bảng workspaces
   * để workspace_id của workspace_configurations LUÔN LUÔN được nối với workspaces.id, không bao giờ null.
   */
  async resolveWorkspaceForOwner(resolvedOwner: string, workspaceId?: string): Promise<string | null> {
    if (!this.prisma) return isUuid(workspaceId) ? workspaceId : null;

    try {
      // 1. Nếu workspaceId truyền lên là UUID hợp lệ, kiểm tra xem có thuộc về Owner này không
      if (workspaceId && isUuid(workspaceId)) {
        const directWs = await this.prisma.workspace.findFirst({
          where: { id: workspaceId, ownerId: resolvedOwner },
        });
        if (directWs) return directWs.id;

        const anyWs = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (anyWs && anyWs.ownerId === resolvedOwner) return anyWs.id;
      }

      // 2. Tìm workspace sẵn có của Owner này trong bảng workspaces
      const existingOwnerWs = await this.prisma.workspace.findFirst({
        where: { ownerId: resolvedOwner },
        orderBy: { createdAt: 'asc' },
      });
      if (existingOwnerWs) {
        return existingOwnerWs.id;
      }

      // 3. Nếu Owner này chưa có bất kỳ workspace nào trong bảng workspaces, tự động tạo mới
      const staff = await this.prisma.staff.findUnique({ where: { id: resolvedOwner } });
      const ownerName = staff?.fullName || 'CUSC';
      const cleanSlug = `ws-${resolvedOwner.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString(36)}`;

      const newWs = await this.prisma.workspace.create({
        data: {
          name: staff?.fullName ? `Workspace của ${ownerName}` : 'Trung tâm Công nghệ Phần mềm CUSC',
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

          let dbConfig = await this.prisma.workspaceConfiguration.findFirst({
            where: {
              OR: [
                { ownerId: resolvedOwner },
                ...(actualWsId ? [{ workspaceId: actualWsId }] : []),
              ],
            },
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
              workspaceName: dbConfig.workspaceName || 'Trung Tâm Công Nghệ Phần Mềm CUSC',
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

          const existing = await this.prisma.workspaceConfiguration.findFirst({
            where: {
              OR: [
                { ownerId: resolvedOwner },
                ...(actualWsId ? [{ workspaceId: actualWsId }] : []),
              ],
            },
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
