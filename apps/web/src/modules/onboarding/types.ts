export interface BusinessSetupData {
  companyName: string;
  brandName: string;
  businessScale: string;
  phone: string;
  industry: string;
}

export type ChannelKey = 'FACEBOOK' | 'ZALO' | 'TIKTOK' | 'INSTAGRAM';

export interface FanpageItem {
  id: string;
  name: string;
  avatarUrl: string;
  category: string;
  followerCount: number;
  channel: ChannelKey;
  selected: boolean;
}

export interface StaffInvite {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
}

export interface DiscoveredPageDto {
  id: string;
  externalAccountId: string;
  name: string;
  category: string;
  avatarUrl?: string;
  followerCount?: number;
  channel: ChannelKey;
  accessToken?: string;
}

export interface ChannelAccountDto {
  id: string;
  workspaceId: string | null;
  channel: ChannelKey;
  externalAccountId: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isWebhookSubscribed: boolean;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingState {
  step: 1 | 2 | 3;
  business: BusinessSetupData;
  connectedChannels: ChannelKey[];
  pages: FanpageItem[];
  invites: StaffInvite[];
}
