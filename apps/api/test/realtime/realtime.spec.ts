import { describe, expect, it } from 'vitest';
import { RealtimeService } from '../../src/modules/realtime/realtime.service.js';
import { RealtimeController } from '../../src/modules/realtime/realtime.controller.js';
import { firstValueFrom, take } from 'rxjs';

describe('RealtimeService & SSE Engine', () => {
  it('should initialize with dynamic staff presences and register staff dynamically', () => {
    const service = new RealtimeService();
    // Không gán cứng danh sách nhân viên ban đầu
    expect(service.getAllStaffPresences()).toHaveLength(0);

    // Đăng ký nhân viên động khi kết nối
    service.updateStaffPresence('staff-1', 'ONLINE', {
      name: 'Tư vấn viên chính',
      role: 'Tư vấn viên',
    });

    const presences = service.getAllStaffPresences();
    expect(presences).toHaveLength(1);
    expect(presences[0]?.staffId).toBe('staff-1');
    expect(presences[0]?.status).toBe('ONLINE');
  });

  it('should update staff presence and emit presence:updated event', async () => {
    const service = new RealtimeService();
    const eventPromise = firstValueFrom(service.getEventsObservable().pipe(take(1)));

    service.updateStaffPresence('staff-1', 'BUSY');

    const event = await eventPromise;
    expect(event.type).toBe('presence:updated');
    expect((event.data as any).data.staffId).toBe('staff-1');
    expect((event.data as any).data.status).toBe('BUSY');

    const updated = service.getAllStaffPresences().find((p) => p.staffId === 'staff-1');
    expect(updated?.status).toBe('BUSY');
  });

  it('should broadcast new message received event', async () => {
    const service = new RealtimeService();
    const eventPromise = firstValueFrom(service.getEventsObservable().pipe(take(1)));

    service.broadcastNewMessage({
      id: 'msg-realtime-1',
      conversationId: 'conv-realtime-1',
      channel: 'FACEBOOK',
      direction: 'INBOUND',
      content: 'Tư vấn Fullstack React',
      senderName: 'Nguyễn Văn An',
      sentAt: 'Vừa xong',
    });

    const event = await eventPromise;
    expect(event.type).toBe('message:received');
    expect((event.data as any).data.content).toBe('Tư vấn Fullstack React');
    expect((event.data as any).data.senderName).toBe('Nguyễn Văn An');
  });

  it('controller should return presences and accept simulations', () => {
    const service = new RealtimeService();
    const controller = new RealtimeController(service);

    const presencesResult = controller.getPresences();
    expect(presencesResult.status).toBe('ok');
    expect(Array.isArray(presencesResult.data)).toBe(true);

    const simResult = controller.simulateInboundMessage({
      channel: 'ZALO',
      content: 'Chào trung tâm!',
    });
    expect(simResult.status).toBe('ok');
    expect(simResult.data.channel).toBe('ZALO');
    expect(simResult.data.content).toBe('Chào trung tâm!');
  });
});
