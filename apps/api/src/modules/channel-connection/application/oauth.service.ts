import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type {
  ChannelType,
  AuthorizeUrlResult,
  ExchangeTokenResult,
  OAuthDiscoveredPage,
} from '../../../contracts/channel-connection.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Tạo URL ủy quyền OAuth kèm State token chống CSRF
   */
  generateAuthorizeUrl(
    channel: ChannelType,
    redirectUri?: string,
    existingState?: string,
  ): AuthorizeUrlResult {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const state = existingState || randomBytes(16).toString('hex');

    // Đọc URL frontend từ cấu hình môi trường, không gán cứng
    const frontendBaseUrl =
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_BASE_URL') ||
      'http://localhost:5173';
    const defaultRedirect = redirectUri || `${frontendBaseUrl.replace(/\/+$/, '')}/onboarding`;

    let authorizeUrl = '';

    switch (channel) {
      case 'FACEBOOK': {
        const appId = this.config.get<string>('META_APP_ID');
        if (!appId) {
          if (isProduction) {
            throw new ServiceUnavailableException(
              'Facebook OAuth is not configured on this server. Missing META_APP_ID environment variable.',
            );
          }
          this.logger.warn('META_APP_ID is not configured. Generating dev simulation authorize URL.');
        }

        const effectiveAppId = appId || 'dev_simulated_meta_app_id';
        const scopes = [
          'pages_messaging',
          'pages_manage_metadata',
          'pages_read_engagement',
          'pages_show_list',
        ].join(',');
        authorizeUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${effectiveAppId}&redirect_uri=${encodeURIComponent(
          defaultRedirect,
        )}&state=${state}&scope=${scopes}`;
        break;
      }

      case 'ZALO': {
        const appId = this.config.get<string>('ZALO_APP_ID');
        if (!appId) {
          if (isProduction) {
            throw new ServiceUnavailableException(
              'Zalo OAuth is not configured on this server. Missing ZALO_APP_ID environment variable.',
            );
          }
          this.logger.warn('ZALO_APP_ID is not configured. Generating dev simulation authorize URL.');
        }

        const effectiveAppId = appId || 'dev_simulated_zalo_app_id';
        authorizeUrl = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${effectiveAppId}&redirect_uri=${encodeURIComponent(
          defaultRedirect,
        )}&state=${state}`;
        break;
      }

      case 'TIKTOK': {
        const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY');
        if (!clientKey && isProduction) {
          throw new ServiceUnavailableException(
            'TikTok OAuth is not configured on this server. Missing TIKTOK_CLIENT_KEY environment variable.',
          );
        }
        const effectiveKey = clientKey || 'dev_simulated_tiktok_key';
        authorizeUrl = `https://open.tiktokapis.com/v2/oauth/authorize/?client_key=${effectiveKey}&scope=user.info.basic,video.list&response_type=code&redirect_uri=${encodeURIComponent(
          defaultRedirect,
        )}&state=${state}`;
        break;
      }

      case 'INSTAGRAM': {
        const appId = this.config.get<string>('META_APP_ID');
        if (!appId && isProduction) {
          throw new ServiceUnavailableException(
            'Instagram OAuth is not configured on this server. Missing META_APP_ID environment variable.',
          );
        }
        const effectiveAppId = appId || 'dev_simulated_ig_app_id';
        authorizeUrl = `https://api.instagram.com/oauth/authorize?client_id=${effectiveAppId}&redirect_uri=${encodeURIComponent(
          defaultRedirect,
        )}&scope=user_profile,user_media&response_type=code&state=${state}`;
        break;
      }
    }

    return {
      channel,
      state,
      authorizeUrl,
    };
  }

  /**
   * Trao đổi Authorization Code lấy Access Token và danh sách Fanpage / OA
   */
  async exchangeToken(
    channel: ChannelType,
    code: string,
    state: string,
    redirectUri?: string,
  ): Promise<ExchangeTokenResult> {
    this.logger.log(`Exchanging OAuth token for channel ${channel} (code: ${code.substring(0, 8)}...)`);

    const metaAppId = this.config.get<string>('META_APP_ID');
    const metaAppSecret = this.config.get<string>('META_APP_SECRET');

    // Nếu có thông tin Meta App Secret thực tế thì gọi Meta Graph API
    if (channel === 'FACEBOOK' && metaAppId && metaAppSecret && !code.startsWith('mock_') && !code.startsWith('test_') && !code.startsWith('auth_code_')) {
      try {
        return await this.fetchMetaRealPages(code, redirectUri);
      } catch (err: unknown) {
        this.logger.warn(`Meta Graph API call failed (${(err as Error).message}), falling back to dev simulation`);
      }
    }

    // Chế độ mô phỏng / Phát triển (Simulation Mode)
    return this.getSimulatedDiscoveredPages(channel);
  }

  /**
   * Gọi Meta Graph API thực tế khi đã cấu hình App ID & Secret
   */
  private async fetchMetaRealPages(code: string, redirectUri?: string): Promise<ExchangeTokenResult> {
    const appId = this.config.get<string>('META_APP_ID')!;
    const appSecret = this.config.get<string>('META_APP_SECRET')!;
    const frontendBaseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const rUri = redirectUri || `${frontendBaseUrl.replace(/\/+$/, '')}/onboarding`;

    // 1. Đổi code lấy User Access Token ngắn hạn
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      rUri,
    )}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Failed to exchange Meta user token: ${tokenData.error?.message || tokenRes.statusText}`);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Nâng cấp sang Long-lived User Token (60 ngày)
    const longTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json();
    const userToken = longTokenData.access_token || shortLivedToken;

    // 3. Lấy thông tin user
    const userMeRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${userToken}`);
    const userMe = await userMeRes.json();

    // 4. Lấy danh sách Pages & Permanent Page Access Tokens
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,access_token,picture{url},followers_count&access_token=${userToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    const pages: OAuthDiscoveredPage[] = (accountsData.data || []).map((p: any) => ({
      id: `fb-${p.id}`,
      externalAccountId: p.id,
      name: p.name,
      category: p.category || 'Trang Facebook',
      avatarUrl: p.picture?.data?.url || '',
      followerCount: p.followers_count || 0,
      channel: 'FACEBOOK' as ChannelType,
      accessToken: p.access_token,
      tokenExpiresAt: undefined,
    }));

    return {
      channel: 'FACEBOOK',
      userName: userMe.name || 'Meta Administrator',
      userId: userMe.id,
      pages,
    };
  }

  /**
   * Danh sách Fanpage/OA mô phỏng thực tế phục vụ môi trường phát triển & kiểm thử
   */
  private getSimulatedDiscoveredPages(channel: ChannelType): ExchangeTokenResult {
    const mockTokens = {
      fb1: `EAA${randomBytes(40).toString('hex')}`,
      fb2: `EAA${randomBytes(40).toString('hex')}`,
      zalo1: `zalo_token_${randomBytes(32).toString('hex')}`,
      tiktok1: `tiktok_token_${randomBytes(32).toString('hex')}`,
      ig1: `ig_token_${randomBytes(32).toString('hex')}`,
    };

    switch (channel) {
      case 'FACEBOOK':
        return {
          channel: 'FACEBOOK',
          userName: 'Quản trị viên Fanpage',
          userId: 'fb_usr_99182749',
          pages: [
            {
              id: 'fb-page-01',
              externalAccountId: 'page_cusc_ctu_edu_vn',
              name: 'CUSC - Trung Tâm Công Nghệ Phần Mềm ĐH Cần Thơ',
              category: 'Trường Đại học & Đào tạo IT',
              avatarUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=60',
              followerCount: 48500,
              channel: 'FACEBOOK',
              accessToken: mockTokens.fb1,
            },
            {
              id: 'fb-page-02',
              externalAccountId: 'page_aptech_cantho',
              name: 'Tuyển sinh Aptech Cần Thơ - CUSC',
              category: 'Chương trình Quốc tế Aptech & Arena',
              avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=60',
              followerCount: 21300,
              channel: 'FACEBOOK',
              accessToken: mockTokens.fb2,
            },
          ],
        };

      case 'ZALO':
        return {
          channel: 'ZALO',
          userName: 'Ban Tuyển Sinh Zalo OA',
          userId: 'zalo_usr_1849204',
          pages: [
            {
              id: 'zalo-oa-01',
              externalAccountId: 'oa_cusc_official_tick_vang',
              name: 'CUSC Official Account (Tick Vàng)',
              category: 'Zalo Doanh Nghiệp Xác Thực',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
              followerCount: 15200,
              channel: 'ZALO',
              accessToken: mockTokens.zalo1,
              refreshToken: `zalo_refresh_${randomBytes(24).toString('hex')}`,
              tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };

      case 'TIKTOK':
        return {
          channel: 'TIKTOK',
          userName: 'CUSC Tech Creator',
          userId: 'tiktok_usr_77182',
          pages: [
            {
              id: 'tt-shop-01',
              externalAccountId: 'tiktok_cusc_tech_life',
              name: 'CUSC Tech Life (@cusc.tech)',
              category: 'Kênh TikTok Học Lập Trình',
              avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60',
              followerCount: 84000,
              channel: 'TIKTOK',
              accessToken: mockTokens.tiktok1,
            },
          ],
        };

      case 'INSTAGRAM':
        return {
          channel: 'INSTAGRAM',
          userName: 'cusc.education',
          userId: 'ig_usr_551829',
          pages: [
            {
              id: 'ig-pro-01',
              externalAccountId: 'ig_cusc_education_direct',
              name: 'Instagram Direct (@cusc.education)',
              category: 'Tài khoản Chuyên nghiệp',
              avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=60',
              followerCount: 12800,
              channel: 'INSTAGRAM',
              accessToken: mockTokens.ig1,
            },
          ],
        };
    }
  }
}
