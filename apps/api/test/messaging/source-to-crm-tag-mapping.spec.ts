import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import {
    CRM_SYSTEM_TAGS,
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    META_SOURCE_TAGS,
    resolveTagMappings,
    deduplicateTags,
} from '../../src/modules/messaging/domain/tag-mapping/index.js';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { ChannelAdapterRegistry } from '../../src/modules/messaging/application/channel-adapter.registry.js';
import { ChannelManagerService } from '../../src/modules/channel-connection/application/channel-manager.service.js';
import type { ChannelAdapter, InboundMessageQueue } from '../../src/modules/messaging/domain/channel-adapter.port.js';
import type { InboundEvent } from '../../src/modules/messaging/domain/inbound-event.js';

describe('Sub-task 2: Implement Source-to-CRM Tag Mapping', () => {
    describe('1. Ánh xạ tag từ Meta sang CRM qua MessageRepository', () => {
        let repo: MessageRepository;
        let mockPrisma: any;

        beforeEach(() => {
            mockPrisma = {
                message: {
                    createManyAndReturn: vi.fn(),
                    findUnique: vi.fn(),
                    update: vi.fn(),
                    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
                    findMany: vi.fn().mockResolvedValue([]),
                },
                channelAccount: {
                    findUnique: vi.fn().mockResolvedValue({ id: 'acc-uuid-fb', workspaceId: 'ws-123' }),
                    upsert: vi.fn().mockResolvedValue({ id: 'acc-uuid-fb', workspaceId: 'ws-123' }),
                },
                customer: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                    update: vi.fn(),
                },
                conversation: {
                    findFirst: vi.fn(),
                    create: vi.fn(),
                    update: vi.fn(),
                },
            };

            repo = new MessageRepository(mockPrisma);
        });

        it('ánh xạ Facebook Lead sang tag Lead nội bộ khi tự động tạo Conversation', async () => {
            mockPrisma.message.createManyAndReturn.mockResolvedValue([{ id: 'msg-1' }]);
            mockPrisma.conversation.findFirst.mockResolvedValue(null);
            mockPrisma.conversation.create.mockImplementation(({ data }: any) =>
                Promise.resolve({ id: 'conv-new-1', ...data })
            );

            const events: InboundEvent[] = [
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-123',
                    externalMessageId: 'fb-msg-1',
                    senderExternalId: 'fb-user-1',
                    direction: MessageDirection.INBOUND,
                    content: 'Tôi muốn tư vấn',
                    sentAt: new Date(),
                    rawPayload: {
                        tags: ['Facebook Lead'],
                    },
                },
            ];

            const result = await repo.insertManyIgnoreDuplicate(events);

            expect(result).toHaveLength(1);
            expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: [CRM_SYSTEM_TAGS.LEAD],
                    }),
                })
            );
        });

        it('đảm bảo tính Idempotent khi cập nhật Conversation đã có tag Lead', async () => {
            mockPrisma.message.createManyAndReturn.mockResolvedValue([{ id: 'msg-2' }]);
            // Giả lập cuộc hội thoại đã có sẵn tag 'Lead' trong DB
            mockPrisma.conversation.findFirst.mockResolvedValue({
                id: 'conv-existing-1',
                tags: ['Lead'],
            });
            mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-existing-1' });

            const events: InboundEvent[] = [
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-123',
                    externalMessageId: 'fb-msg-2',
                    senderExternalId: 'fb-user-1',
                    direction: MessageDirection.INBOUND,
                    content: 'Tin nhắn tiếp theo',
                    sentAt: new Date(),
                    rawPayload: {
                        tags: ['facebook lead'], // Viết thường từ Meta
                    },
                },
            ];

            await repo.insertManyIgnoreDuplicate(events);

            expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'conv-existing-1' },
                    data: expect.objectContaining({
                        tags: ['Lead'], // Không bị lặp ['Lead', 'Lead'] hay ['Lead', 'facebook lead']
                    }),
                })
            );
        });

        it('gộp nhãn tùy chỉnh từ Meta an toàn vào tag nội bộ mà không sinh trùng lặp', async () => {
            mockPrisma.message.createManyAndReturn.mockResolvedValue([{ id: 'msg-3' }]);
            mockPrisma.conversation.findFirst.mockResolvedValue({
                id: 'conv-existing-2',
                tags: ['Khách cũ'],
            });
            mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-existing-2' });

            const events: InboundEvent[] = [
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-123',
                    externalMessageId: 'fb-msg-3',
                    senderExternalId: 'fb-user-2',
                    direction: MessageDirection.INBOUND,
                    content: 'Hỏi về học phí',
                    sentAt: new Date(),
                    rawPayload: {
                        tags: ['Facebook Lead', 'Khóa học React'],
                    },
                },
            ];

            await repo.insertManyIgnoreDuplicate(events);

            expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'conv-existing-2' },
                    data: expect.objectContaining({
                        tags: ['Khách cũ', 'Lead', 'Khóa học React'],
                    }),
                })
            );
        });
    });

    describe('2. Ánh xạ tag & đồng bộ Customer qua ReceiveInboundMessage UseCase', () => {
        let useCase: ReceiveInboundMessage;
        let mockRegistry: ChannelAdapterRegistry;
        let mockAdapter: ChannelAdapter;
        let mockRepo: any;
        let mockQueue: InboundMessageQueue;
        let mockPrisma: any;
        let mockRealtime: any;

        beforeEach(() => {
            mockAdapter = {
                channel: Channel.FACEBOOK,
                verifyRequest: vi.fn().mockReturnValue(true),
                parseEvents: vi.fn(),
            };

            mockRegistry = new ChannelAdapterRegistry([mockAdapter]);
            mockRepo = {
                insertManyIgnoreDuplicate: vi.fn(),
            };
            mockQueue = {
                enqueue: vi.fn().mockResolvedValue(undefined),
            };
            mockPrisma = {
                customer: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(),
                    update: vi.fn(),
                },
            };
            mockRealtime = {
                broadcastNewMessage: vi.fn(),
                broadcastPipelineChange: vi.fn(),
            };

            useCase = new ReceiveInboundMessage(
                mockRegistry,
                mockRepo,
                mockQueue,
                mockRealtime,
                mockPrisma,
            );
        });

        it('tự động gán leadStatus POTENTIAL và lưu tag Lead vào customer khi nhận Facebook Lead', async () => {
            const inboundEvent: InboundEvent = {
                channel: Channel.FACEBOOK,
                externalAccountId: 'page-fb-1',
                externalMessageId: 'mid-101',
                senderExternalId: 'user-fb-101',
                direction: MessageDirection.INBOUND,
                content: 'Tôi muốn đăng ký khóa học',
                sentAt: new Date(),
                rawPayload: {
                    customerName: 'Nguyễn Văn Lead',
                    tags: ['Facebook Lead'],
                },
            };

            mockAdapter.parseEvents = vi.fn().mockReturnValue([inboundEvent]);
            mockRepo.insertManyIgnoreDuplicate.mockResolvedValue([{ id: 'msg-db-1' }]);
            mockPrisma.customer.create.mockResolvedValue({
                id: 'cust-db-1',
                fullName: 'Nguyễn Văn Lead',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_NEW',
            });

            await useCase.execute({
                channel: Channel.FACEBOOK,
                headers: {},
                rawBody: Buffer.from('{}'),
            });

            expect(mockPrisma.customer.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        fullName: 'Nguyễn Văn Lead',
                        leadStatus: CRM_LEAD_STATUS.POTENTIAL,
                        leadStage: CRM_PIPELINE_STAGES.STAGE_NEW,
                        channelIdentities: expect.objectContaining({
                            tags: [CRM_SYSTEM_TAGS.LEAD],
                        }),
                    }),
                })
            );

            expect(mockRealtime.broadcastPipelineChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cust-db-1',
                    customerName: 'Nguyễn Văn Lead',
                    newStage: 'STAGE_NEW',
                })
            );
        });
    });

    describe('3. Đồng bộ Meta Facebook qua ChannelManagerService.syncFacebookMessages', () => {
        let channelManager: any;
        let mockPrisma: any;
        let mockEncryption: any;

        beforeEach(() => {
            mockPrisma = {
                channelAccount: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 'acc-fb-1',
                        workspaceId: 'ws-test-1',
                        channel: 'FACEBOOK',
                        externalAccountId: 'page-123456',
                        displayName: 'Fanpage Tuyển Sinh',
                        encryptedAccessToken: 'encrypted_token_123',
                    }),
                },
                customer: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'cust-sync-1', ...data })),
                    update: vi.fn(),
                },
                conversation: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'conv-sync-1', ...data })),
                    update: vi.fn(),
                },
            };

            mockEncryption = {
                decrypt: vi.fn().mockReturnValue('mock_decrypted_token'),
            };

            const mockMessageRepo = {
                insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'msg-1' }]),
            };

            channelManager = new ChannelManagerService(mockPrisma, mockEncryption, mockMessageRepo as any);
        });

        it('ánh xạ nhãn Facebook Lead từ Graph API sang tag Lead nội bộ và lưu vào Conversation & Customer', async () => {
            const mockGraphApiResponse = {
                data: [
                    {
                        id: 'meta-conv-001',
                        updated_time: new Date().toISOString(),
                        labels: {
                            data: [
                                { id: 'lbl-100', name: 'Facebook Lead' },
                                { id: 'lbl-101', name: 'Quan tâm Lập trình' },
                            ],
                        },
                        participants: {
                            data: [
                                { id: 'page-123456' },
                                { id: 'user-psid-888', name: 'Lê Văn Học' },
                            ],
                        },
                        messages: {
                            data: [
                                {
                                    id: 'msg-graph-1',
                                    message: 'Em muốn đăng ký tư vấn',
                                    created_time: new Date().toISOString(),
                                    from: { id: 'user-psid-888' },
                                },
                            ],
                        },
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(mockGraphApiResponse),
            } as any);

            const result = await channelManager.syncFacebookMessages('acc-fb-1', 'ws-test-1');

            expect(result.conversationsCount).toBe(1);
            expect(result.syncedCount).toBe(1);

            // Kiểm tra Customer được tạo với tag Lead, leadStatus POTENTIAL, leadStage STAGE_NEW
            expect(mockPrisma.customer.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        fullName: 'Lê Văn Học',
                        leadStatus: CRM_LEAD_STATUS.POTENTIAL,
                        leadStage: CRM_PIPELINE_STAGES.STAGE_NEW,
                        channelIdentities: expect.objectContaining({
                            tags: expect.arrayContaining([CRM_SYSTEM_TAGS.LEAD, 'Quan tâm Lập trình']),
                        }),
                    }),
                })
            );

            // Kiểm tra Conversation được tạo với tag Lead đã ánh xạ và nhãn bổ trợ
            expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tags: expect.arrayContaining([CRM_SYSTEM_TAGS.LEAD, 'Quan tâm Lập trình']),
                    }),
                })
            );
        });
    });
});
