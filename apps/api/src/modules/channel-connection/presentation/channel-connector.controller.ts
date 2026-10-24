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
} from '@nestjs/common';
import { OAuthService } from '../application/oauth.service.js';
import { ChannelManagerService } from '../application/channel-manager.service.js';
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

@Controller('api')
export class ChannelConnectorController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly channelManager: ChannelManagerService,
  ) {}

  /**
   * GET /api/oauth/:channel/authorize-url
   * Sinh URL đăng nhập OAuth kèm state token chống CSRF
   */
  @Get('oauth/:channel/authorize-url')
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
   * Trao đổi Authorization Code lấy token và danh sách Fanpage / OA
   */
  @Post('oauth/:channel/exchange-token')
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
    );
  }

  /**
   * POST /api/channels/activate
   * Kích hoạt danh sách Fanpage vào Workspace & Mã hóa AES-256 Token
   */
  @Post('channels/activate')
  @HttpCode(HttpStatus.OK)
  async activateChannels(
    @Body() rawBody: unknown,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
  ): Promise<ActivateChannelsResult> {
    const bodyResult = ActivateChannelsBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      throw new BadRequestException(bodyResult.error.message);
    }

    const payload = bodyResult.data;
    if (!payload.workspaceId && headerWorkspaceId) {
      payload.workspaceId = headerWorkspaceId;
    }

    return this.channelManager.activateChannels(payload);
  }

  /**
   * GET /api/channels
   * Danh sách các kênh đã liên kết trong Workspace (Bảo vệ cô lập dữ liệu theo Workspace)
   */
  @Get('channels')
  async getChannels(
    @Query('workspaceId') queryWorkspaceId?: string,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
  ): Promise<ChannelAccountDto[]> {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.getChannels(effectiveWorkspaceId);
  }

  /**
   * PATCH /api/channels/:id/toggle
   * Bật / Tắt hoạt động của kênh (Kiểm tra quyền hạn theo Workspace)
   */
  @Patch('channels/:id/toggle')
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
   * DELETE /api/channels/:id
   * Ngắt kết nối kênh (Kiểm tra quyền hạn theo Workspace)
   */
  @Delete('channels/:id')
  async disconnectChannel(
    @Param('id') id: string,
    @Headers('x-workspace-id') headerWorkspaceId?: string,
    @Query('workspaceId') queryWorkspaceId?: string,
  ): Promise<{ success: boolean; id: string }> {
    const effectiveWorkspaceId = queryWorkspaceId || headerWorkspaceId;
    return this.channelManager.disconnectChannel(id, effectiveWorkspaceId);
  }
}
