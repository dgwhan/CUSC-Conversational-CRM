import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';

export type StaffPresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY';

export interface StaffPresenceItem {
  staffId: string;
  name: string;
  avatar: string;
  role: string;
  status: StaffPresenceStatus;
  updatedAt: string;
}

export interface RealtimeEventPayload<T = unknown> {
  type: 'message:received' | 'presence:updated' | 'pipeline:updated' | 'heartbeat';
  data: T;
  timestamp: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventSubject = new Subject<MessageEvent>();

  // Danh sách trạng thái nhân viên lưu trong bộ nhớ
  private readonly staffPresences = new Map<string, StaffPresenceItem>([
    [
      'staff-1',
      {
        staffId: 'staff-1',
        name: 'Nguyễn Văn Minh (Bạn)',
        avatar: 'MV',
        role: 'Tư vấn viên chính',
        status: 'ONLINE',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'staff-2',
      {
        staffId: 'staff-2',
        name: 'Lê Thị Thu Lan',
        avatar: 'TL',
        role: 'Tư vấn viên Aptech',
        status: 'AWAY',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'staff-3',
      {
        staffId: 'staff-3',
        name: 'Trần Hoàng Nam',
        avatar: 'HN',
        role: 'Quản lý tuyển sinh',
        status: 'BUSY',
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  /**
   * Trả về Observable SSE stream cho client kết nối
   * Bao gồm các sự kiện phát sinh và định kỳ gửi heartbeat (mỗi 25s) để giữ kết nối
   */
  getEventsObservable(): Observable<MessageEvent> {
    const heartbeat$ = interval(25000).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString(), server: 'CUSC-CRM-SSE' },
        }),
      ),
    );

    return merge(this.eventSubject.asObservable(), heartbeat$);
  }

  /**
   * Phát một sự kiện realtime đến tất cả các client đang lắng nghe SSE
   */
  emit<T>(type: RealtimeEventPayload<T>['type'], data: T): void {
    const payload: RealtimeEventPayload<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    // Event payload for SSE clients
    this.eventSubject.next({
      type,
      data: payload,
    });
  }

  /**
   * Đẩy tin nhắn mới nhận được từ Webhook xuống Frontend
   */
  broadcastNewMessage(messageData: {
    id: string;
    conversationId: string;
    channel: 'FACEBOOK' | 'ZALO' | 'TIKTOK' | 'MANUAL';
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    senderName: string;
    senderAvatar?: string;
    customerPhone?: string;
    customerEmail?: string;
    sentAt: string;
  }): void {
    this.emit('message:received', messageData);
  }

  /**
   * Cập nhật trạng thái trực tuyến của nhân viên (Online / Away / Busy)
   */
  updateStaffPresence(
    staffId: string,
    status: StaffPresenceStatus,
    extraInfo?: { name?: string; avatar?: string; role?: string },
  ): StaffPresenceItem {
    const existing = this.staffPresences.get(staffId) || {
      staffId,
      name: extraInfo?.name || `Nhân viên #${staffId}`,
      avatar: extraInfo?.avatar || 'NV',
      role: extraInfo?.role || 'Tư vấn viên',
      status: 'ONLINE' as StaffPresenceStatus,
      updatedAt: new Date().toISOString(),
    };

    const updated: StaffPresenceItem = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      name: extraInfo?.name || existing.name,
      avatar: extraInfo?.avatar || existing.avatar,
    };

    this.staffPresences.set(staffId, updated);
    this.emit('presence:updated', updated);

    return updated;
  }

  /**
   * Lấy danh sách trạng thái của tất cả nhân viên
   */
  getAllStaffPresences(): StaffPresenceItem[] {
    return Array.from(this.staffPresences.values());
  }

  /**
   * Đồng bộ thay đổi giai đoạn phễu chăm sóc tuyển sinh
   */
  broadcastPipelineChange(payload: {
    customerId: string;
    customerName: string;
    newStage: string;
    previousStage: string;
    updatedBy: string;
  }): void {
    this.emit('pipeline:updated', payload);
  }
}
