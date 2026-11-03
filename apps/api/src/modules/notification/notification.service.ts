import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { CreateNotificationDto, NotificationFilterDto } from './dto/notification.dto.js';
import { Notification } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeWorkspaceId = (workspaceId?: string): string | undefined =>
  workspaceId && UUID_REGEX.test(workspaceId) ? workspaceId : undefined;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Tạo thông báo mới và phát sự kiện realtime đến các client trong Workspace
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const safeWorkspaceId = normalizeWorkspaceId(dto.workspaceId);
    if (!safeWorkspaceId) {
      throw new BadRequestException('workspaceId must be a valid UUID');
    }

    const notification = await this.prisma.notification.create({
      data: {
        workspaceId: safeWorkspaceId,
        type: dto.type,
        severity: dto.severity,
        title: dto.title,
        content: dto.content,
        actionUrl: dto.actionUrl || null,
        metadata: dto.metadata || {},
      },
    });

    this.logger.log(
      `[Notification] Đã tạo thông báo mới [${notification.severity}] "${notification.title}" cho workspace: ${dto.workspaceId}`,
    );

    // Phát sự kiện realtime đến các client đang mở giao diện
    try {
      this.realtime.broadcastNotification({
        workspaceId: dto.workspaceId,
        notification,
      });
    } catch (err) {
      this.logger.warn(`Không thể phát broadcast thông báo: ${(err as Error).message}`);
    }

    return notification;
  }

  /**
   * Lấy danh sách thông báo có phân trang và lọc
   */
  async findAll(
    workspaceId: string,
    filter: NotificationFilterDto = {},
  ): Promise<{
    items: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const safeWorkspaceId = normalizeWorkspaceId(workspaceId);
    if (!safeWorkspaceId) {
      return {
        items: [],
        total: 0,
        unreadCount: 0,
        page: Math.max(1, Number(filter.page) || 1),
        limit: Math.min(100, Math.max(1, Number(filter.limit) || 20)),
        totalPages: 0,
      };
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId: safeWorkspaceId };
    if (typeof filter.isRead === 'boolean') {
      where.isRead = filter.isRead;
    }
    if (filter.type) {
      where.type = filter.type;
    }
    if (filter.severity) {
      where.severity = filter.severity;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { workspaceId: safeWorkspaceId, isRead: false },
      }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Lấy số lượng thông báo chưa đọc của workspace
   */
  async getUnreadCount(workspaceId: string): Promise<number> {
    const safeWorkspaceId = normalizeWorkspaceId(workspaceId);
    if (!safeWorkspaceId) {
      return 0;
    }

    return this.prisma.notification.count({
      where: { workspaceId: safeWorkspaceId, isRead: false },
    });
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   */
  async markAsRead(workspaceId: string, id: string): Promise<Notification> {
    const safeWorkspaceId = normalizeWorkspaceId(workspaceId);
    if (!safeWorkspaceId) {
      throw new NotFoundException('Invalid workspaceId');
    }

    const notification = await this.prisma.notification.findFirst({
      where: { id, workspaceId: safeWorkspaceId },
    });

    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo ${id}`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Đánh dấu tất cả thông báo của workspace là đã đọc
   */
  async markAllAsRead(workspaceId: string): Promise<{ count: number }> {
    const safeWorkspaceId = normalizeWorkspaceId(workspaceId);
    if (!safeWorkspaceId) {
      return { count: 0 };
    }

    const result = await this.prisma.notification.updateMany({
      where: { workspaceId: safeWorkspaceId, isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  /**
   * Xóa một thông báo
   */
  async delete(workspaceId: string, id: string): Promise<{ success: boolean }> {
    const safeWorkspaceId = normalizeWorkspaceId(workspaceId);
    if (!safeWorkspaceId) {
      throw new NotFoundException('Invalid workspaceId');
    }

    const notification = await this.prisma.notification.findFirst({
      where: { id, workspaceId: safeWorkspaceId },
    });

    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo ${id}`);
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }
}
