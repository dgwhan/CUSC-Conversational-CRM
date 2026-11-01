import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContactMergeService } from '../../src/modules/messaging/application/contact-merge.service.js';
import { AuditAction, Channel } from '@prisma/client';

describe('CUS-04: ContactMergeService (Unit Tests)', () => {
  let service: ContactMergeService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockRealtime: any;

  beforeEach(() => {
    mockPrisma = {
      contact: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      channelIdentity: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      customer: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      conversation: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      contactMergeLog: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockAudit = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockRealtime = {
      broadcastPipelineChange: vi.fn(),
    };

    service = new ContactMergeService(mockPrisma, mockAudit, mockRealtime);
  });

  describe('1. checkDuplicatePhone', () => {
    it('nhận diện SĐT hợp lệ và phát hiện trùng lặp nếu contact khác đã dùng', async () => {
      const existingContact = {
        id: 'contact-target-uuid',
        displayName: 'Nguyễn Văn An',
        phoneNormalized: '0912345678',
        isMerged: false,
        channelIdentities: [{ channel: Channel.FACEBOOK, externalUserId: 'fb_123' }],
      };
      mockPrisma.contact.findFirst.mockResolvedValue(existingContact);

      const result = await service.checkDuplicatePhone('+84 912 345 678');

      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe('0912345678');
      expect(result.hasCollision).toBe(true);
      expect(result.existingContact?.id).toBe('contact-target-uuid');
    });

    it('từ chối SĐT sai định dạng hoặc không đủ 10 chữ số', async () => {
      const result = await service.checkDuplicatePhone('0912345');
      expect(result.isValid).toBe(false);
      expect(result.normalizedPhone).toBeNull();
      expect(result.hasCollision).toBe(false);
    });

    it('bỏ qua contact hiện tại nếu truyền excludeContactId', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicatePhone('0912345678', 'contact-target-uuid');

      expect(result.isValid).toBe(true);
      expect(result.hasCollision).toBe(false);
      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          phoneNormalized: '0912345678',
          isMerged: false,
          id: { not: 'contact-target-uuid' },
        },
        include: { channelIdentities: true },
      });
    });
  });

  describe('2. mergeContacts', () => {
    it('báo lỗi nếu targetContactId trùng với sourceContactId', async () => {
      await expect(
        service.mergeContacts({
          targetContactId: 'c-1',
          sourceContactId: 'c-1',
        }),
      ).rejects.toThrow('Không thể gộp một contact với chính nó');
    });

    it('báo lỗi nếu sourceContact đã bị gộp trước đó (isMerged = true)', async () => {
      mockPrisma.contact.findUnique
        .mockResolvedValueOnce({ id: 'target-1', isMerged: false, channelIdentities: [] })
        .mockResolvedValueOnce({ id: 'source-1', isMerged: true, channelIdentities: [] });

      await expect(
        service.mergeContacts({
          targetContactId: 'target-1',
          sourceContactId: 'source-1',
        }),
      ).rejects.toThrow('Source contact đã bị gộp trước đó');
    });

    it('gộp 2 contacts thành công: chuyển identities, chuyển conversations, lưu snapshot và ghi AuditLog', async () => {
      const targetContact = {
        id: 'target-uuid',
        displayName: 'Nguyễn Văn An (FB)',
        email: 'an@gmail.com',
        notes: 'Hỏi học phí khóa Fullstack',
        phoneNormalized: '0912345678',
        channelIdentities: [
          { id: 'ident-fb', channel: Channel.FACEBOOK, externalUserId: 'fb_user_111' },
        ],
      };

      const sourceContact = {
        id: 'source-uuid',
        displayName: 'An Nguyen (Zalo)',
        email: null,
        notes: 'Đã gọi tư vấn qua điện thoại',
        phoneNormalized: null,
        isMerged: false,
        channelIdentities: [
          { id: 'ident-zalo', channel: Channel.ZALO, externalUserId: 'zalo_user_222' },
        ],
      };

      mockPrisma.contact.findUnique
        .mockResolvedValueOnce(targetContact)
        .mockResolvedValueOnce(sourceContact);

      // Customer mock
      const targetCust = {
        id: 'cust-target',
        fullName: 'Nguyễn Văn An',
        phone: '0912345678',
        channelIdentities: { facebook: 'fb_user_111', tags: ['Lead'] },
      };
      const sourceCust = {
        id: 'cust-source',
        fullName: 'An Nguyen',
        phone: null,
        channelIdentities: { zalo: 'zalo_user_222', tags: ['Zalo Quan tâm'], interestCourses: ['Fullstack'] },
      };
      mockPrisma.customer.findMany
        .mockResolvedValueOnce([targetCust])
        .mockResolvedValueOnce([sourceCust]);

      mockPrisma.conversation.findMany.mockResolvedValueOnce([
        { id: 'conv-zalo-1' },
        { id: 'conv-zalo-2' },
      ]);

      mockPrisma.contact.update
        .mockResolvedValueOnce({
          ...targetContact,
          channelIdentities: [
            ...targetContact.channelIdentities,
            sourceContact.channelIdentities[0],
          ],
        })
        .mockResolvedValueOnce({
          ...sourceContact,
          isMerged: true,
          mergedIntoContactId: targetContact.id,
        });

      mockPrisma.contactMergeLog.create.mockResolvedValue({
        id: 'merge-log-uuid-1',
        targetContactId: targetContact.id,
        sourceContactId: sourceContact.id,
        phoneNormalized: '0912345678',
        mergeType: 'AUTO_PHONE_MATCH',
      });

      const res = await service.mergeContacts({
        targetContactId: targetContact.id,
        sourceContactId: sourceContact.id,
        phoneNormalized: '0912345678',
        mergeType: 'AUTO_PHONE_MATCH',
        actorId: 'staff-actor-uuid',
        reason: 'Hai kênh cùng SĐT 0912345678',
      });

      expect(res.success).toBe(true);
      expect(res.mergeLogId).toBe('merge-log-uuid-1');
      expect(res.movedIdentitiesCount).toBe(1);
      expect(res.movedConversationsCount).toBe(2);

      // Kiểm tra chuyển ChannelIdentity
      expect(mockPrisma.channelIdentity.update).toHaveBeenCalledWith({
        where: { id: 'ident-zalo' },
        data: { contactId: targetContact.id },
      });

      // Kiểm tra chuyển Conversation
      expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-source' },
        data: { customerId: 'cust-target' },
      });

      // Kiểm tra ghi Audit Log CONTACT_MERGED
      expect(mockAudit.recordEvent).toHaveBeenCalledWith({
        action: AuditAction.CONTACT_MERGED,
        actorId: 'staff-actor-uuid',
        metadata: expect.objectContaining({
          mergeLogId: 'merge-log-uuid-1',
          targetContactId: targetContact.id,
          sourceContactId: sourceContact.id,
          phoneNormalized: '0912345678',
          movedIdentitiesCount: 1,
          movedConversationsCount: 2,
        }),
      });

      // Kiểm tra bắn Realtime event
      expect(mockRealtime.broadcastPipelineChange).toHaveBeenCalled();
    });
  });

  describe('3. unmergeContact (Tách lại hồ sơ nếu gộp nhầm)', () => {
    it('báo lỗi nếu mergeLogId không tồn tại', async () => {
      mockPrisma.contactMergeLog.findUnique.mockResolvedValue(null);
      await expect(service.unmergeContact({ mergeLogId: 'not-found' })).rejects.toThrow(
        'Không tìm thấy lịch sử gộp',
      );
    });

    it('báo lỗi nếu lần gộp đã được hoàn tác trước đó', async () => {
      mockPrisma.contactMergeLog.findUnique.mockResolvedValue({
        id: 'log-1',
        isReverted: true,
      });
      await expect(service.unmergeContact({ mergeLogId: 'log-1' })).rejects.toThrow(
        'Lần gộp này đã được hoàn tác',
      );
    });

    it('tách lại hồ sơ thành công: hoàn trả identities, conversations và ghi AuditLog CONTACT_UNMERGED', async () => {
      const mergeLog = {
        id: 'log-uuid-1',
        targetContactId: 'target-uuid',
        sourceContactId: 'source-uuid',
        phoneNormalized: '0912345678',
        isReverted: false,
        snapshotData: {
          sourceContact: {
            id: 'source-uuid',
            displayName: 'An Nguyen (Zalo)',
            email: null,
            notes: 'Ghi chú gốc của Zalo',
          },
          movedIdentities: [
            { id: 'ident-zalo', channel: Channel.ZALO, externalUserId: 'zalo_user_222' },
          ],
          sourceCustomerId: 'cust-source',
          movedConversationIds: ['conv-zalo-1', 'conv-zalo-2'],
        },
      };

      mockPrisma.contactMergeLog.findUnique.mockResolvedValue(mergeLog);

      const unmergeRes = await service.unmergeContact({
        mergeLogId: 'log-uuid-1',
        actorId: 'staff-actor-uuid',
        reason: 'Gộp nhầm SĐT gia đình',
      });

      expect(unmergeRes.success).toBe(true);
      expect(unmergeRes.restoredContactId).toBe('source-uuid');

      // 1. Phục hồi Source Contact
      expect(mockPrisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'source-uuid' },
        data: {
          isMerged: false,
          mergedIntoContactId: null,
          displayName: 'An Nguyen (Zalo)',
          email: null,
          notes: 'Ghi chú gốc của Zalo',
          phoneNormalized: null,
        },
      });

      // 2. Trả lại ChannelIdentity
      expect(mockPrisma.channelIdentity.updateMany).toHaveBeenCalledWith({
        where: {
          channel: Channel.ZALO,
          externalUserId: 'zalo_user_222',
        },
        data: {
          contactId: 'source-uuid',
        },
      });

      // 3. Trả lại Conversations
      expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['conv-zalo-1', 'conv-zalo-2'] },
        },
        data: {
          customerId: 'cust-source',
        },
      });

      // 4. Cập nhật merge log là đã hoàn tác
      expect(mockPrisma.contactMergeLog.update).toHaveBeenCalledWith({
        where: { id: 'log-uuid-1' },
        data: expect.objectContaining({
          isReverted: true,
          revertedBy: 'staff-actor-uuid',
        }),
      });

      // 5. Ghi Audit Log CONTACT_UNMERGED
      expect(mockAudit.recordEvent).toHaveBeenCalledWith({
        action: AuditAction.CONTACT_UNMERGED,
        actorId: 'staff-actor-uuid',
        metadata: expect.objectContaining({
          mergeLogId: 'log-uuid-1',
          targetContactId: 'target-uuid',
          sourceContactId: 'source-uuid',
          reason: 'Gộp nhầm SĐT gia đình',
        }),
      });
    });
  });

  describe('4. getMergeHistory', () => {
    it('trả về danh sách lịch sử gộp của một contact', async () => {
      mockPrisma.contactMergeLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          targetContactId: 'c-1',
          sourceContactId: 'c-2',
          phoneNormalized: '0912345678',
        },
      ]);

      const history = await service.getMergeHistory('c-1');
      expect(history.items).toHaveLength(1);
      expect(history.total).toBe(1);
      expect(history.items[0].id).toBe('log-1');
    });
  });
});

