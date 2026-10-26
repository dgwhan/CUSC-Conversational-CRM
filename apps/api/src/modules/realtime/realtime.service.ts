import { Injectable, Logger, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';
import { WebSocketServer, WebSocket } from 'ws';

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
  type: 'message:received' | 'presence:updated' | 'pipeline:updated' | 'heartbeat' | 'socket:test_ping' | 'connection:established';
  data: T;
  timestamp: string;
}

export interface SocketHealthInfo {
  status: 'healthy' | 'ready_to_attach';
  activeConnections: number;
  totalBroadcastedEvents: number;
  uptimeSeconds: number;
  lastActivityAt: string;
  supportedTransports: string[];
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventSubject = new Subject<MessageEvent>();

  // WebSocket Server quản lý các kết nối trực tiếp
  private wss: WebSocketServer | null = null;
  private readonly socketClients = new Set<WebSocket>();
  private readonly startTime = Date.now();
  private lastActivityAt = new Date().toISOString();
  private totalBroadcastedEvents = 0;

  // Danh sách trạng thái nhân viên lưu trong bộ nhớ (được cập nhật động theo các phiên làm việc thực tế)
  private readonly staffPresences = new Map<string, StaffPresenceItem>();

  /**
   * Khởi tạo và gắn WebSocketServer vào HTTP Server của Fastify / Node.js
   * Endpoint mặc định: /api/realtime/ws
   */
  attachHttpServer(server: any, path: string = '/api/realtime/ws'): WebSocketServer {
    if (this.wss) {
      return this.wss;
    }

    try {
      this.wss = new WebSocketServer({ server, path });

      this.wss.on('connection', (ws: WebSocket) => {
        this.handleSocketConnection(ws);
      });

      this.logger.log(`WebSocket server initialized on path ${path}`);
      return this.wss;
    } catch (err) {
      this.logger.error('Failed to attach WebSocketServer', err);
      throw err;
    }
  }

  /**
   * Xử lý một kết nối WebSocket từ client (phục vụ cả môi trường live lẫn unit test)
   */
  handleSocketConnection(ws: WebSocket): void {
    this.socketClients.add(ws);
    this.lastActivityAt = new Date().toISOString();
    this.logger.log(`[WebSocket] Client connected. Active clients: ${this.socketClients.size}`);

    // Gửi gói tin handshake ban đầu
    try {
      ws.send(
        JSON.stringify({
          type: 'connection:established',
          data: {
            status: 'connected',
            serverTime: new Date().toISOString(),
            activeClients: this.socketClients.size,
            transport: 'websocket',
          },
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (e) {
      this.logger.error('Failed to send handshake to client', e);
    }

    // Nhận gói tin từ client (Ping / Test / Event)
    ws.on('message', (messageBuffer: Buffer | string) => {
      try {
        this.lastActivityAt = new Date().toISOString();
        const messageStr = messageBuffer.toString();
        const parsed = JSON.parse(messageStr);

        if (parsed.type === 'ping') {
          ws.send(
            JSON.stringify({
              type: 'pong',
              data: {
                timestamp: new Date().toISOString(),
                server: 'PolarisX-CRM-WS',
              },
              timestamp: new Date().toISOString(),
            }),
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to process incoming WebSocket message: ${err}`);
      }
    });

    ws.on('close', () => {
      this.socketClients.delete(ws);
      this.logger.log(`[WebSocket] Client disconnected. Active clients: ${this.socketClients.size}`);
    });

    ws.on('error', (err) => {
      this.logger.warn(`[WebSocket] Client error: ${err.message}`);
      this.socketClients.delete(ws);
    });
  }

  /**
   * Đẩy dữ liệu đồng thời tới tất cả client WebSocket đang kết nối
   */
  broadcastToSockets(payload: RealtimeEventPayload<unknown>): number {
    let sentCount = 0;
    const messageString = JSON.stringify(payload);

    for (const client of this.socketClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
          sentCount++;
        } catch (err) {
          this.logger.error('Failed to dispatch message to socket client', err);
        }
      }
    }

    return sentCount;
  }

  /**
   * Trả về Observable SSE stream cho client kết nối qua SSE
   * Bao gồm các sự kiện phát sinh và định kỳ gửi heartbeat (mỗi 25s) để giữ kết nối
   */
  getEventsObservable(): Observable<MessageEvent> {
    const heartbeat$ = interval(25000).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString(), server: 'PolarisX-CRM-SSE' },
        }),
      ),
    );

    return merge(this.eventSubject.asObservable(), heartbeat$);
  }

  /**
   * Phát một sự kiện realtime đến cả WebSocket clients và SSE clients
   */
  emit<T>(type: RealtimeEventPayload<T>['type'], data: T): void {
    const payload: RealtimeEventPayload<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.lastActivityAt = payload.timestamp;
    this.totalBroadcastedEvents++;

    // 1. Gửi qua WebSocket cho các client kết nối Socket
    this.broadcastToSockets(payload);

    // 2. Gửi qua Server-Sent Events (SSE) cho client kết nối SSE
    this.eventSubject.next({
      type,
      data: payload,
    });
  }

  /**
   * Đẩy tin nhắn mới nhận được từ Webhook Facebook / Zalo xuống Frontend qua Socket
   * Ngay khi khách vừa gửi, client nhận được tức thì mà không cần polling hay gửi request lại.
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
   * Lấy thông tin sức khỏe và trạng thái hoạt động của Socket
   */
  getSocketHealth(): SocketHealthInfo {
    return {
      status: this.wss || this.socketClients.size > 0 ? 'healthy' : 'ready_to_attach',
      activeConnections: this.socketClients.size,
      totalBroadcastedEvents: this.totalBroadcastedEvents,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      lastActivityAt: this.lastActivityAt,
      supportedTransports: ['websocket', 'sse'],
    };
  }

  /**
   * Gửi gói tin Ping kiểm thử đến tất cả client Socket đang kết nối
   */
  testBroadcastPing(customMessage?: string): {
    status: string;
    deliveredCount: number;
    sentAt: string;
    message: string;
  } {
    const sentAt = new Date().toISOString();
    const message = customMessage || 'PolarisX-CRM Socket Diagnostic Heartbeat Test';

    const payload: RealtimeEventPayload<{ message: string; timestamp: string }> = {
      type: 'socket:test_ping',
      data: { message, timestamp: sentAt },
      timestamp: sentAt,
    };

    const count = this.broadcastToSockets(payload);
    this.lastActivityAt = sentAt;

    return {
      status: 'ok',
      deliveredCount: count,
      sentAt,
      message,
    };
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

  /**
   * Dọn dẹp tài nguyên khi module bị hủy
   */
  onModuleDestroy(): void {
    for (const client of this.socketClients) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    this.socketClients.clear();

    if (this.wss) {
      try {
        this.wss.close();
      } catch {
        // ignore
      }
      this.wss = null;
    }
  }
}
