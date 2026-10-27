import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DefaultCustomerGateway } from '../../src/modules/messaging/infrastructure/gateways/default-customer.gateway.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';

describe('DefaultCustomerGateway - Find or create customer when a message arrives', () => {
    let gateway: DefaultCustomerGateway;
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = {
            channelIdentity: {
                findUnique: vi.fn(),
                upsert: vi.fn(),
            },
            contact: {
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
            },
            channelAccount: {
                findFirst: vi.fn(),
            },
        };

        gateway = new DefaultCustomerGateway(mockPrisma as PrismaService);
    });

    it('tạo một contact mới và upsert channel_identity nếu chưa tồn tại', async () => {
        // Chưa có identity
        mockPrisma.channelIdentity.findUnique.mockResolvedValue(null);

        const createdContact = {
            id: 'contact-uuid-1',
            displayName: 'Trần Văn An',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        mockPrisma.contact.create.mockResolvedValue(createdContact);

        const upsertedIdentity = {
            id: 'identity-uuid-1',
            contactId: createdContact.id,
            channel: Channel.FACEBOOK,
            externalUserId: 'fb_user_001',
            contact: createdContact,
        };
        mockPrisma.channelIdentity.upsert.mockResolvedValue(upsertedIdentity);

        const result = await gateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: 'fb_user_001',
            displayName: 'Trần Văn An',
        });

        expect(mockPrisma.channelIdentity.findUnique).toHaveBeenCalledWith({
            where: {
                channel_externalUserId: {
                    channel: Channel.FACEBOOK,
                    externalUserId: 'fb_user_001',
                },
            },
            include: { contact: true },
        });

        expect(mockPrisma.contact.create).toHaveBeenCalledWith({
            data: { displayName: 'Trần Văn An' },
        });

        expect(mockPrisma.channelIdentity.upsert).toHaveBeenCalledWith({
            where: {
                channel_externalUserId: {
                    channel: Channel.FACEBOOK,
                    externalUserId: 'fb_user_001',
                },
            },
            update: { contactId: createdContact.id },
            create: {
                contactId: createdContact.id,
                channel: Channel.FACEBOOK,
                externalUserId: 'fb_user_001',
            },
            include: { contact: true },
        });

        expect(result.id).toBe(createdContact.id);
        expect(result.isNew).toBe(true);
    });

    it('hai tin nhắn từ cùng một người (cùng kênh, external_user_id) phải trỏ về cùng một contact', async () => {
        const existingContact = {
            id: 'contact-uuid-shared',
            displayName: 'Lê Thị Bình',
        };
        const existingIdentity = {
            id: 'identity-uuid-2',
            contactId: existingContact.id,
            channel: Channel.ZALO,
            externalUserId: 'zalo_user_999',
            contact: existingContact,
        };

        // Tin nhắn 1: Đã tồn tại identity
        mockPrisma.channelIdentity.findUnique.mockResolvedValue(existingIdentity);

        const result1 = await gateway.findOrCreate({
            channel: Channel.ZALO,
            senderExternalId: 'zalo_user_999',
        });

        // Tin nhắn 2: Cùng sender và channel
        const result2 = await gateway.findOrCreate({
            channel: Channel.ZALO,
            senderExternalId: 'zalo_user_999',
        });

        expect(result1.id).toBe(existingContact.id);
        expect(result2.id).toBe(existingContact.id);
        expect(result1.id).toBe(result2.id);
        expect(result1.isNew).toBe(false);
        expect(result2.isNew).toBe(false);

        // Không tạo thêm contact mới
        expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });

    it('sử dụng display name từ channel profile trong rawPayload nếu có', async () => {
        mockPrisma.channelIdentity.findUnique.mockResolvedValue(null);

        const createdContact = {
            id: 'contact-uuid-3',
            displayName: 'Nguyễn Văn Profile',
        };
        mockPrisma.contact.create.mockResolvedValue(createdContact);
        mockPrisma.channelIdentity.upsert.mockResolvedValue({
            id: 'identity-uuid-3',
            contactId: createdContact.id,
            contact: createdContact,
        });

        await gateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: 'fb_profile_123',
            rawPayload: {
                sender: { id: 'fb_profile_123', name: 'Nguyễn Văn Profile' },
            },
        });

        expect(mockPrisma.contact.create).toHaveBeenCalledWith({
            data: { displayName: 'Nguyễn Văn Profile' },
        });
    });

    it('fallback display name mặc định nếu API profile không khả dụng', async () => {
        mockPrisma.channelIdentity.findUnique.mockResolvedValue(null);
        mockPrisma.channelAccount.findFirst.mockResolvedValue(null); // không có token

        const createdContact = {
            id: 'contact-uuid-4',
            displayName: 'Khách hàng FACEBOOK #4567',
        };
        mockPrisma.contact.create.mockResolvedValue(createdContact);
        mockPrisma.channelIdentity.upsert.mockResolvedValue({
            id: 'identity-uuid-4',
            contactId: createdContact.id,
            contact: createdContact,
        });

        await gateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: '1234567',
        });

        expect(mockPrisma.contact.create).toHaveBeenCalledWith({
            data: { displayName: 'Khách hàng FACEBOOK #4567' },
        });
    });
});
