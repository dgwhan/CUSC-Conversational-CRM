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

export interface OnboardingState {
  step: 1 | 2 | 3;
  business: BusinessSetupData;
  connectedChannels: ChannelKey[];
  pages: FanpageItem[];
  invites: StaffInvite[];
}
