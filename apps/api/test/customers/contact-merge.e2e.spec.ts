import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PrismaClient, Channel, AuditAction } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { ContactMergeService } from '../../src/modules/messaging/application/contact-merge.service.js';
import { AuditService } from '../../src/modules/audit/audit.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('CUS-04: Contact Merge & Unmerge (Database Integration E2E)', () => {
  let pool: pg.Pool;
  let prisma: PrismaClient;
  let mergeService: ContactMergeService;
  let auditService: AuditService;

  const testSuffix = Date.now();
  const testPhone = '0987654321';

  let targetContactId: string;
  let sourceContactId: string;
  let targetCustomerId: string;
  let sourceCustomerId: string;
  let channelAccountId: string;
  let fbConvId: string;
  let zaloConvId: string;
  let mergeLogId: string;

  beforeAll(async () => {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:han@ct205@localhost:5432/recruitment_crm?schema=public';
    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    auditService = new AuditService(prisma as any);
    mergeService = new ContactMergeService(prisma as any, auditService);

    // 0. Tạo ChannelAccount dùng chung
    const channelAccount = await prisma.channelAccount.create({
      data: {
        channel: Channel.FACEBOOK,
        externalAccountId: `ext-page-${testSuffix}`,
        displayName: 'CUSC Fanpage Tuyển sinh',
      },
    });
    channelAccountId = channelAccount.id;

    // 1. Tạo Contact 1 (Facebook)
    const targetContact = await prisma.contact.create({
      data: {
        displayName: 'Nguyễn Học Viên (Facebook)',
        email: `an.fb.${testSuffix}@example.com`,
        phoneNormalized: testPhone,
        channelIdentities: {
          create: {
            channel: Channel.FACEBOOK,
            externalUserId: `fb-user-${testSuffix}`,
          },
        },
      },
      include: { channelIdentities: true },
    });
    targetContactId = targetContact.id;

    // 2. Tạo Customer 1 & Conversation 1
    const targetCustomer = await prisma.customer.create({
      data: {
        fullName: 'Nguyễn Học Viên (Facebook)',
        phone: testPhone,
        channelIdentities: { facebook: `fb-user-${testSuffix}`, tags: ['Lead'] },
      },
    });
    targetCustomerId = targetCustomer.id;

    const fbConv = await prisma.conversation.create({
      data: {
        channelAccountId,
        customerId: targetCustomerId,
        snippet: 'Em muốn hỏi lịch khai giảng khóa CNTT ạ',
        messages: {
          create: {
            channelAccountId,
            channel: Channel.FACEBOOK,
            direction: 'INBOUND',
            content: 'Em muốn hỏi lịch khai giảng khóa CNTT ạ',
            sentAt: new Date(Date.now() - 3600000),
            externalMessageId: `msg-fb-${testSuffix}`,
            rawPayload: {},
          },
        },
      },
    });
    fbConvId = fbConv.id;

    // 3. Tạo Contact 2 (Zalo - Chưa có SĐT)
    const sourceContact = await prisma.contact.create({
      data: {
        displayName: 'Hoc Vien Nguyen (Zalo)',
        email: null,
        channelIdentities: {
          create: {
            channel: Channel.ZALO,
            externalUserId: `zalo-user-${testSuffix}`,
          },
        },
      },
      include: { channelIdentities: true },
    });
    sourceContactId = sourceContact.id;

    // 4. Tạo Customer 2 & Conversation 2
    const sourceCustomer = await prisma.customer.create({
      data: {
        fullName: 'Hoc Vien Nguyen (Zalo)',
        channelIdentities: { zalo: `zalo-user-${testSuffix}`, tags: ['Zalo Quan tâm'] },
      },
    });
    sourceCustomerId = sourceCustomer.id;

    const zaloConv = await prisma.conversation.create({
      data: {
        channelAccountId,
        customerId: sourceCustomerId,
        snippet: 'Học phí khóa lập trình bao nhiêu vậy ạ?',
        messages: {
          create: {
            channelAccountId,
            channel: Channel.ZALO,
            direction: 'INBOUND',
            content: 'Học phí khóa lập trình bao nhiêu vậy ạ?',
            sentAt: new Date(),
            externalMessageId: `msg-zalo-${testSuffix}`,
            rawPayload: {},
          },
        },
      },
    });
    zaloConvId = zaloConv.id;
  });

  afterAll(async () => {
    try {
      if (mergeLogId) {
        await prisma.contactMergeLog.deleteMany({ where: { id: mergeLogId } }).catch(() => {});
      }
      await prisma.message.deleteMany({
        where: { externalMessageId: { in: [`msg-fb-${testSuffix}`, `msg-zalo-${testSuffix}`] } },
      }).catch(() => {});
      await prisma.conversation.deleteMany({
        where: { id: { in: [fbConvId, zaloConvId] } },
      }).catch(() => {});
      await prisma.customer.deleteMany({
        where: { id: { in: [targetCustomerId, sourceCustomerId] } },
      }).catch(() => {});
      await prisma.channelIdentity.deleteMany({
        where: { externalUserId: { in: [`fb-user-${testSuffix}`, `zalo-user-${testSuffix}`] } },
      }).catch(() => {});
      await prisma.contact.deleteMany({
        where: { id: { in: [targetContactId, sourceContactId] } },
      }).catch(() => {});
      if (channelAccountId) {
        await prisma.channelAccount.delete({ where: { id: channelAccountId } }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  });

  it('Bước 1: Gộp hai contact khác kênh cùng SĐT vào 1 hồ sơ duy nhất', async () => {
    const mergeResult = await mergeService.mergeContacts({
      targetContactId,
      sourceContactId,
      phoneNormalized: testPhone,
      actorId: '00000000-0000-0000-0000-000000000001',
      mergeType: 'AUTO_PHONE_MATCH',
      reason: 'Gộp tự động khi phát hiện trùng SĐT CUS-04',
    });

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.mergeLogId).toBeDefined();
    mergeLogId = mergeResult.mergeLogId;

    // Kiểm tra Target Contact trong CSDL: sở hữu cả 2 identities
    const updatedTarget = await prisma.contact.findUnique({
      where: { id: targetContactId },
      include: { channelIdentities: true },
    });
    expect(updatedTarget?.channelIdentities).toHaveLength(2);
    const channels = updatedTarget?.channelIdentities.map((i) => i.channel);
    expect(channels).toContain(Channel.FACEBOOK);
    expect(channels).toContain(Channel.ZALO);

    // Kiểm tra Source Contact trong CSDL: isMerged = true
    const updatedSource = await prisma.contact.findUnique({
      where: { id: sourceContactId },
    });
    expect(updatedSource?.isMerged).toBe(true);
    expect(updatedSource?.mergedIntoContactId).toBe(targetContactId);

    // DoD: Sau khi gộp, tin cũ của cả hai kênh đều thuộc về 1 hồ sơ
    const allConversations = await prisma.conversation.findMany({
      where: { customerId: targetCustomerId },
      include: { messages: true },
    });
    expect(allConversations).toHaveLength(2);
    const allMsgContents = allConversations.flatMap((c) => c.messages.map((m) => m.content));
    expect(allMsgContents).toContain('Em muốn hỏi lịch khai giảng khóa CNTT ạ');
    expect(allMsgContents).toContain('Học phí khóa lập trình bao nhiêu vậy ạ?');

    // Kiểm tra bản ghi AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: { action: AuditAction.CONTACT_MERGED },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRecord).not.toBeNull();
    const meta = auditRecord?.metadata as any;
    expect(meta?.targetContactId).toBe(targetContactId);
    expect(meta?.sourceContactId).toBe(sourceContactId);
    expect(meta?.phoneNormalized).toBe(testPhone);
  });

  it('Bước 2: Tách lại hồ sơ (Unmerge) nếu gộp nhầm, phục hồi độc lập', async () => {
    const unmergeResult = await mergeService.unmergeContact({
      mergeLogId,
      actorId: '00000000-0000-0000-0000-000000000001',
      reason: 'Tư vấn viên phát hiện nhầm SĐT phụ huynh và học viên',
    });

    expect(unmergeResult.success).toBe(true);
    expect(unmergeResult.restoredContactId).toBe(sourceContactId);

    // Kiểm tra Source Contact được phục hồi: isMerged = false
    const restoredSource = await prisma.contact.findUnique({
      where: { id: sourceContactId },
      include: { channelIdentities: true },
    });
    expect(restoredSource?.isMerged).toBe(false);
    expect(restoredSource?.mergedIntoContactId).toBeNull();
    expect(restoredSource?.channelIdentities).toHaveLength(1);
    expect(restoredSource?.channelIdentities[0].channel).toBe(Channel.ZALO);

    // Kiểm tra Target Contact chỉ còn lại 1 identity (Facebook)
    const targetAfterUnmerge = await prisma.contact.findUnique({
      where: { id: targetContactId },
      include: { channelIdentities: true },
    });
    expect(targetAfterUnmerge?.channelIdentities).toHaveLength(1);
    expect(targetAfterUnmerge?.channelIdentities[0].channel).toBe(Channel.FACEBOOK);

    // Kiểm tra Conversation của Zalo được trả lại cho Source Customer
    const sourceConvs = await prisma.conversation.findMany({
      where: { customerId: sourceCustomerId },
    });
    expect(sourceConvs).toHaveLength(1);
    expect(sourceConvs[0].id).toBe(zaloConvId);

    // Kiểm tra ContactMergeLog có isReverted = true
    const log = await prisma.contactMergeLog.findUnique({ where: { id: mergeLogId } });
    expect(log?.isReverted).toBe(true);
    expect(log?.revertedAt).not.toBeNull();

    // Kiểm tra AuditLog có sự kiện CONTACT_UNMERGED
    const unmergeAudit = await prisma.auditLog.findFirst({
      where: { action: AuditAction.CONTACT_UNMERGED },
      orderBy: { createdAt: 'desc' },
    });
    expect(unmergeAudit).not.toBeNull();
    const meta = unmergeAudit?.metadata as any;
    expect(meta?.mergeLogId).toBe(mergeLogId);
    expect(meta?.sourceContactId).toBe(sourceContactId);
  });
});

