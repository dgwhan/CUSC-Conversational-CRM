export type ChannelType = 'FACEBOOK' | 'ZALO' | 'TIKTOK' | 'INSTAGRAM' | 'MANUAL';

export type LeadStatus = 'NEW' | 'POTENTIAL' | 'CONVERTED' | 'UNQUALIFIED';

export interface MessageAttachment {
  id: string;
  type: 'IMAGE' | 'FILE' | 'AUDIO';
  url: string;
  name?: string;
  size?: string;
  duration?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  attachments?: MessageAttachment[];
  sentAt: string;
  senderName: string;
  senderAvatar?: string;
  status?: 'SENT' | 'DELIVERED' | 'SEEN';
}

export interface InternalNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string;
  socialId: string;
  channel: ChannelType;
  channelAccountName: string;
  leadStatus: LeadStatus;
  tags: string[];
  interestCourses: string[];
  notes: InternalNote[];
}

export interface AssignedStaff {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

export interface ConversationItem {
  id: string;
  customer: CustomerProfile;
  channel: ChannelType;
  channelAccountName: string;
  snippet: string;
  lastMessageAt: string;
  lastCustomerMessageAt: string; // Used to check the 24-hour Meta rule
  unreadCount: number;
  assignedStaff?: AssignedStaff;
  tags: string[];
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  messages: ChatMessage[];
}

export interface QuickReplyItem {
  id: string;
  label: string;
  content: string;
  shortcut?: string;
}
