import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { WorkspaceConfigService } from './workspace-config.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard.js';
import type { WorkspaceConfig, BusinessDomain, PipelineStageConfig, ProductItemConfig } from '../../contracts/workspace-config.js';

@Controller('api/workspaces/current')
@UseGuards(WorkspaceRolesGuard)
export class WorkspaceConfigController {
  constructor(private readonly configService: WorkspaceConfigService) {}

  /**
   * Lấy cấu hình của workspace hiện tại (mở cho cả Owner, Admin và Agent để đồng bộ UI)
   */
  @Get('config')
  async getConfig(@Headers('x-workspace-id') workspaceId?: string): Promise<WorkspaceConfig> {
    return this.configService.getConfig(workspaceId || 'ws-default-001');
  }

  /**
   * Lấy danh sách các mẫu ngành nghề định sẵn (Education, Real Estate, Spa, SaaS, Retail)
   */
  @Get('presets')
  getPresets() {
    return this.configService.getPresetsList();
  }

  /**
   * Cập nhật cấu hình workspace (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Put('config')
  @Roles('OWNER', 'ADMIN')
  async updateConfig(
    @Body() payload: Partial<WorkspaceConfig>,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.updateConfig(workspaceId || 'ws-default-001', payload);
  }

  /**
   * Áp dụng mẫu ngành nghề 1-click (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/apply-preset')
  @Roles('OWNER', 'ADMIN')
  async applyPreset(
    @Body() body: { presetKey: BusinessDomain; workspaceName?: string },
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.applyPreset(workspaceId || 'ws-default-001', body.presetKey, body.workspaceName);
  }

  /**
   * Thêm giai đoạn mới vào phễu (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/stages')
  @Roles('OWNER', 'ADMIN')
  async addStage(
    @Body() stage: Omit<PipelineStageConfig, 'id' | 'order'>,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.addStage(workspaceId || 'ws-default-001', stage);
  }

  /**
   * Thêm sản phẩm / khóa học mới (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/products')
  @Roles('OWNER', 'ADMIN')
  async addProduct(
    @Body() product: Omit<ProductItemConfig, 'id'>,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.addProduct(workspaceId || 'ws-default-001', product);
  }
}
