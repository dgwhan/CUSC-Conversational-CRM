import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type {
  WorkspaceConfig,
  BusinessDomain,
  PipelineStageConfig,
  ProductItemConfig,
} from '../../contracts/workspace-config.js';
import { WorkspaceConfigSchema } from '../../contracts/workspace-config.js';
import { INDUSTRY_PRESETS } from './workspace-config.presets.js';

@Injectable()
export class WorkspaceConfigService {
  private readonly logger = new Logger(WorkspaceConfigService.name);

  // In-memory multi-tenant store keyed by workspaceId
  private readonly workspaceConfigs = new Map<string, WorkspaceConfig>();

  constructor() {
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
   * Lấy cấu hình của workspace hiện tại (nếu chưa có thì tự sinh từ preset Education)
   */
  async getConfig(workspaceId = 'ws-default-001'): Promise<WorkspaceConfig> {
    let config = this.workspaceConfigs.get(workspaceId);
    if (!config) {
      config = this.initDefaultWorkspace(workspaceId, 'EDUCATION');
    }
    return config;
  }

  /**
   * Cập nhật toàn diện hoặc từng phần cấu hình workspace (Admin/Owner quyền hạn)
   */
  async updateConfig(workspaceId = 'ws-default-001', patch: Partial<WorkspaceConfig>): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId);

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

    // Đảm bảo pipeline có ít nhất 1 stage thắng (Won) và 1 stage thua (Lost) hoặc cảnh báo
    const stages = validation.data.pipelineStages;
    if (stages.length < 2) {
      throw new BadRequestException('Phễu bán hàng / tuyển sinh phải có ít nhất 2 giai đoạn.');
    }

    this.workspaceConfigs.set(workspaceId, validation.data);
    this.logger.log(`Updated workspace config for ${workspaceId} [Domain: ${validation.data.domain}]`);
    return validation.data;
  }

  /**
   * Áp dụng 1 mẫu cấu hình ngành nghề định sẵn (1-click preset)
   */
  async applyPreset(workspaceId = 'ws-default-001', presetKey: BusinessDomain, customWorkspaceName?: string): Promise<WorkspaceConfig> {
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

    this.workspaceConfigs.set(workspaceId, newConfig);
    this.logger.log(`Applied preset "${presetKey}" to workspace ${workspaceId}`);
    return newConfig;
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
  async addStage(workspaceId = 'ws-default-001', stage: Omit<PipelineStageConfig, 'id' | 'order'>): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId);
    const newStage: PipelineStageConfig = {
      ...stage,
      id: `STAGE_${Date.now()}`,
      order: current.pipelineStages.length + 1,
    };

    return this.updateConfig(workspaceId, {
      pipelineStages: [...current.pipelineStages, newStage],
    });
  }

  /**
   * Thêm 1 sản phẩm / khóa học mới vào danh mục
   */
  async addProduct(workspaceId = 'ws-default-001', product: Omit<ProductItemConfig, 'id'>): Promise<WorkspaceConfig> {
    const current = await this.getConfig(workspaceId);
    const newProduct: ProductItemConfig = {
      ...product,
      id: `PROD_${Date.now()}`,
    };

    return this.updateConfig(workspaceId, {
      productCatalog: [...current.productCatalog, newProduct],
    });
  }
}
