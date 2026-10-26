export interface KanbanCandidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  channel: 'FACEBOOK' | 'ZALO' | 'ZALO_PERSONAL' | 'TIKTOK' | 'MANUAL';
  channelAccountName?: string;
  stage: string;
  estimatedTuition: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  interestCourses: string[];
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffAvatar?: string;
  assignedStaffPresence?: 'ONLINE' | 'AWAY' | 'BUSY';
  lastActivityAt: string;
  notesCount: number;
  tags: string[];
  conversationId?: string;
}

export interface KanbanColumnConfig {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const KANBAN_STAGES_CONFIG: KanbanColumnConfig[] = [
  {
    id: 'NEW',
    title: '1. Khách mới tiếp cận',
    subtitle: 'Chưa phân loại / Mới nhắn tin',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  {
    id: 'QUALIFIED',
    title: '2. Đã xác nhận nhu cầu',
    subtitle: 'Có nhu cầu học thật / Đã lấy SĐT',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  {
    id: 'CONSULTING',
    title: '3. Đang tư vấn chuyên sâu',
    subtitle: 'Đã gửi lộ trình & giải đáp học phí',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  {
    id: 'TRIAL_APPOINTMENT',
    title: '4. Hẹn học thử / Đến trực tiếp',
    subtitle: 'Đã đặt lịch hẹn tư vấn trực tiếp',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  {
    id: 'DEPOSIT_PAID',
    title: '5. Đã đóng cọc / Giữ chỗ',
    subtitle: 'Đã chuyển khoản giữ suất học bổng',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  {
    id: 'ENROLLED',
    title: '6. Nhập học thành công',
    subtitle: 'Hoàn tất 100% học phí & nhận lớp',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  {
    id: 'LOST',
    title: '7. Hủy / Thất bại',
    subtitle: 'Không phù hợp / Không liên lạc được',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
];

/**
 * Danh sách ứng viên Kanban khởi tạo rỗng.
 * Toàn bộ ứng viên sẽ được đồng bộ và cập nhật tự động từ các nguồn kênh trực tiếp.
 */
export const INITIAL_KANBAN_CANDIDATES: KanbanCandidate[] = [];
