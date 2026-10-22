import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set to run messaging e2e tests');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

describe('messages UNIQUE (channel, external_message_id)', () => {
  let accountId: string;
  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.channelAccount.deleteMany();
    const account = await prisma.channelAccount.create({
      data: {
        channel: 'ZALO',
        externalAccountId: 'oa-1',
        displayName: 'Zalo OA test',
      },
    });
    accountId = account.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  const newMessage = (over = {}) => ({
    channelAccountId: accountId,
    channel: 'ZALO' as const,
    direction: 'INBOUND' as const,
    content: 'How much fee of Java course?',
    sentAt: new Date(),
    externalMessageId: 'msg-001',
    rawPayload: { text: 'How much fee of Java course?' },
    ...over,
  });

  it('rejects a duplicate external_message_id on the same channel', async () => {
    await prisma.message.create({ data: newMessage() });

    await expect(prisma.message.create({ data: newMessage() })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allow the same external_message_id on a different channel', async () => {
    await prisma.message.create({ data: newMessage() });

    const fb = await prisma.channelAccount.create({
      data: {
        channel: 'FACEBOOK',
        externalAccountId: 'page-01',
        displayName: 'FB page',
      },
    });
    await expect(
      prisma.message.create({
        data: newMessage({ channel: 'FACEBOOK', channelAccountId: fb.id }),
      }),
    ).resolves.toBeDefined();
  });
});
