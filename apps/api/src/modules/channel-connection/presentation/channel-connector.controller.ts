import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
  Optional,
} from '@nestjs/common';
import { OAuthService } from '../application/oauth.service.js';
import { ChannelManagerService } from '../application/channel-manager.service.js';
import { ZcaPersonalService } from '../application/zca-personal.service.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { WorkspaceRolesGuard } from '../../../common/guards/workspace-roles.guard.js';
import {
  ChannelTypeSchema,
  AuthorizeUrlQuerySchema,
  ExchangeTokenBodySchema,
  ActivateChannelsBodySchema,
  type ChannelType,
  type AuthorizeUrlResult,
  type ExchangeTokenResult,
  type ActivateChannelsResult,
  type ChannelAccountDto,
} from '../../../contracts/channel-connection.js';

@Controller()
@UseGuards(WorkspaceRolesGuard)
export class ChannelConnectorController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly channelManager: ChannelManagerService,
    @Optional() private readonly zcaService?: ZcaPersonalService,
  ) {}

  /**
   * GET /api/oauth/:channel/authorize-url
   * Sinh URL đăng nhập OAuth kèm state token chống CSRF (Chỉ OWNER / ADMIN)
   */
  @Get('oauth/:channel/authorize-url')
  @Roles('OWNER', 'ADMIN')
  getAuthorizeUrl(
    @Param('channel') rawChannel: string,
    @Query() rawQuery: Record<string, unknown>,
  ): AuthorizeUrlResult {
    const channelResult = ChannelTypeSchema.safeParse(rawChannel.toUpperCase());
    if (!channelResult.success) {
      throw new BadRequestException(
        `Invalid channel '${rawChannel}'. Must be one of: FACEBOOK, ZALO, TIKTOK, INSTAGRAM`,
      );
    }

    const queryResult = AuthorizeUrlQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      throw new BadRequestException(queryResult.error.message);
    }

    return this.oauthService.generateAuthorizeUrl(
      channelResult.data as ChannelType,
      queryResult.data.redirectUri,
      queryResult.data.state,
    );
  }

  /**
   * POST /api/oauth/:channel/exchange-token
   * Trao đổi Authorization Code lấy token và danh sách Fanpage / OA (Chỉ OWNER / ADMIN)
   */
  @Post('oauth/:channel/exchange-token')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async exchangeToken(
    @Param('channel') rawChannel: string,
    @Body() rawBody: unknown,
  ): Promise<ExchangeTokenResult> {
    const channelResult = ChannelTypeSchema.safeParse(rawChannel.toUpperCase());
    if (!channelResult.success) {
      throw new BadRequestException(
        `Invalid channel '${rawChannel}'. Must be one of: FACEBOOK, ZALO, TIKTOK, INSTAGRAM`,
      );
    }

    const bodyResult = ExchangeTokenBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      throw new BadRequestException(bodyResult.error.message);
    }

    return this.oauthService.exchangeToken(
      channelResult.data as ChannelType,
      bodyResult.data.code,
      bodyResult.data.state,
      bodyResult.data.redirectUri,
      {
        pageId: bodyResult.data.pageId,
        pageName: bodyResult.data.pageName,
        accessToken: bodyResult.data.accessToken,
      },
    );
  }

  /**
   * POST /api/channels/activate
   * Kích hoạt danh sách Fanpage vào Workspace & Mã hóa AES-256 Token (Chỉ OWNER / ADMIN)
   */
  @Post('channels/activate')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async activateChannels(
    @Body() rawBody: unknown,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Headers('x-owner-id') headerOwnerId?: string,
  ): Promise<ActivateChannelsResult> {
    const bodyResult = ActivateChannelsBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      throw new BadRequestException(bodyResult.error.message);
    }

    const payload = bodyResult.data;
    if (!payload.workspaceId && headerWorkspaceId) {
      payload.workspaceId = headerWorkspaceId;
    }

    return this.channelManager.activateChannels(payload, headerOwnerId);
  }

  /**
   * GET /api/channels
   * Danh sách các kênh đã liên kết trong Workspace (Bảo vệ cô lập dữ liệu theo Workspace)
   */
  @Get('channels')
  async getChannels(
    @Query('workspaceId') queryWorkspaceId?: string,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Headers('x-owner-id') headerOwnerId?: string,
  ): Promise<ChannelAccountDto[]> {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.getChannels(effectiveWorkspaceId, headerOwnerId);
  }

  /**
   * PATCH /api/channels/:id/toggle
   * Bật / Tắt hoạt động của kênh (Chỉ OWNER / ADMIN)
   */
  @Patch('channels/:id/toggle')
  @Roles('OWNER', 'ADMIN')
  async toggleChannel(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Query('workspaceId') queryWorkspaceId?: string,
  ): Promise<ChannelAccountDto> {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.toggleChannel(id, effectiveWorkspaceId, isActive);
  }

  /**
   * POST /api/channels/:id/sync
   * Đồng bộ tin nhắn từ kênh (Zalo OA, Zalo Cá nhân zca-js, Facebook Fanpage) về CRM (Chỉ OWNER / ADMIN)
   */
  @Post('channels/:id/sync')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async syncChannel(
    @Param('id') id: string,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Query('workspaceId') queryWorkspaceId?: string,
  ) {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.syncChannel(id, effectiveWorkspaceId);
  }

  /**
   * POST /api/channels/send-message
   * Gửi tin nhắn Outbound đến khách hàng qua Zalo OA hoặc Facebook Fanpage
   */
  @Post('channels/send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body()
    body: {
      channel: ChannelType;
      recipientId: string;
      content: string;
      channelAccountId?: string;
      conversationId?: string;
      workspaceId?: string;
    },
    @Headers('x-workspace-id') headerWorkspaceId?: string,
  ) {
    if (!body.recipientId?.trim()) {
      throw new BadRequestException('recipientId (ID người nhận trên kênh) không được để trống');
    }
    if (!body.content?.trim()) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }

    const effectiveWorkspaceId = body.workspaceId || headerWorkspaceId;
    return this.channelManager.sendMessage({
      channel: body.channel || 'ZALO',
      recipientId: body.recipientId.trim(),
      content: body.content.trim(),
      channelAccountId: body.channelAccountId,
      conversationId: body.conversationId,
      workspaceId: effectiveWorkspaceId,
    });
  }

  private getZcaService(): ZcaPersonalService {
    if (!this.zcaService) {
      throw new BadRequestException('ZCA Personal service is not available');
    }
    return this.zcaService;
  }

  /**
   * POST /api/channels/zalo-personal/qr-init
   * Khởi tạo phiên quét mã QR Đăng nhập Zalo Cá nhân (zca-js Engine)
   */
  @Post('channels/zalo-personal/qr-init')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async initZaloPersonalQr() {
    return this.getZcaService().createQrSession();
  }

  /**
   * GET /api/channels/zalo-personal/qr-status
   * Kiểm tra trạng thái phiên quét mã QR
   */
  @Get('channels/zalo-personal/qr-status')
  @Roles('OWNER', 'ADMIN')
  async getZaloPersonalQrStatus(@Query('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return this.getZcaService().getQrSessionStatus(sessionId);
  }

  /**
   * POST /api/channels/zalo-personal/qr-confirm
   * Xác nhận / Mô phỏng đăng nhập thành công sau khi quét mã
   */
  @Post('channels/zalo-personal/qr-confirm')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async confirmZaloPersonalQr(
    @Body()
    body: {
      sessionId: string;
      displayName?: string;
      phone?: string;
      avatarUrl?: string;
      externalAccountId?: string;
    },
  ) {
    if (!body?.sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return this.getZcaService().simulateOrConfirmQrLogin(body.sessionId, body);
  }

  /**
   * GET /api/channels/zalo-personal/safety-config
   * Lấy cấu hình giới hạn tần suất & an toàn chống khóa nick
   */
  @Get('channels/zalo-personal/safety-config')
  @Roles('OWNER', 'ADMIN')
  getSafetyConfig() {
    return this.getZcaService().getSafetyConfig();
  }

  /**
   * PATCH /api/channels/zalo-personal/safety-config
   * Cập nhật cấu hình bảo vệ tần suất
   */
  @Patch('channels/zalo-personal/safety-config')
  @Roles('OWNER', 'ADMIN')
  updateSafetyConfig(@Body() body: Record<string, unknown>) {
    return this.getZcaService().updateSafetyConfig(body as any);
  }

  /**
   * DELETE /api/channels/:id
   * Ngắt kết nối kênh (Chỉ OWNER / ADMIN)
   */
  @Delete('channels/:id')
  @Roles('OWNER', 'ADMIN')
  async disconnectChannel(
    @Param('id') id: string,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Query('workspaceId') queryWorkspaceId?: string,
  ): Promise<{ success: boolean; id: string }> {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.disconnectChannel(id, effectiveWorkspaceId);
  }
}
