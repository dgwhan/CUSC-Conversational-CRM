import { NotificationType, NotificationSeverity } from '@prisma/client';

export interface CreateNotificationDto {
  workspaceId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  content: string;
  actionUrl?: string | null;
  metadata?: Record<string, any> | null;
}

export interface NotificationFilterDto {
  isRead?: boolean;
  type?: NotificationType;
  severity?: NotificationSeverity;
  page?: number;
  limit?: number;
}
