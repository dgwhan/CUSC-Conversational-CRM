import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'node:events';
import { WebSocket } from 'ws';
import { RealtimeService } from '../../src/modules/realtime/realtime.service.js';
import { RealtimeController } from '../../src/modules/realtime/realtime.controller.js';

class MockWebSocketClient extends EventEmitter {
    readyState: number = WebSocket.OPEN;
    sentMessages: string[] = [];

    send(msg: string): void {
        this.sentMessages.push(msg);
    }

    close(): void {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
    }

    simulateMessage(payload: unknown): void {
        this.emit('message', Buffer.from(JSON.stringify(payload)));
    }

    getLastMessage(): any {
        if (this.sentMessages.length === 0) return null;
        return JSON.parse(this.sentMessages[this.sentMessages.length - 1]!);
    }

    findMessageByType(type: string): any {
        for (let i = this.sentMessages.length - 1; i >= 0; i--) {
            const parsed = JSON.parse(this.sentMessages[i]!);
            if (parsed.type === type) return parsed;
        }
        return null;
    }
}

describe('Realtime WebSocket & Bộ Kiểm Thử Socket Hoạt Động', () => {
    let service: RealtimeService;
    let controller: RealtimeController;

    beforeEach(() => {
        service = new RealtimeService();
        controller = new RealtimeController(service);
    });

    afterEach(() => {
        service.onModuleDestroy();
    });

    it('bộ kiểm thử xác nhận socket sẵn sàng và theo dõi số lượng kết nối chính xác', () => {
        const initialHealth = service.getSocketHealth();
        expect(initialHealth.activeConnections).toBe(0);
        expect(initialHealth.supportedTransports).toContain('websocket');
        expect(initialHealth.supportedTransports).toContain('sse');

        const controllerStatus = controller.getSocketStatus();
        expect(controllerStatus.status).toBe('ok');
        expect(controllerStatus.data.activeConnections).toBe(0);
    });

    it('client kết nối thành công và nhận được gói tin handshake ban đầu qua socket', () => {
        const client = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client);

        const mockClient = client as unknown as MockWebSocketClient;
        expect(mockClient.sentMessages.length).toBeGreaterThanOrEqual(1);

        const handshake = mockClient.findMessageByType('connection:established');
        expect(handshake).not.toBeNull();
        expect(handshake.data.status).toBe('connected');
        expect(handshake.data.transport).toBe('websocket');
        expect(handshake.data.activeClients).toBe(1);

        // Kiểm tra qua Controller
        const statusAfter = controller.getSocketStatus();
        expect(statusAfter.data.activeConnections).toBe(1);
    });

    it('kiểm thử Ping - Pong xác nhận socket còn phản hồi (RTT check)', () => {
        const client = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client);

        const mockClient = client as unknown as MockWebSocketClient;

        // Gửi Ping từ client lên server
        mockClient.simulateMessage({ type: 'ping' });

        const pong = mockClient.findMessageByType('pong');
        expect(pong).not.toBeNull();
        expect(pong.type).toBe('pong');
        expect(pong.data.server).toBe('PolarisX-CRM-WS');
    });

    it('nhận tin nhắn ngay khi khách vừa gửi từ Facebook mà không cần gửi request lại', () => {
        const client = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client);

        const mockClient = client as unknown as MockWebSocketClient;

        // Giả lập Webhook Facebook vừa nhận tin nhắn từ khách hàng
        service.broadcastNewMessage({
            id: 'fb-msg-live-001',
            conversationId: 'conv-facebook-123',
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            content: 'Chào trung tâm, cho em xin bảng giá học phí ngành Lập trình phần mềm với ạ!',
            senderName: 'Khách hàng (FACEBOOK)',
            sentAt: '15:30:00',
        });

        const received = mockClient.findMessageByType('message:received');
        expect(received).not.toBeNull();
        expect(received.data.id).toBe('fb-msg-live-001');
        expect(received.data.channel).toBe('FACEBOOK');
        expect(received.data.direction).toBe('INBOUND');
        expect(received.data.content).toBe('Chào trung tâm, cho em xin bảng giá học phí ngành Lập trình phần mềm với ạ!');
    });

    it('nhận tin echo gửi đi của Page qua Socket tức thì khi Page admin trả lời', () => {
        const client = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client);

        const mockClient = client as unknown as MockWebSocketClient;

        // Webhook Facebook nhận được tin nhắn echo khi nhân viên Page gửi tin đi
        service.broadcastNewMessage({
            id: 'fb-msg-echo-002',
            conversationId: 'conv-facebook-123',
            channel: 'FACEBOOK',
            direction: 'OUTBOUND',
            content: 'Dạ chào bạn! Học phí khóa Lập trình phần mềm CUSC-Aptech là...',
            senderName: 'Trang (Page Meta)',
            sentAt: '15:31:00',
        });

        const echo = mockClient.findMessageByType('message:received');
        expect(echo).not.toBeNull();
        expect(echo.data.direction).toBe('OUTBOUND');
        expect(echo.data.senderName).toBe('Trang (Page Meta)');
        expect(echo.data.content).toContain('Học phí khóa Lập trình phần mềm');
    });

    it('bộ kiểm thử test-ping qua API phát tới tất cả client socket đang hoạt động', () => {
        const client1 = new MockWebSocketClient() as unknown as WebSocket;
        const client2 = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client1);
        service.handleSocketConnection(client2);

        const mock1 = client1 as unknown as MockWebSocketClient;
        const mock2 = client2 as unknown as MockWebSocketClient;

        const testPingResult = controller.sendSocketTestPing({ message: 'Kiểm tra tín hiệu socket' });
        expect(testPingResult.status).toBe('ok');
        expect(testPingResult.data.deliveredCount).toBe(2);

        const received1 = mock1.findMessageByType('socket:test_ping');
        const received2 = mock2.findMessageByType('socket:test_ping');

        expect(received1).not.toBeNull();
        expect(received1.data.message).toBe('Kiểm tra tín hiệu socket');
        expect(received2).not.toBeNull();
        expect(received2.data.message).toBe('Kiểm tra tín hiệu socket');
    });

    it('tự động giảm số lượng kết nối hoạt động khi client ngắt kết nối', () => {
        const client = new MockWebSocketClient() as unknown as WebSocket;
        service.handleSocketConnection(client);

        expect(service.getSocketHealth().activeConnections).toBe(1);

        const mockClient = client as unknown as MockWebSocketClient;
        mockClient.close();

        expect(service.getSocketHealth().activeConnections).toBe(0);
    });

    it('phục vụ trang HTML kiểm thử trực quan socket', () => {
        const mockRes = { header: () => {} } as any;
        const html = controller.getTestClientHtml(mockRes);
        expect(typeof html).toBe('string');
        expect(html).toContain('WebSocket Diagnostic & Test Kit');
        expect(html).toContain('/api/realtime/ws');
    });
});
