import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { RealtimeService, StaffPresenceStatus } from './realtime.service.js';

class UpdatePresenceDto {
  staffId!: string;
  status!: StaffPresenceStatus;
  name?: string;
  avatar?: string;
  role?: string;
}

class SimulateInboundDto {
  channel?: 'FACEBOOK' | 'ZALO' | 'TIKTOK' | 'MANUAL';
  conversationId?: string;
  senderName?: string;
  senderAvatar?: string;
  content?: string;
  customerPhone?: string;
  customerEmail?: string;
}

class PipelineChangeDto {
  customerId!: string;
  customerName!: string;
  newStage!: string;
  previousStage!: string;
  updatedBy?: string;
}

class SocketTestPingDto {
  message?: string;
}

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Kết nối Server-Sent Events (SSE) để đẩy tin nhắn và trạng thái thời gian thực
   * URL: GET /api/realtime/stream
   */
  @Sse('stream')
  streamEvents(): Observable<MessageEvent> {
    return this.realtimeService.getEventsObservable();
  }

  /**
   * Kiểm tra tình trạng hoạt động và số lượng client kết nối Socket (Bộ kiểm thử Socket Health)
   * URL: GET /api/realtime/socket/status
   */
  @Get('socket/status')
  getSocketStatus() {
    return {
      status: 'ok',
      data: this.realtimeService.getSocketHealth(),
    };
  }

  /**
   * Gửi gói tin Ping kiểm thử đến tất cả các client Socket để xác nhận socket còn hoạt động
   * URL: POST /api/realtime/socket/test-ping
   */
  @Post('socket/test-ping')
  @HttpCode(HttpStatus.OK)
  sendSocketTestPing(@Body() body?: SocketTestPingDto) {
    const result = this.realtimeService.testBroadcastPing(body?.message);
    return {
      status: 'ok',
      message: 'Đã phát tín hiệu Ping kiểm tra socket',
      data: result,
    };
  }

  /**
   * Trang giao diện kiểm thử trực quan Socket dành cho lập trình viên và kiểm thử viên
   * URL: GET /api/realtime/socket/test-client
   */
  @Get('socket/test-client')
  getTestClientHtml(@Res({ passthrough: true }) res: FastifyReply) {
    if (res && typeof res.header === 'function') {
      res.header('content-type', 'text/html; charset=utf-8');
    }

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>CUSC CRM - Bộ Kiểm Thử Hoạt Động WebSocket</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
    h1 { font-size: 20px; margin-top: 0; color: #38bdf8; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 13px; font-weight: bold; }
    .connected { background: #15803d; color: #dcfce7; }
    .disconnected { background: #b91c1c; color: #fee2e2; }
    .connecting { background: #ca8a04; color: #fef08a; }
    button { background: #0284c7; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-right: 8px; }
    button:hover { background: #0369a1; }
    #logs { background: #090d16; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; height: 350px; overflow-y: auto; border: 1px solid #1e293b; }
    .log-item { margin-bottom: 6px; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #38bdf8; background: rgba(56, 189, 248, 0.05); }
    .inbound { border-left-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
    .outbound { border-left-color: #a855f7; background: rgba(168, 85, 247, 0.05); }
  </style>
</head>
<body>
  <h1>⚡ CUSC Recruitment CRM - WebSocket Diagnostic & Test Kit</h1>
  <div class="card">
    <p>Trạng thái kết nối Socket: <span id="statusBadge" class="badge connecting">ĐANG KẾT NỐI...</span></p>
    <p>Độ trễ Ping/Pong: <strong id="latencyText">-- ms</strong> | Số sự kiện nhận được: <strong id="eventCount">0</strong></p>
    <div>
      <button onclick="sendPing()">Gửi Ping qua Socket</button>
      <button onclick="clearLogs()" style="background: #475569;">Xóa Nhật Ký</button>
    </div>
  </div>

  <div class="card">
    <h3>Nhật Ký Tin Nhắn Realtime (Tự động nhận khi Facebook Webhook gửi đến):</h3>
    <div id="logs"></div>
  </div>

  <script>
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/api/realtime/ws';
    let ws = null;
    let eventCount = 0;
    let pingSentTime = 0;

    const statusBadge = document.getElementById('statusBadge');
    const logsDiv = document.getElementById('logs');
    const latencyText = document.getElementById('latencyText');
    const eventCountText = document.getElementById('eventCount');

    function log(message, type = '') {
      const el = document.createElement('div');
      el.className = 'log-item ' + type;
      el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      logsDiv.prepend(el);
    }

    function connect() {
      statusBadge.className = 'badge connecting';
      statusBadge.textContent = 'ĐANG KẾT NỐI...';
      log('Đang kết nối đến WebSocket: ' + wsUrl);

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        statusBadge.className = 'badge connected';
        statusBadge.textContent = 'ĐÃ KẾT NỐI (ACTIVE)';
        log('Kết nối WebSocket thành công! Sẵn sàng nhận tin nhắn realtime.', 'inbound');
      };

      ws.onmessage = (event) => {
        eventCount++;
        eventCountText.textContent = eventCount;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'pong') {
            const rtt = Date.now() - pingSentTime;
            latencyText.textContent = rtt + ' ms';
            log('Nhận Pong từ Server CRM! RTT: ' + rtt + 'ms', 'outbound');
          } else if (payload.type === 'message:received') {
            const data = payload.data;
            const dir = data.direction === 'OUTBOUND' ? '[Page Echo]' : '[Khách đến]';
            const logType = data.direction === 'OUTBOUND' ? 'outbound' : 'inbound';
            log(dir + ' [' + data.channel + '] ' + data.senderName + ': "' + data.content + '" (ID: ' + data.id + ')', logType);
          } else {
            log('Sự kiện ' + payload.type + ': ' + JSON.stringify(payload.data));
          }
        } catch (e) {
          log('Nhận raw: ' + event.data);
        }
      };

      ws.onclose = () => {
        statusBadge.className = 'badge disconnected';
        statusBadge.textContent = 'NGẮT KẾT NỐI (OFFLINE)';
        log('Kết nối WebSocket đã bị ngắt. Đang thử lại sau 3s...');
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        log('Lỗi WebSocket: ' + JSON.stringify(err));
      };
    }

    function sendPing() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        pingSentTime = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
        log('Đã gửi Ping đến server...', 'outbound');
      } else {
        alert('Socket chưa kết nối!');
      }
    }

    function clearLogs() {
      logsDiv.innerHTML = '';
    }

    connect();
  </script>
</body>
</html>`;
  }

  /**
   * Lấy danh sách trạng thái trực tuyến của toàn bộ nhân viên
   * URL: GET /api/realtime/presence
   */
  @Get('presence')
  getPresences() {
    return {
      status: 'ok',
      data: this.realtimeService.getAllStaffPresences(),
    };
  }

  /**
   * Cập nhật trạng thái trực tuyến của nhân viên (Online / Away / Busy)
   * URL: POST /api/realtime/presence
   */
  @Post('presence')
  @HttpCode(HttpStatus.OK)
  updatePresence(@Body() body: UpdatePresenceDto) {
    const updated = this.realtimeService.updateStaffPresence(
      body.staffId,
      body.status,
      {
        name: body.name,
        avatar: body.avatar,
        role: body.role,
      },
    );

    return {
      status: 'ok',
      data: updated,
    };
  }

  /**
   * Giả lập gửi tin nhắn Inbound (dành cho kiểm thử realtime khi chưa cấu hình webhook live)
   * URL: POST /api/realtime/simulate-inbound
   */
  @Post('simulate-inbound')
  @HttpCode(HttpStatus.OK)
  simulateInboundMessage(@Body() body: SimulateInboundDto) {
    const channel = body.channel || 'FACEBOOK';
    const conversationId = body.conversationId || `conv-sim-${Date.now()}`;
    const senderName = body.senderName || `Khách hàng (${channel})`;
    const content = body.content || 'Tin nhắn thử nghiệm từ khách hàng';

    const newMsg = {
      id: `msg-${Date.now()}`,
      conversationId,
      channel,
      direction: 'INBOUND' as const,
      content,
      senderName,
      senderAvatar: body.senderAvatar || '',
      customerPhone: body.customerPhone || '',
      customerEmail: body.customerEmail || '',
      sentAt: 'Vừa xong',
    };

    this.realtimeService.broadcastNewMessage(newMsg);

    return {
      status: 'ok',
      message: 'Đã phát sự kiện tin nhắn realtime thành công',
      data: newMsg,
    };
  }

  /**
   * Phát sự kiện cập nhật giai đoạn phễu tuyển sinh (Kanban)
   * URL: POST /api/realtime/pipeline-change
   */
  @Post('pipeline-change')
  @HttpCode(HttpStatus.OK)
  broadcastPipelineChange(@Body() body: PipelineChangeDto) {
    this.realtimeService.broadcastPipelineChange({
      customerId: body.customerId,
      customerName: body.customerName,
      newStage: body.newStage,
      previousStage: body.previousStage,
      updatedBy: body.updatedBy || 'Tư vấn viên',
    });

    return {
      status: 'ok',
      message: 'Đã phát sự kiện cập nhật phễu tuyển sinh thành công',
    };
  }
}
