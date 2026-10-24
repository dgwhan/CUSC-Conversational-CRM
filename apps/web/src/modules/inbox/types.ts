export type ChannelType = 'FACEBOOK' | 'ZALO' | 'TIKTOK' | 'INSTAGRAM' | 'MANUAL';

export type LeadStatus = 'NEW' | 'POTENTIAL' | 'CONVERTED' | 'UNQUALIFIED';

// Các giai đoạn phễu tuyển sinh / Sales Pipeline theo chuẩn đào tạo CUSC
export type LeadStage =
  | 'NEW'          // 1. Tiếp nhận mới (Chưa liên hệ)
  | 'CONTACTED'    // 2. Đã liên hệ / Tư vấn thông tin
  | 'QUALIFIED'    // 3. Tiềm năng cao (Hỏi học bổng & lộ trình)
  | 'APPOINTMENT'  // 4. Hẹn nộp hồ sơ / Đăng ký trực tiếp
  | 'SUBMITTED'    // 5. Đã nộp hồ sơ / Chờ xét duyệt
  | 'ENROLLED'     // 6. Trúng tuyển / Đã nhập học (Đã chốt)
  | 'LOST';        // 7. Thất bại / Hủy hồ sơ

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
  leadStage?: LeadStage;
  estimatedValue?: number; // Học phí dự kiến (VNĐ)
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
  interestCourses: string[];
  notes: InternalNote[];
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
