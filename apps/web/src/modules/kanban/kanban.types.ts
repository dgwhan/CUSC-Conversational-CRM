import type { ChannelType, LeadStage, StaffPresenceStatus } from '../inbox/types.js';

export interface KanbanCandidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  channel: ChannelType;
  channelAccountName?: string;
  stage: LeadStage;
  estimatedTuition: number; // Học phí dự kiến (VNĐ)
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  interestCourses: string[];
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffAvatar?: string;
  assignedStaffPresence?: StaffPresenceStatus;
  lastActivityAt: string;
  notesCount: number;
  tags: string[];
  conversationId?: string; // Để 1-click nhảy sang chat trực tuyến
}

export interface KanbanColumnConfig {
  id: LeadStage;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface KanbanFilterState {
  searchQuery: string;
  channel: 'ALL' | ChannelType;
  staffId: string;
  course: string;
}
