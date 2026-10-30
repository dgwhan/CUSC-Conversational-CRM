import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import {
    CRM_SYSTEM_TAGS,
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    META_SOURCE_TAGS,
    TAG_REMOVAL_POLICY,
    resolveTagMappings,
    type TagMappingEngineConfig,
} from '../../src/modules/messaging/domain/tag-mapping/index.js';
import { CustomerController } from '../../src/modules/messaging/presentation/customer.controller.js';
import { ChannelManagerService } from '../../src/modules/channel-connection/application/channel-manager.service.js';

describe('Sub-task 4: Handle Source Tag Removal', () => {
    describe('1. Quy định hành vi khi tag Facebook Lead bị gỡ khỏi hội thoại trên Meta theo chính sách nghiệp vụ', () => {
        it('chính sách RETAIN_TARGET (mặc định): giữ nguyên tag Lead nội bộ khi Meta gỡ Facebook Lead để bảo vệ dữ liệu CRM', () => {
            const currentTags = [CRM_SYSTEM_TAGS.LEAD];

            // Meta gửi về danh sách nhãn rỗng (Facebook Lead đã bị gỡ trên Meta)
            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags,
                sourceTags: [],
                explicitEmptyLabels: true,
                isCustomerTouched: false,
            });

            // Tag Lead nội bộ vẫn được bảo lưu, không bị gỡ
            expect(result.finalTags).toContain(CRM_SYSTEM_TAGS.LEAD);
            expect(result.removedTags).toEqual([]);
            expect(result.hasChanges).toBe(false);
        });

        it('chính sách REMOVE_TARGET_IF_UNTOUCHED: gỡ tag Lead nếu khách hàng chưa có tương tác thủ công (untouched)', () => {
            const customConfig: TagMappingEngineConfig = {
                unmappedPolicy: 'PASS_THROUGH',
                rules: [
                    {
                        id: 'rule_untouched_test',
                        name: 'Untouched Policy Rule',
                        sourceChannel: Channel.FACEBOOK,
                        sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
                        targetTag: CRM_SYSTEM_TAGS.LEAD,
                        matchingType: 'CASE_INSENSITIVE',
                        removalPolicy: TAG_REMOVAL_POLICY.REMOVE_TARGET_IF_UNTOUCHED,
                        keepSourceTag: false,
                        priority: 100,
                    },
                ],
            };

            // Khách hàng chưa được tư vấn (isCustomerTouched: false, leadStatus: NEW)
            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: [CRM_SYSTEM_TAGS.LEAD],
                    sourceTags: [],
                    explicitEmptyLabels: true,
                    isCustomerTouched: false,
                    existingLeadStatus: CRM_LEAD_STATUS.NEW,
                },
                customConfig
            );

            expect(result.removedTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(result.finalTags).toEqual([]);
            expect(result.hasChanges).toBe(true);
        });

        it('chính sách REMOVE_TARGET_IF_UNTOUCHED: giữ lại tag Lead nếu khách hàng ĐÃ được tư vấn (touched)', () => {
            const customConfig: TagMappingEngineConfig = {
                unmappedPolicy: 'PASS_THROUGH',
                rules: [
                    {
                        id: 'rule_untouched_test',
                        name: 'Untouched Policy Rule',
                        sourceChannel: Channel.FACEBOOK,
                        sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
                        targetTag: CRM_SYSTEM_TAGS.LEAD,
                        matchingType: 'CASE_INSENSITIVE',
                        removalPolicy: TAG_REMOVAL_POLICY.REMOVE_TARGET_IF_UNTOUCHED,
                        keepSourceTag: false,
                        priority: 100,
                    },
                ],
            };

            // Khách hàng đã được Sales tương tác (isCustomerTouched: true, ví dụ leadStatus: POTENTIAL)
            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: [CRM_SYSTEM_TAGS.LEAD],
                    sourceTags: [],
                    explicitEmptyLabels: true,
                    isCustomerTouched: true,
                    existingLeadStatus: CRM_LEAD_STATUS.POTENTIAL,
                },
                customConfig
            );

            expect(result.removedTags).toEqual([]);
            expect(result.finalTags).toContain(CRM_SYSTEM_TAGS.LEAD);
            expect(result.hasChanges).toBe(false);
        });

        it('chính sách FORCE_REMOVE_TARGET: luôn gỡ tag Lead nội bộ theo nguồn Meta', () => {
            const customConfig: TagMappingEngineConfig = {
                unmappedPolicy: 'PASS_THROUGH',
                rules: [
                    {
                        id: 'rule_force_test',
                        name: 'Force Remove Rule',
                        sourceChannel: Channel.FACEBOOK,
                        sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
                        targetTag: CRM_SYSTEM_TAGS.LEAD,
                        matchingType: 'CASE_INSENSITIVE',
                        removalPolicy: TAG_REMOVAL_POLICY.FORCE_REMOVE_TARGET,
                        keepSourceTag: false,
                        priority: 100,
                    },
                ],
            };

            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: [CRM_SYSTEM_TAGS.LEAD],
                    sourceTags: [],
                    explicitEmptyLabels: true,
                    isCustomerTouched: true,
                },
                customConfig
            );

            expect(result.removedTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(result.finalTags).toEqual([]);
        });
    });

    describe('2. Đảm bảo việc gỡ tag không ảnh hưởng đến các tag được gắn độc lập trong CRM', () => {
        it('chỉ gỡ bỏ tag mục tiêu của rule bị gỡ, bảo toàn 100% các tag nội bộ độc lập khác', () => {
            const customConfig: TagMappingEngineConfig = {
                unmappedPolicy: 'PASS_THROUGH',
                rules: [
                    {
                        id: 'rule_force_remove',
                        name: 'Force Remove Rule',
                        sourceChannel: Channel.FACEBOOK,
                        sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
                        targetTag: CRM_SYSTEM_TAGS.LEAD,
                        matchingType: 'CASE_INSENSITIVE',
                        removalPolicy: TAG_REMOVAL_POLICY.FORCE_REMOVE_TARGET,
                        keepSourceTag: false,
                        priority: 100,
                    },
                ],
            };

            // Hội thoại có tag 'Lead' (từ Meta) cùng các tag nội bộ được nhân viên CRM gắn thủ công
            const currentTags = [
                'VIP Tuyển sinh',
                CRM_SYSTEM_TAGS.LEAD,
                'Khóa học Lập trình Web',
                'Hẹn gọi lại sau 15h',
            ];

            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags,
                    sourceTags: [],
                    explicitEmptyLabels: true,
                },
                customConfig
            );

            // Xác minh: Chỉ duy nhất tag 'Lead' bị gỡ
            expect(result.removedTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            // Các tag nội bộ khác vẫn được bảo toàn nguyên vẹn
            expect(result.finalTags).toEqual([
                'VIP Tuyển sinh',
                'Khóa học Lập trình Web',
                'Hẹn gọi lại sau 15h',
            ]);
            expect(result.finalTags).not.toContain(CRM_SYSTEM_TAGS.LEAD);
        });
    });

    describe('3. Hỗ trợ gỡ tag thông qua CRM (Manual Removal through CRM)', () => {
        let controller: CustomerController;
        let mockPrisma: any;

        beforeEach(() => {
            mockPrisma = {
                customer: {
                    findFirst: vi.fn(),
                    findUnique: vi.fn(),
                    update: vi.fn(),
                },
                conversation: {
                    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
                },
            };

            controller = new CustomerController(mockPrisma);
        });

        it('DELETE /customers/:id/tags/:tag gỡ trực tiếp tag nội bộ khỏi Customer và Conversation qua CRM', async () => {
            const customerId = 'cust-123456';
            mockPrisma.customer.findFirst.mockResolvedValue({
                id: customerId,
                fullName: 'Nguyễn Văn Test',
                channelIdentities: {
                    facebook: 'fb-user-123',
                    tags: ['Lead', 'Quan tâm Python', 'Học viên 2026'],
                    manuallyRemovedTags: [],
                },
                conversations: [
                    { id: 'conv-123', tags: ['Lead', 'Quan tâm Python', 'Học viên 2026'] },
                ],
            });

            mockPrisma.customer.update.mockImplementation(({ data }: any) =>
                Promise.resolve({
                    id: customerId,
                    fullName: 'Nguyễn Văn Test',
                    ...data,
                })
            );

            const result = await controller.removeCustomerTag(customerId, 'Lead');

            expect(result.success).toBe(true);
            expect(result.removedTag).toBe('Lead');
            expect(result.tags).toEqual(['Quan tâm Python', 'Học viên 2026']);

            // Xác minh DB Customer cập nhật: tags không còn Lead, manuallyRemovedTags có ghi nhận Lead
            expect(mockPrisma.customer.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: customerId },
                    data: expect.objectContaining({
                        channelIdentities: expect.objectContaining({
                            tags: ['Quan tâm Python', 'Học viên 2026'],
                            manuallyRemovedTags: expect.arrayContaining(['Lead']),
                        }),
                    }),
                })
            );

            // Xác minh Conversation tags của khách hàng cũng được đồng bộ gỡ bỏ Lead
            expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
                where: { customerId },
                data: { tags: ['Quan tâm Python', 'Học viên 2026'] },
            });
        });

        it('PATCH /customers/:id cập nhật danh sách tags và tự động ghi nhận tag bị gỡ vào manuallyRemovedTags', async () => {
            const customerId = '00000000-0000-0000-0000-000000000001';
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: customerId,
                fullName: 'Trần Thị B',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_NEW',
                channelIdentities: {
                    tags: ['Lead', 'Khóa học React'],
                    manuallyRemovedTags: [],
                },
            });

            mockPrisma.customer.update.mockImplementation(({ data }: any) =>
                Promise.resolve({
                    id: customerId,
                    fullName: 'Trần Thị B',
                    leadStatus: 'POTENTIAL',
                    leadStage: 'STAGE_NEW',
                    ...data,
                })
            );

            // Tư vấn viên gỡ 'Lead' bằng cách gửi danh sách mới chỉ còn ['Khóa học React']
            const result = await controller.updateCustomer(customerId, {
                tags: ['Khóa học React'],
            });

            expect(result.tags).toEqual(['Khóa học React']);
            expect(mockPrisma.customer.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: customerId },
                    data: expect.objectContaining({
                        channelIdentities: expect.objectContaining({
                            tags: ['Khóa học React'],
                            manuallyRemovedTags: expect.arrayContaining(['Lead']),
                        }),
                    }),
                })
            );
        });

        it('chống tự động gán lại tag Lead từ Meta khi tư vấn viên đã chủ động gỡ tag qua CRM (Anti-resurrection)', () => {
            // Tư vấn viên đã gỡ 'Lead' qua CRM nên manuallyRemovedTags có ['Lead']
            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: ['Khóa học React'],
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD], // Meta vẫn gửi lại Facebook Lead
                manuallyRemovedTags: ['Lead'],
            });

            // Hệ thống tôn trọng hành động gỡ trên CRM, KHÔNG tự ý gán lại tag Lead
            expect(result.finalTags).not.toContain('Lead');
            expect(result.finalTags).toEqual(['Khóa học React']);
            expect(result.addedTags).toEqual([]);
        });

        it('ChannelManagerService.syncFacebookMessages tôn trọng tag đã gỡ thủ công qua CRM và không gán lại', async () => {
            const mockPrismaSync: any = {
                channelAccount: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 'acc-fb-1',
                        workspaceId: 'ws-1',
                        channel: 'FACEBOOK',
                        externalAccountId: 'page-123456',
                        displayName: 'Fanpage Tuyển Sinh',
                        encryptedAccessToken: 'encrypted_token',
                    }),
                },
                customer: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'cust-sync-1',
                        fullName: 'Lê Văn An',
                        leadStatus: 'POTENTIAL',
                        leadStage: 'STAGE_NEW',
                        channelIdentities: {
                            facebook: 'fb-user-1',
                            tags: ['Quan tâm Đồ Họa'],
                            manuallyRemovedTags: ['Lead'], // Đã gỡ tag Lead qua CRM
                        },
                    }),
                    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'cust-sync-1', ...data })),
                },
                conversation: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'conv-sync-1',
                        tags: ['Quan tâm Đồ Họa'],
                    }),
                    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'conv-sync-1', ...data })),
                },
            };

            const mockEncryption = {
                decrypt: vi.fn().mockReturnValue('token'),
            };

            const mockMessageRepo = {
                insertManyIgnoreDuplicate: vi.fn().mockResolvedValue([{ id: 'm-1' }]),
            };

            const channelManager = new ChannelManagerService(mockPrismaSync, mockEncryption as any, mockMessageRepo as any);

            const mockGraphApiResponse = {
                data: [
                    {
                        id: 'meta-conv-1',
                        updated_time: new Date().toISOString(),
                        labels: {
                            data: [{ id: 'lbl-1', name: 'Facebook Lead' }],
                        },
                        participants: {
                            data: [{ id: 'fb-user-1', name: 'Lê Văn An' }],
                        },
                        messages: {
                            data: [
                                {
                                    id: 'm-1',
                                    message: 'Chào tư vấn viên',
                                    created_time: new Date().toISOString(),
                                    from: { id: 'fb-user-1', name: 'Lê Văn An' },
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

            await channelManager.syncFacebookMessages('acc-fb-1', 'ws-1');

            // Hội thoại và Customer không bị gán lại tag Lead vì tư vấn viên đã gỡ qua CRM
            expect(mockPrismaSync.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'conv-sync-1' },
                    data: expect.objectContaining({
                        tags: ['Quan tâm Đồ Họa'],
                    }),
                })
            );
        });
    });
});
