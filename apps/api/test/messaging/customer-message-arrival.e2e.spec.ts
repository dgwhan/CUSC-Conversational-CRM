import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { DefaultCustomerGateway } from '../../src/modules/messaging/infrastructure/gateways/default-customer.gateway.js';
import { Channel } from '../../src/modules/messaging/domain/channel.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Customer Find-or-Create on Message Arrival (Database Integration)', () => {
    let pool: pg.Pool;
    let prisma: PrismaClient;
    let gateway: DefaultCustomerGateway;
    const testExternalId = `test-fb-sender-${Date.now()}`;
    let createdContactId: string | null = null;

    beforeAll(() => {
        const connectionString =
            process.env.DATABASE_URL ||
            'postgresql://postgres:postgres@localhost:5432/recruitment_crm?schema=public';
        pool = new pg.Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });
        gateway = new DefaultCustomerGateway(prisma as any);
    });

    afterAll(async () => {
        if (createdContactId) {
            await prisma.contact.delete({ where: { id: createdContactId } }).catch(() => {});
        }
        await prisma.$disconnect();
        await pool.end();
    });

    it('Message 1: Creates new contact and upserts channel identity', async () => {
        const result1 = await gateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: testExternalId,
            displayName: 'Nguyễn Văn Test Profile',
        });

        expect(result1.isNew).toBe(true);
        expect(result1.id).toBeDefined();
        createdContactId = result1.id;

        const contactInDb = await prisma.contact.findUnique({
            where: { id: result1.id },
            include: { channelIdentities: true },
        });

        expect(contactInDb).not.toBeNull();
        expect(contactInDb?.displayName).toBe('Nguyễn Văn Test Profile');
        expect(contactInDb?.channelIdentities).toHaveLength(1);
        expect(contactInDb?.channelIdentities[0].channel).toBe(Channel.FACEBOOK);
        expect(contactInDb?.channelIdentities[0].externalUserId).toBe(testExternalId);
    });

    it('Message 2: From same person (same channel & external_user_id) points to the SAME contact', async () => {
        const result2 = await gateway.findOrCreate({
            channel: Channel.FACEBOOK,
            senderExternalId: testExternalId,
            rawPayload: { text: 'Tin nhắn thứ 2 từ cùng người gửi' },
        });

        expect(result2.isNew).toBe(false);
        expect(result2.id).toBe(createdContactId);

        // Đảm bảo không tạo thêm contact thứ hai
        const allMatchingContacts = await prisma.contact.findMany({
            where: {
                channelIdentities: {
                    some: {
                        channel: Channel.FACEBOOK,
                        externalUserId: testExternalId,
                    },
                },
            },
        });

        expect(allMatchingContacts).toHaveLength(1);
        expect(allMatchingContacts[0].id).toBe(createdContactId);
    });
});
