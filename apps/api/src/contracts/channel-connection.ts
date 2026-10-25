import { z } from 'zod';

export const ChannelTypeSchema = z.enum(['FACEBOOK', 'ZALO', 'TIKTOK', 'INSTAGRAM']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const AuthorizeUrlQuerySchema = z.object({
  redirectUri: z.string().url().optional(),
  state: z.string().optional(),
});
export type AuthorizeUrlQuery = z.infer<typeof AuthorizeUrlQuerySchema>;

export interface AuthorizeUrlResult {
  authorizeUrl: string;
  state: string;
  channel: ChannelType;
}

export const ExchangeTokenBodySchema = z
  .object({
    code: z.string().optional(),
    state: z.string().optional(),
    redirectUri: z.string().url().optional(),
    pageId: z.string().optional(),
    pageName: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .refine(
    (data) => !!(data.code || data.accessToken || data.pageId),
    'Yêu cầu Authorization code hoặc Page ID / Access Token để xác thực kết nối',
  );
export type ExchangeTokenBody = z.infer<typeof ExchangeTokenBodySchema>;

export interface OAuthDiscoveredPage {
  id: string;
  externalAccountId: string;
  name: string;
  category: string;
  avatarUrl?: string;
  followerCount?: number;
  channel: ChannelType;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

export interface ExchangeTokenResult {
  channel: ChannelType;
  userName?: string;
  userId?: string;
  pages: OAuthDiscoveredPage[];
}

export const ActivatePageItemSchema = z.object({
  channel: ChannelTypeSchema,
  externalAccountId: z.string().min(1, 'externalAccountId is required'),
  displayName: z.string().min(1, 'displayName is required'),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  category: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ActivatePageItem = z.infer<typeof ActivatePageItemSchema>;

export const ActivateChannelsBodySchema = z.object({
  workspaceId: z.string().optional(),
  pages: z.array(ActivatePageItemSchema).min(1, 'At least 1 page must be selected to activate'),
});
export type ActivateChannelsBody = z.infer<typeof ActivateChannelsBodySchema>;

export interface ChannelAccountDto {
  id: string;
  workspaceId: string | null;
  channel: ChannelType;
  externalAccountId: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isWebhookSubscribed: boolean;
  hasToken: boolean;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivateChannelsResult {
  activatedCount: number;
  workspaceId: string;
  channels: ChannelAccountDto[];
}
