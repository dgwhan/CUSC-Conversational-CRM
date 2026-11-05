export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipToast?: boolean;
  _retry?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly method: string;
  readonly data?: unknown;
  readonly timestamp: Date;

  constructor(
    message: string,
    status: number,
    endpoint: string,
    method: string = 'GET',
    data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.method = method;
    this.data = data;
    this.timestamp = new Date();
  }
}

export type NotificationType =
  | 'CHANNEL_EXPIRING'
  | 'CHANNEL_EXPIRED'
  | 'NEW_LEAD'
  | 'SYSTEM_WARNING'
  | 'CONVERSATION_ALERT';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

export interface NotificationItem {
  id: string;
  workspaceId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  content: string;
  actionUrl?: string | null;
  isRead: boolean;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

