export type ChannelType = 'FACEBOOK' | 'ZALO' | 'ZALO_PERSONAL' | 'TIKTOK' | 'INSTAGRAM' | 'MANUAL';

// Constants cho LeadStatus - Khớp chính xác với cột lead_status (VARCHAR 50) trong DB
export const LEAD_STATUS = {
  NEW: 'NEW',
  POTENTIAL: 'POTENTIAL',
  CONVERTED: 'CONVERTED',
  UNQUALIFIED: 'UNQUALIFIED',
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

// Constants cho Pipeline Stage IDs - Khớp chính xác với các stage config của Workspace / DB lead_stage
export const PIPELINE_STAGE_ID = {
  STAGE_NEW: 'STAGE_NEW',
  STAGE_CONTACTED: 'STAGE_CONTACTED',
  STAGE_QUALIFIED: 'STAGE_QUALIFIED',
  STAGE_APPOINTMENT: 'STAGE_APPOINTMENT',
  STAGE_SUBMITTED: 'STAGE_SUBMITTED',
  STAGE_ENROLLED: 'STAGE_ENROLLED',
  STAGE_LOST: 'STAGE_LOST',
} as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_ID)[keyof typeof PIPELINE_STAGE_ID];

// Các giai đoạn phễu tuyển sinh / Sales Pipeline theo chuẩn đào tạo CUSC hoặc tùy biến Workspace
export type LeadStage =
  | 'NEW'          // 1. Tiếp nhận mới (Chưa liên hệ)
  | 'CONTACTED'    // 2. Đã liên hệ / Tư vấn thông tin
  | 'QUALIFIED'    // 3. Tiềm năng cao (Hỏi học bổng & lộ trình)
  | 'APPOINTMENT'  // 4. Hẹn nộp hồ sơ / Đăng ký trực tiếp
  | 'SUBMITTED'    // 5. Đã nộp hồ sơ / Chờ xét duyệt
  | 'ENROLLED'     // 6. Trúng tuyển / Đã nhập học (Đã chốt)
  | 'LOST'         // 7. Thất bại / Hủy hồ sơ
  | PipelineStageId
  | (string & {});

export type StaffPresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY';

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

export interface ChannelIdentityItem {
  id?: string;
  channel: string;
  externalUserId: string;
  createdAt?: string;
}

export interface CustomerProfile {
  id: string;
  contactId?: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string;
  profileUrl?: string;
  socialId: string;
  channel: ChannelType;
  channelAccountName: string;
  leadStatus: LeadStatus;
  leadStage?: LeadStage;
  estimatedValue?: number; // Học phí dự kiến (VNĐ)
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
  interestCourses: string[];
  notes: InternalNote[];
  channelIdentities?: ChannelIdentityItem[];
}

export interface AssignedStaff {
  id: string;
  name: string;
  avatar: string;
  role: string;
  presenceStatus?: StaffPresenceStatus;
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
