import { describe, expect, it, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { FacebookAdapter } from '../../src/modules/messaging/infrastructure/adapters/facebook.adapter.js';
import { MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import { InvalidWebhookPayloadError, RawWebhookRequest } from '../../src/modules/messaging/domain/channel-adapter.port.js';

describe('FacebookAdapter', () => {
    let adapter: FacebookAdapter;
    const testSecret = 'facebook-app-secret-test-32chars';
    const testVerifyToken = 'facebook-verify-token-secret-123';

    beforeEach(() => {
        adapter = new FacebookAdapter();
        adapter.setAppSecret(testSecret);
        adapter.setVerifyToken(testVerifyToken);
    });

    describe('Xác thực Webhook GET (Verify Token & Challenge)', () => {
        it('trả về hub.challenge khi hub.mode=subscribe và đúng verify token', () => {
            const query = {
                'hub.mode': 'subscribe',
                'hub.verify_token': testVerifyToken,
                'hub.challenge': '1158201444',
            };

            const result = adapter.verifySubscription(query);
            expect(result).toBe('1158201444');
        });

        it('hỗ trợ cấu trúc query lồng nhau query.hub.verify_token', () => {
            const query = {
                hub: {
                    mode: 'subscribe',
                    verify_token: testVerifyToken,
                    challenge: '987654321',
                },
            };

            const result = adapter.verifySubscription(query);
            expect(result).toBe('987654321');
        });

        it('trả về null khi sai verify token', () => {
            const query = {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'wrong-token-abc',
                'hub.challenge': '1158201444',
            };

            const result = adapter.verifySubscription(query);
            expect(result).toBeNull();
        });

        it('trả về null khi sai hub.mode', () => {
            const query = {
                'hub.mode': 'unsubscribe',
                'hub.verify_token': testVerifyToken,
                'hub.challenge': '1158201444',
            };

            const result = adapter.verifySubscription(query);
            expect(result).toBeNull();
        });

        it('trả về null khi thiếu verify token', () => {
            const query = {
                'hub.mode': 'subscribe',
                'hub.challenge': '1158201444',
            };

            const result = adapter.verifySubscription(query);
            expect(result).toBeNull();
        });
    });

    describe('Xác thực chữ ký X-Hub-Signature-256 (HMAC SHA-256 trên raw body)', () => {
        function buildSignedRequest(bodyObj: unknown, secret: string = testSecret, headerKey = 'x-hub-signature-256'): RawWebhookRequest {
            const rawBody = Buffer.from(JSON.stringify(bodyObj), 'utf-8');
            const signature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

            return {
                rawBody,
                headers: {
                    [headerKey]: signature,
                },
            };
        }

        it('xác thực thành công (true) khi chữ ký HMAC SHA-256 chuẩn xác', () => {
            const req = buildSignedRequest({ object: 'page', entry: [] });
            expect(adapter.verifyRequest(req)).toBe(true);
        });

        it('chấp nhận header không phân biệt hoa thường (X-Hub-Signature-256)', () => {
            const req = buildSignedRequest({ object: 'page', entry: [] }, testSecret, 'X-Hub-Signature-256');
            expect(adapter.verifyRequest(req)).toBe(true);
        });

        it('từ chối (false) khi chữ ký sai (sai secret hoặc bị giả mạo)', () => {
            const req = buildSignedRequest({ object: 'page', entry: [] }, 'wrong-secret');
            expect(adapter.verifyRequest(req)).toBe(false);
        });

        it('từ chối (false) khi raw body bị can thiệp (tampered body)', () => {
            const req = buildSignedRequest({ object: 'page', entry: [] });
            const tamperedReq: RawWebhookRequest = {
                headers: req.headers,
                rawBody: Buffer.from(JSON.stringify({ object: 'page', entry: [{ hacked: true }] })),
            };

            expect(adapter.verifyRequest(tamperedReq)).toBe(false);
        });

        it('từ chối (false) khi thiếu header chữ ký trong môi trường có secret', () => {
            const req: RawWebhookRequest = {
                headers: {},
                rawBody: Buffer.from(JSON.stringify({ object: 'page' })),
            };

            expect(adapter.verifyRequest(req)).toBe(false);
        });

        it('từ chối (false) khi header chữ ký không có tiền tố sha256=', () => {
            const rawBody = Buffer.from('{}');
            const req: RawWebhookRequest = {
                headers: {
                    'x-hub-signature-256': 'md5=abcdef1234567890',
                },
                rawBody,
            };

            expect(adapter.verifyRequest(req)).toBe(false);
        });
    });

    describe('Xử lý Payload mẫu của Meta (Đọc cả tin đến và echo tin gửi đi của Page)', () => {
        it('parse đúng tin nhắn đến (INBOUND) từ khách hàng', () => {
            const metaPayload = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id_cusc_01',
                        time: 1719999000000,
                        messaging: [
                            {
                                sender: { id: 'cust_psid_001' },
                                recipient: { id: 'page_id_cusc_01' },
                                timestamp: 1719999000000,
                                message: {
                                    mid: 'mid.inbound.123',
                                    text: 'Chào trung tâm CUSC, mình muốn đăng ký khóa Lập trình Web Fullstack',
                                },
                            },
                        ],
                    },
                ],
            };

            const req: RawWebhookRequest = {
                headers: {},
                rawBody: Buffer.from(JSON.stringify(metaPayload)),
            };

            const events = adapter.parseEvents(req);
            expect(events).toHaveLength(1);

            const ev = events[0]!;
            expect(ev.channel).toBe('FACEBOOK');
            expect(ev.externalAccountId).toBe('page_id_cusc_01');
            expect(ev.externalMessageId).toBe('mid.inbound.123');
            expect(ev.senderExternalId).toBe('cust_psid_001');
            expect(ev.direction).toBe(MessageDirection.INBOUND);
            expect(ev.content).toBe('Chào trung tâm CUSC, mình muốn đăng ký khóa Lập trình Web Fullstack');
            expect(ev.sentAt).toEqual(new Date(1719999000000));
        });

        it('parse đúng tin echo gửi đi (OUTBOUND) từ Page khi message.is_echo = true', () => {
            const metaPayload = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id_cusc_01',
                        time: 1719999050000,
                        messaging: [
                            {
                                sender: { id: 'page_id_cusc_01' },
                                recipient: { id: 'cust_psid_001' },
                                timestamp: 1719999050000,
                                message: {
                                    is_echo: true,
                                    app_id: 12345678,
                                    mid: 'mid.echo.456',
                                    text: 'Dạ chào bạn! CUSC đã nhận được thông tin và tư vấn viên sẽ hỗ trợ bạn ngay ạ.',
                                },
                            },
                        ],
                    },
                ],
            };

            const req: RawWebhookRequest = {
                headers: {},
                rawBody: Buffer.from(JSON.stringify(metaPayload)),
            };

            const events = adapter.parseEvents(req);
            expect(events).toHaveLength(1);

            const ev = events[0]!;
            expect(ev.channel).toBe('FACEBOOK');
            expect(ev.externalAccountId).toBe('page_id_cusc_01');
            expect(ev.externalMessageId).toBe('mid.echo.456');
            expect(ev.senderExternalId).toBe('page_id_cusc_01');
            expect(ev.direction).toBe(MessageDirection.OUTBOUND);
            expect(ev.content).toBe('Dạ chào bạn! CUSC đã nhận được thông tin và tư vấn viên sẽ hỗ trợ bạn ngay ạ.');
            expect(ev.sentAt).toEqual(new Date(1719999050000));
        });

        it('xử lý tin nhắn có attachment (hình ảnh) khi không có text', () => {
            const metaPayload = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id_cusc_01',
                        messaging: [
                            {
                                sender: { id: 'cust_psid_002' },
                                recipient: { id: 'page_id_cusc_01' },
                                timestamp: 1719999100000,
                                message: {
                                    mid: 'mid.att.789',
                                    attachments: [
                                        {
                                            type: 'image',
                                            payload: { url: 'https://cdn.facebook.com/images/hoc-ba.jpg' },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            };

            const events = adapter.parseEvents({
                headers: {},
                rawBody: Buffer.from(JSON.stringify(metaPayload)),
            });

            expect(events).toHaveLength(1);
            expect(events[0]!.content).toContain('https://cdn.facebook.com/images/hoc-ba.jpg');
            expect(events[0]!.direction).toBe(MessageDirection.INBOUND);
        });

        it('bỏ qua sự kiện delivery và read receipts (không phải tin nhắn nội dung)', () => {
            const metaPayload = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id_cusc_01',
                        messaging: [
                            {
                                sender: { id: 'cust_psid_001' },
                                recipient: { id: 'page_id_cusc_01' },
                                delivery: { mids: ['mid.123'], watermark: 1719999000000 },
                            },
                            {
                                sender: { id: 'cust_psid_001' },
                                recipient: { id: 'page_id_cusc_01' },
                                read: { watermark: 1719999000000 },
                            },
                        ],
                    },
                ],
            };

            const events = adapter.parseEvents({
                headers: {},
                rawBody: Buffer.from(JSON.stringify(metaPayload)),
            });

            expect(events).toEqual([]);
        });

        it('ném InvalidWebhookPayloadError nếu body không phải JSON hợp lệ', () => {
            const req: RawWebhookRequest = {
                headers: {},
                rawBody: Buffer.from('<html>Invalid json</html>'),
            };

            expect(() => adapter.parseEvents(req)).toThrow(InvalidWebhookPayloadError);
        });
    });
});
