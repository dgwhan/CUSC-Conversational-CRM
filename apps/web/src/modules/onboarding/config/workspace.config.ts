export type ConnectionStatus =
  | 'Connected'
  | 'Connecting'
  | 'Disconnected'
  | 'Expired'
  | 'Error'
  | 'Syncing'
  | 'Pending';

/**
 * Nhãn tiếng Việt chuẩn cho từng trạng thái kết nối
 */
export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  Connected: 'Đang kết nối',
  Connecting: 'Đang xác thực',
  Disconnected: 'Đã ngắt kết nối',
  Expired: 'Token hết hạn',
  Error: 'Lỗi kết nối',
  Syncing: 'Đang đồng bộ',
  Pending: 'Đang chờ xác nhận',
};

/**
 * Tự động ánh xạ trạng thái sang class hệ thống trong theme.css (Không khai báo lặp lại)
 */
export const CONNECTION_STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; badgeClass: string; dotClass: string }
> = Object.fromEntries(
  Object.entries(CONNECTION_STATUS_LABELS).map(([status, label]) => [
    status,
    {
      label,
      badgeClass: `badge-status-${status.toLowerCase()}`,
      dotClass: `dot-status-${status.toLowerCase()}`,
    },
  ]),
) as Record<ConnectionStatus, { label: string; badgeClass: string; dotClass: string }>;

/**
 * Helper: Xác định trạng thái kết nối chuẩn hóa hệ thống
 */
export const getChannelStatus = (
  ch: {
    isActive?: boolean;
    status?: ConnectionStatus;
    hasToken?: boolean;
    isWebhookSubscribed?: boolean;
  },
  isSyncing: boolean,
): ConnectionStatus => {
  if (isSyncing) return 'Syncing';
  if (!ch.isActive) return 'Disconnected';
  if (ch.status) return ch.status;
  if (ch.hasToken === false) return 'Expired';
  if (ch.isWebhookSubscribed === false) return 'Error';
  return 'Connected';
};

/**
 * Danh sách nền tảng giao tiếp khả dụng (Sử dụng badge chuẩn hệ thống từ theme.css)
 */
export const CHANNEL_PLATFORMS_CONFIG = [
  {
    key: 'FACEBOOK' as const,
    name: 'Facebook Messenger',
    badge: 'Meta API',
    badgeClass: 'badge-primary',
    description: 'Kết nối các trang Facebook Pages và quản lý hội thoại tập trung trên hộp thư CRM.',
    actionLabel: 'Kết nối Facebook Page',
    modalDescription: 'Kết nối Facebook Pages và quản lý hội thoại',
  },
  {
    key: 'ZALO' as const,
    name: 'Zalo Official Account',
    badge: 'Zalo OA',
    badgeClass: 'badge-primary',
    description: 'Kết nối Zalo OA để tự động nhận tin nhắn khách hàng và đồng bộ danh bạ tư vấn viên.',
    actionLabel: 'Kết nối Zalo OA',
    modalDescription: 'Kết nối Zalo OA để nhận tin nhắn khách hàng',
  },
  {
    key: 'TIKTOK' as const,
    name: 'TikTok',
    badge: 'TikTok API',
    badgeClass: 'badge-secondary',
    description: 'Kết nối TikTok business messaging để tư vấn khách hàng tiềm năng từ các chiến dịch video.',
    actionLabel: 'Kết nối TikTok',
    modalDescription: 'Kết nối TikTok business messaging để tiếp nhận tin nhắn',
  },
] as const;

/**
 * Kiểm tra trạng thái Webhook thực tế, minh bạch và chính xác theo dữ liệu hệ thống
 */
export const getTransparentWebhookStatus = (ch: {
  isWebhookSubscribed?: boolean;
  webhookStatus?: 'Healthy' | 'Degraded' | 'Down';
}) => {
  if (ch.isWebhookSubscribed === true) {
    if (ch.webhookStatus === 'Degraded') {
      return {
        label: 'Đã kết nối Webhook - Phản hồi chậm',
        className: 'text-amber-600 font-semibold',
      };
    }
    if (ch.webhookStatus === 'Down') {
      return {
        label: 'Đã kết nối Webhook - Mất tín hiệu',
        className: 'text-rose-600 font-semibold',
      };
    }
    return {
      label: 'Đã kết nối Webhook - Hoạt động ổn định',
      className: 'text-emerald-600 font-semibold',
    };
  }

  if (ch.isWebhookSubscribed === false) {
    return {
      label: 'Chưa kích hoạt Webhook (Cần kết nối lại)',
      className: 'text-rose-600 font-semibold',
    };
  }

  if (ch.webhookStatus) {
    switch (ch.webhookStatus) {
      case 'Healthy':
        return {
          label: 'Hoạt động ổn định',
          className: 'text-emerald-600 font-semibold',
        };
      case 'Degraded':
        return {
          label: 'Suy giảm hiệu năng kết nối',
          className: 'text-amber-600 font-semibold',
        };
      case 'Down':
        return {
          label: 'Mất tín hiệu kết nối Webhook',
          className: 'text-rose-600 font-semibold',
        };
    }
  }

  return {
    label: 'Chưa thiết lập Webhook',
    className: 'text-slate-500 font-medium',
  };
};
