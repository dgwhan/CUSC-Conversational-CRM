import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { WorkspaceConfigService } from '../../application/workspace-config.service.js';
import { Roles } from '../../../../common/decorators/roles.decorator.js';
import { WorkspaceRolesGuard } from '../../../../common/guards/workspace-roles.guard.js';
import type { WorkspaceConfig } from '../../../../contracts/workspace-config.js';
import type {
  UpdateWorkspaceConfigRequestDto,
  ApplyPresetRequestDto,
  AddPipelineStageRequestDto,
  AddProductItemRequestDto,
  AddCriteriaRequestDto,
  PresetListResponseDto,
  WorkspaceItemResponseDto,
} from '../dto/index.js';

@Controller('workspaces/current')
@UseGuards(WorkspaceRolesGuard)
export class WorkspaceConfigController {
  constructor(private readonly configService: WorkspaceConfigService) {}

  /**
   * Lấy danh sách các workspace của người dùng hiện tại
   */
  @Get('my-workspaces')
  async getMyWorkspaces(
    @Headers('x-staff-id') staffId?: string,
    @Headers('x-owner-id') ownerId?: string,
  ): Promise<WorkspaceItemResponseDto[]> {
    return this.configService.getMyWorkspaces(staffId, ownerId);
  }

  /**
   * Lấy cấu hình của workspace hiện tại theo ownerId (mở cho cả Owner, Admin và Agent để đồng bộ UI)
   */
  @Get('config')
  async getConfig(
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.getConfig(workspaceId || 'ws-default-001', ownerId, staffId);
  }

  /**
   * Lấy danh sách các mẫu ngành nghề định sẵn (Education, Real Estate, Spa, SaaS, Retail)
   */
  @Get('presets')
  getPresets(): PresetListResponseDto {
    return this.configService.getPresetsList();
  }

  /**
   * Cập nhật cấu hình workspace theo ownerId (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Put('config')
  @Roles('OWNER')
  async updateConfig(
    @Body() payload: UpdateWorkspaceConfigRequestDto,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.updateConfig(workspaceId || 'ws-default-001', payload, ownerId, staffId);
  }

  /**
   * Áp dụng mẫu ngành nghề 1-click (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/apply-preset')
  @Roles('OWNER')
  async applyPreset(
    @Body() body: ApplyPresetRequestDto,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.applyPreset(
      workspaceId || 'ws-default-001',
      body.presetKey,
      body.workspaceName,
      ownerId,
      staffId,
    );
  }

  /**
   * Thêm giai đoạn mới vào phễu (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/stages')
  @Roles('OWNER')
  async addStage(
    @Body() stage: AddPipelineStageRequestDto,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.addStage(workspaceId || 'ws-default-001', stage, ownerId, staffId);
  }

  /**
   * Thêm sản phẩm / khóa học / ngành đào tạo mới (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/products')
  @Roles('OWNER')
  async addProduct(
    @Body() product: AddProductItemRequestDto,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.addProduct(workspaceId || 'ws-default-001', product, ownerId, staffId);
  }

  /**
   * Thêm tiêu chí đánh giá / phân loại mới (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Post('config/criteria')
  @Roles('OWNER')
  async addCriteria(
    @Body() criteria: AddCriteriaRequestDto,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.addCriteria(workspaceId || 'ws-default-001', criteria, ownerId, staffId);
  }

  /**
   * Xóa tiêu chí (Chỉ Chủ Doanh Nghiệp hoặc Admin)
   */
  @Delete('config/criteria/:criteriaId')
  @Roles('OWNER')
  async deleteCriteria(
    @Param('criteriaId') criteriaId: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-owner-id') ownerId?: string,
    @Headers('x-staff-id') staffId?: string,
  ): Promise<WorkspaceConfig> {
    return this.configService.deleteCriteria(workspaceId || 'ws-default-001', criteriaId, ownerId, staffId);
  }
}
