import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Sse,
  MessageEvent,
} from '@nestjs/common';
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
    const conversationId = body.conversationId || 'conv-1';
    const senderName = body.senderName || (channel === 'ZALO' ? 'Trần Mai Hoa (Zalo)' : 'Đặng Quốc Huy (Messenger)');
    const content =
      body.content ||
      (channel === 'ZALO'
        ? 'Dạ em chào thầy cô! Cho em hỏi lịch khai giảng khóa Thiết kế Đồ họa CUSC tháng này với ạ!'
        : 'Chào page, mình muốn tư vấn học phí và lộ trình đào tạo Lập trình Web Fullstack.');

    const newMsg = {
      id: `msg-${Date.now()}`,
      conversationId,
      channel,
      direction: 'INBOUND' as const,
      content,
      senderName,
      senderAvatar: body.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      customerPhone: body.customerPhone || '0912.445.678',
      customerEmail: body.customerEmail || 'duochuy.dang@gmail.com',
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
