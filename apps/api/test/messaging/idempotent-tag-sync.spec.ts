import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Channel, MessageDirection } from '../../src/modules/messaging/domain/channel.js';
import {
    CRM_SYSTEM_TAGS,
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    META_SOURCE_TAGS,
    resolveTagMappings,
    deduplicateTags,
    canUpgradeLeadStatus,
    canUpgradeLeadStage,
} from '../../src/modules/messaging/domain/tag-mapping/index.js';
import { MessageRepository } from '../../src/modules/messaging/infrastructure/message.repository.js';
import { ReceiveInboundMessage } from '../../src/modules/messaging/application/receive-inbound-message.usecase.js';
import { ChannelAdapterRegistry } from '../../src/modules/messaging/application/channel-adapter.registry.js';
import { ChannelManagerService } from '../../src/modules/channel-connection/application/channel-manager.service.js';
import type { ChannelAdapter, InboundMessageQueue } from '../../src/modules/messaging/domain/channel-adapter.port.js';
import type { InboundEvent } from '../../src/modules/messaging/domain/inbound-event.js';

describe('Sub-task 3: Ensure Idempotent Tag Synchronization', () => {
    describe('1. Đảm bảo xử lý cùng một sự kiện đồng bộ nhiều lần không tạo dữ liệu trùng lặp', () => {
        it('chạy đồng bộ liên tiếp cùng một tag nguồn không phát sinh tag trùng lặp hay thay đổi thừa (Idempotent)', () => {
            // Lần 1: Đồng bộ lần đầu từ sự kiện Meta 'Facebook Lead'
            const sync1 = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: [],
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD],
            });

            expect(sync1.finalTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(sync1.addedTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(sync1.hasChanges).toBe(true);
            expect(sync1.isTargetTagAlreadyPresent).toBe(false);

            // Lần 2: Lặp lại cùng sự kiện đồng bộ với kết quả của Lần 1
            const sync2 = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: sync1.finalTags,
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD],
            });

            expect(sync2.finalTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(sync2.addedTags).toEqual([]); // Không có tag nào bị thêm mới
            expect(sync2.hasChanges).toBe(false); // Hoàn toàn không có thay đổi
            expect(sync2.isTargetTagAlreadyPresent).toBe(true);

            // Lần 3: Đồng bộ lại với nhiều biến thể hoa/thường ('fb lead', 'Facebook Lead')
            const sync3 = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: sync2.finalTags,
                sourceTags: ['facebook lead', 'fb lead', 'Facebook Lead'],
            });

            expect(sync3.finalTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(sync3.addedTags).toEqual([]);
            expect(sync3.hasChanges).toBe(false);
            expect(sync3.isTargetTagAlreadyPresent).toBe(true);
        });

        it('MessageRepository khử trùng lặp khi nhận batch tin nhắn trùng nhau liên tiếp', async () => {
            const mockPrisma: any = {
                message: {
                    createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'msg-repeat-1' }]),
                    findUnique: vi.fn(),
                    update: vi.fn(),
                },
                channelAccount: {
                    upsert: vi.fn().mockResolvedValue({ id: 'acc-uuid', workspaceId: 'ws-1' }),
                },
                customer: {
                    findFirst: vi.fn().mockResolvedValue(null),
                },
                conversation: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'conv-repeat-1',
                        tags: [CRM_SYSTEM_TAGS.LEAD],
                        lastMessageAt: new Date('2026-10-30T00:00:00.000Z'),
                    }),
                    update: vi.fn().mockResolvedValue({ id: 'conv-repeat-1' }),
                },
            };

            const repo = new MessageRepository(mockPrisma);

            const events: InboundEvent[] = [
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-100',
                    externalMessageId: 'msg-rep-1',
                    senderExternalId: 'fb-user-100',
                    direction: MessageDirection.INBOUND,
                    content: 'Tin nhắn lặp lại',
                    sentAt: new Date('2026-10-30T00:00:00.000Z'),
                    rawPayload: {
                        tags: ['Facebook Lead'],
                    },
                },
            ];

            await repo.insertManyIgnoreDuplicate(events);

            // Xác minh Conversation tags vẫn duy nhất là ['Lead'], không bị duplicate thành ['Lead', 'Lead']
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'conv-repeat-1' },
                    data: expect.objectContaining({
                        tags: [CRM_SYSTEM_TAGS.LEAD],
                    }),
                })
            );
        });
    });

    describe('2. Kiểm tra trường hợp tag nội bộ đã tồn tại', () => {
        it('bảo toàn các tag tùy chỉnh khác khi tag Lead đã tồn tại từ trước', () => {
            const existingTags = ['Quan tâm CNTT', 'Khách hẹn gọi lại', CRM_SYSTEM_TAGS.LEAD];

            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: existingTags,
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD, 'Khóa học Python'],
            });

            expect(result.isTargetTagAlreadyPresent).toBe(true);
            expect(result.finalTags).toEqual([
                'Quan tâm CNTT',
                'Khách hẹn gọi lại',
                'Lead',
                'Khóa học Python',
            ]);
            expect(result.addedTags).toEqual(['Khóa học Python']);
            expect(result.hasChanges).toBe(true);
        });

        it('không hạ cấp hoặc reset trạng thái khách hàng khi khách hàng đã ở giai đoạn tiến triển hơn', () => {
            // Khách hàng đã được tư vấn và chuyển sang STAGE_CONTACTED, trạng thái QUALIFIED
            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: [CRM_SYSTEM_TAGS.LEAD],
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD],
                existingLeadStatus: CRM_LEAD_STATUS.QUALIFIED,
                existingLeadStage: CRM_PIPELINE_STAGES.STAGE_CONTACTED,
            });

            expect(result.isTargetTagAlreadyPresent).toBe(true);
            // suggestedLeadStatus & suggestedLeadStage phải là undefined để tránh reset về NEW / STAGE_NEW
            expect(result.suggestedLeadStatus).toBeUndefined();
            expect(result.suggestedLeadStage).toBeUndefined();
            expect(result.shouldUpgradeLead).toBe(false);
        });

        it('ReceiveInboundMessage không gửi broadcast reset giai đoạn phễu khi khách hàng cũ gửi tin nhắn mới', async () => {
            const mockAdapter: ChannelAdapter = {
                channel: Channel.FACEBOOK,
                verifyRequest: vi.fn().mockReturnValue(true),
                parseEvents: vi.fn(),
            };
            const mockRegistry = new ChannelAdapterRegistry([mockAdapter]);
            const mockRepo: any = {
                insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'msg-exist-1' }]),
            };
            const mockQueue: InboundMessageQueue = {
                enqueue: vi.fn().mockResolvedValue(undefined),
            };
            const mockPrisma: any = {
                customer: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'cust-advanced-1',
                        fullName: 'Nguyễn Văn Tiến Triển',
                        leadStatus: CRM_LEAD_STATUS.QUALIFIED,
                        leadStage: CRM_PIPELINE_STAGES.STAGE_ENROLLED, // Đã nhập học
                        channelIdentities: {
                            facebook: 'fb-user-adv',
                            tags: [CRM_SYSTEM_TAGS.LEAD],
                        },
                        updatedAt: new Date('2026-10-29T12:00:00.000Z'),
                    }),
                    update: vi.fn().mockResolvedValue({ id: 'cust-advanced-1' }),
                },
            };
            const mockRealtime: any = {
                broadcastNewMessage: vi.fn(),
                broadcastPipelineChange: vi.fn(),
            };

            const useCase = new ReceiveInboundMessage(
                mockRegistry,
                mockRepo,
                mockQueue,
                mockRealtime,
                mockPrisma
            );

            mockAdapter.parseEvents = vi.fn().mockReturnValue([
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-100',
                    externalMessageId: 'mid-adv-1',
                    senderExternalId: 'fb-user-adv',
                    direction: MessageDirection.INBOUND,
                    content: 'Em muốn hỏi lịch học tuần sau',
                    sentAt: new Date('2026-10-30T01:00:00.000Z'),
                    rawPayload: {
                        tags: ['Facebook Lead'],
                    },
                },
            ]);

            await useCase.execute({
                channel: Channel.FACEBOOK,
                headers: {},
                rawBody: Buffer.from('{}'),
            });

            // Tin nhắn mới được gửi qua realtime
            expect(mockRealtime.broadcastNewMessage).toHaveBeenCalled();
            // KHÔNG được broadcastPipelineChange đưa về STAGE_NEW vì khách hàng đã là STAGE_ENROLLED
            expect(mockRealtime.broadcastPipelineChange).not.toHaveBeenCalled();
        });
    });

    describe('3. Xử lý các sự kiện đồng bộ lặp lại hoặc đến không đúng thứ tự (Out-of-Order)', () => {
        it('phát hiện sự kiện out-of-order và không cho phép xóa tag hoặc hạ cấp tiến trình', () => {
            const eventTime = new Date('2026-10-25T08:00:00.000Z'); // Sự kiện cũ đến muộn
            const lastSyncTime = new Date('2026-10-29T10:00:00.000Z'); // Trạng thái DB mới hơn

            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: [CRM_SYSTEM_TAGS.LEAD, 'Đã xác nhận'],
                sourceTags: ['Khóa học Java'], // Nguồn cũ không có Facebook Lead
                eventTimestamp: eventTime,
                lastSyncTimestamp: lastSyncTime,
                existingLeadStatus: CRM_LEAD_STATUS.POTENTIAL,
                existingLeadStage: CRM_PIPELINE_STAGES.STAGE_QUALIFIED,
            });

            expect(result.isOutOfOrder).toBe(true);
            expect(result.shouldUpgradeLead).toBe(false);
            // Không được gỡ tag 'Lead' hay bất kỳ tag nào vì event này là sự kiện cũ đến muộn
            expect(result.removedTags).toEqual([]);
            expect(result.finalTags).toContain('Lead');
            expect(result.finalTags).toContain('Đã xác nhận');
            expect(result.finalTags).toContain('Khóa học Java');
        });

        it('MessageRepository không ghi đè lùi lastMessageAt và snippet khi nhận tin nhắn out-of-order', async () => {
            const newerDbTime = new Date('2026-10-30T01:00:00.000Z');
            const olderMessageTime = new Date('2026-10-28T09:00:00.000Z'); // Tin nhắn cũ từ 2 ngày trước đến muộn

            const mockPrisma: any = {
                message: {
                    createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'msg-old-1' }]),
                    findUnique: vi.fn(),
                    update: vi.fn(),
                },
                channelAccount: {
                    upsert: vi.fn().mockResolvedValue({ id: 'acc-uuid', workspaceId: 'ws-1' }),
                },
                customer: {
                    findFirst: vi.fn().mockResolvedValue(null),
                },
                conversation: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'conv-target-1',
                        tags: ['Lead'],
                        lastMessageAt: newerDbTime,
                        snippet: 'Tin nhắn mới nhất hiện tại',
                    }),
                    update: vi.fn().mockResolvedValue({ id: 'conv-target-1' }),
                },
            };

            const repo = new MessageRepository(mockPrisma);

            const events: InboundEvent[] = [
                {
                    channel: Channel.FACEBOOK,
                    externalAccountId: 'page-100',
                    externalMessageId: 'msg-delayed-001',
                    senderExternalId: 'fb-user-100',
                    direction: MessageDirection.INBOUND,
                    content: 'Tin nhắn cũ bị delay mạng',
                    sentAt: olderMessageTime,
                    rawPayload: {
                        tags: ['Facebook Lead', 'Tư vấn ban đầu'],
                    },
                },
            ];

            await repo.insertManyIgnoreDuplicate(events);

            // Kiểm tra cuộc hội thoại được cập nhật:
            // - KHÔNG được cập nhật lastMessageAt hay snippet bằng tin nhắn cũ
            // - tags được gộp an toàn: ['Lead', 'Tư vấn ban đầu']
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
                where: { id: 'conv-target-1' },
                data: {
                    tags: ['Lead', 'Tư vấn ban đầu'],
                },
            });
        });

        it('ChannelManagerService.syncFacebookMessages bảo vệ snippet và thời gian hội thoại trước dữ liệu Graph API cũ', async () => {
            const newerDbTime = new Date('2026-10-30T01:00:00.000Z');
            const olderConvTime = new Date('2026-10-25T10:00:00.000Z'); // Hội thoại cũ hơn trong Graph API

            const mockPrisma: any = {
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
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'cust-1',
                        fullName: 'Trần Văn Tiến',
                        leadStatus: CRM_LEAD_STATUS.POTENTIAL,
                        leadStage: CRM_PIPELINE_STAGES.STAGE_QUALIFIED,
                        channelIdentities: { facebook: 'cust-fb-id', tags: ['Lead'] },
                        updatedAt: newerDbTime,
                    }),
                    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'cust-1', ...data })),
                },
                conversation: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'conv-1',
                        tags: ['Lead'],
                        lastMessageAt: newerDbTime,
                        snippet: 'Tin nhắn mới nhất hôm nay',
                    }),
                    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'conv-1', ...data })),
                },
            };

            const mockEncryption = {
                decrypt: vi.fn().mockReturnValue('mock_token'),
            };

            const mockMessageRepo = {
                insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'm-1' }]),
            };

            const channelManager = new ChannelManagerService(mockPrisma, mockEncryption as any, mockMessageRepo as any);

            const mockGraphApiResponse = {
                data: [
                    {
                        id: 'meta-conv-old',
                        updated_time: olderConvTime.toISOString(),
                        labels: {
                            data: [{ id: 'lbl-1', name: 'Facebook Lead' }],
                        },
                        participants: {
                            data: [{ id: 'cust-fb-id', name: 'Trần Văn Tiến' }],
                        },
                        messages: {
                            data: [
                                {
                                    id: 'm-old-1',
                                    message: 'Tin nhắn tuần trước',
                                    created_time: olderConvTime.toISOString(),
                                    from: { id: 'cust-fb-id', name: 'Trần Văn Tiến' },
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

            await channelManager.syncFacebookMessages('acc-fb-1', 'ws-test-1');

            // Conversation update không được ghi đè snippet hay lastMessageAt lùi về quá khứ
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'conv-1' },
                    data: expect.not.objectContaining({
                        snippet: 'Tin nhắn tuần trước',
                    }),
                })
            );

            // Customer update không được hạ cấp leadStage về STAGE_NEW
            expect(mockPrisma.customer.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'cust-1' },
                    data: expect.not.objectContaining({
                        leadStage: CRM_PIPELINE_STAGES.STAGE_NEW,
                    }),
                })
            );
        });
    });
});
