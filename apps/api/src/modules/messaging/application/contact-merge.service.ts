import { Injectable, Logger, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { standardizeVietnamesePhoneNumber } from '../../customers/domain/phone-standardizer.js';
import { AuditAction } from '@prisma/client';

export interface MergeContactsParams {
  targetContactId: string;
  sourceContactId: string;
  phoneNormalized?: string;
  actorId?: string;
  mergeType?: 'AUTO_PHONE_MATCH' | 'MANUAL_STAFF';
  reason?: string;
  workspaceId?: string;
}

export interface UnmergeContactParams {
  mergeLogId: string;
  actorId?: string;
  reason?: string;
}

export interface CheckDuplicatePhoneResult {
  isValid: boolean;
  normalizedPhone: string | null;
  existingContact: any | null;
  hasCollision: boolean;
}

@Injectable()
export class ContactMergeService {
  private readonly logger = new Logger(ContactMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Kiểm tra trùng lặp số điện thoại trong hệ thống Contacts
   */
  async checkDuplicatePhone(phone: string, excludeContactId?: string): Promise<CheckDuplicatePhoneResult> {
    const normalized = standardizeVietnamesePhoneNumber(phone);
    if (!normalized) {
      return {
        isValid: false,
        normalizedPhone: null,
        existingContact: null,
        hasCollision: false,
      };
    }

    const existing = await this.prisma.contact.findFirst({
      where: {
        phoneNormalized: normalized,
        isMerged: false,
        ...(excludeContactId ? { id: { not: excludeContactId } } : {}),
      },
      include: {
        channelIdentities: true,
      },
    });

    return {
      isValid: true,
      normalizedPhone: normalized,
      existingContact: existing,
      hasCollision: Boolean(existing),
    };
  }

  /**
   * Gộp 2 Contacts về 1 Contact duy nhất (Target Contact)
   * Bảo toàn 100% channel_identities, conversations, messages, notes và ghi vết Audit
   */
  async mergeContacts(params: MergeContactsParams) {
    const { targetContactId, sourceContactId } = params;

    if (targetContactId === sourceContactId) {
      throw new BadRequestException('Không thể gộp một contact với chính nó');
    }

    const [targetContact, sourceContact] = await Promise.all([
      this.prisma.contact.findUnique({
        where: { id: targetContactId },
        include: { channelIdentities: true },
      }),
      this.prisma.contact.findUnique({
        where: { id: sourceContactId },
        include: { channelIdentities: true },
      }),
    ]);

    if (!targetContact) {
      throw new NotFoundException(`Target contact không tồn tại (${targetContactId})`);
    }
    if (!sourceContact) {
      throw new NotFoundException(`Source contact không tồn tại (${sourceContactId})`);
    }
    if (sourceContact.isMerged) {
      throw new BadRequestException(`Source contact đã bị gộp trước đó (${sourceContactId})`);
    }

    // Xác định số điện thoại chuẩn hóa dùng chung
    const effectivePhone =
      params.phoneNormalized ||
      targetContact.phoneNormalized ||
      sourceContact.phoneNormalized ||
      null;

    // Tìm các Customer tương ứng (theo workspace hoặc identity)
    const [targetCustomers, sourceCustomers] = await Promise.all([
      this.findRelatedCustomers(targetContact),
      this.findRelatedCustomers(sourceContact),
    ]);

    const primaryTargetCustomer = targetCustomers[0] || null;
    const primarySourceCustomer = sourceCustomers[0] || null;

    // Lấy danh sách conversationIds của source customer trước khi chuyển
    let sourceConversationIds: string[] = [];
    if (primarySourceCustomer) {
      const convs = await this.prisma.conversation.findMany({
        where: { customerId: primarySourceCustomer.id },
        select: { id: true },
      });
      sourceConversationIds = convs.map((c) => c.id);
    }

    // Thực thi gộp trong ACID Database Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo Snapshot phục vụ Unmerge
      const snapshotData = {
        sourceContact: {
          id: sourceContact.id,
          displayName: sourceContact.displayName,
          email: sourceContact.email,
          notes: sourceContact.notes,
          phoneNormalized: sourceContact.phoneNormalized,
        },
        targetContact: {
          id: targetContact.id,
          displayName: targetContact.displayName,
          email: targetContact.email,
          notes: targetContact.notes,
          phoneNormalized: targetContact.phoneNormalized,
        },
        movedIdentities: sourceContact.channelIdentities.map((idnt) => ({
          id: idnt.id,
          channel: idnt.channel,
          externalUserId: idnt.externalUserId,
        })),
        sourceCustomerId: primarySourceCustomer?.id || null,
        targetCustomerId: primaryTargetCustomer?.id || null,
        movedConversationIds: sourceConversationIds,
        reason: params.reason || null,
        mergedAt: new Date().toISOString(),
      };

      // 2. Chuyển toàn bộ ChannelIdentity từ source sang target
      // (Lưu ý: bỏ qua nếu target đã có identity cùng channel và externalUserId)
      for (const idnt of sourceContact.channelIdentities) {
        const existingInTarget = targetContact.channelIdentities.find(
          (ti) => ti.channel === idnt.channel && ti.externalUserId === idnt.externalUserId,
        );
        if (existingInTarget) {
          // Trùng identity: xóa bản ghi trùng ở source để tránh xung đột unique
          await tx.channelIdentity.delete({ where: { id: idnt.id } });
        } else {
          await tx.channelIdentity.update({
            where: { id: idnt.id },
            data: { contactId: targetContact.id },
          });
        }
      }

      // 3. Chuyển toàn bộ Conversations của Source Customer sang Target Customer
      if (primarySourceCustomer && primaryTargetCustomer && sourceConversationIds.length > 0) {
        await tx.conversation.updateMany({
          where: { customerId: primarySourceCustomer.id },
          data: { customerId: primaryTargetCustomer.id },
        });

        // Hợp nhất JSON channelIdentities của Customer
        const targetIdentities = (primaryTargetCustomer.channelIdentities as any) || {};
        const sourceIdentities = (primarySourceCustomer.channelIdentities as any) || {};
        const mergedCustomerIdentities = {
          ...sourceIdentities,
          ...targetIdentities,
          tags: Array.from(
            new Set([...(targetIdentities.tags || []), ...(sourceIdentities.tags || [])]),
          ),
          interestCourses: Array.from(
            new Set([...(targetIdentities.interestCourses || []), ...(sourceIdentities.interestCourses || [])]),
          ),
        };

        await tx.customer.update({
          where: { id: primaryTargetCustomer.id },
          data: {
            channelIdentities: mergedCustomerIdentities,
            phone: effectivePhone || primaryTargetCustomer.phone || primarySourceCustomer.phone,
          },
        });
      }

      // 4. Cập nhật Target Contact với SĐT chuẩn hóa và ghép notes
      const mergedNotes = [targetContact.notes, sourceContact.notes]
        .filter(Boolean)
        .join('\n---\n');

      // Tự động chọn tên hiển thị tốt hơn (tránh placeholder "Khách hàng ...")
      let betterDisplayName = targetContact.displayName;
      if (
        (betterDisplayName.startsWith('Khách hàng') || betterDisplayName.startsWith('Unknown')) &&
        sourceContact.displayName &&
        !sourceContact.displayName.startsWith('Khách hàng')
      ) {
        betterDisplayName = sourceContact.displayName;
      }

      const updatedTarget = await tx.contact.update({
        where: { id: targetContact.id },
        data: {
          displayName: betterDisplayName,
          phoneNormalized: effectivePhone,
          notes: mergedNotes || undefined,
          email: targetContact.email || sourceContact.email,
        },
        include: { channelIdentities: true },
      });

      // 5. Đánh dấu Source Contact là đã sáp nhập (isMerged = true)
      await tx.contact.update({
        where: { id: sourceContact.id },
        data: {
          isMerged: true,
          mergedIntoContactId: targetContact.id,
          phoneNormalized: null, // giải phóng unique constraint để không chặn các thao tác khác
        },
      });

      // 6. Ghi bản ghi ContactMergeLog
      const mergeLog = await tx.contactMergeLog.create({
        data: {
          targetContactId: targetContact.id,
          sourceContactId: sourceContact.id,
          phoneNormalized: effectivePhone || '',
          mergeType: params.mergeType || 'AUTO_PHONE_MATCH',
          actorId: params.actorId || null,
          snapshotData,
        },
      });

      return {
        updatedTarget,
        mergeLog,
        movedIdentitiesCount: sourceContact.channelIdentities.length,
        movedConversationsCount: sourceConversationIds.length,
      };
    });

    // 7. Ghi nhận sự kiện vào AuditLog
    await this.auditService.recordEvent({
      action: AuditAction.CONTACT_MERGED,
      actorId: params.actorId || null,
      metadata: {
        mergeLogId: result.mergeLog.id,
        targetContactId,
        sourceContactId,
        phoneNormalized: result.mergeLog.phoneNormalized,
        mergeType: result.mergeLog.mergeType,
        movedIdentitiesCount: result.movedIdentitiesCount,
        movedConversationsCount: result.movedConversationsCount,
        reason: params.reason || 'Group customers by phone number',
      },
    });

    // 8. Bắn sự kiện realtime nếu có
    if (this.realtime) {
      try {
        this.realtime.broadcastPipelineChange({
          customerId: primaryTargetCustomer?.id || targetContact.id,
          customerName: result.updatedTarget.displayName,
          newStage: primaryTargetCustomer?.leadStage || 'STAGE_NEW',
          previousStage: primarySourceCustomer?.leadStage || 'STAGE_NEW',
          updatedBy: params.actorId ? `Tư vấn viên ${params.actorId}` : 'Hệ thống tự động gộp (CUS-04)',
          phone: result.updatedTarget.phoneNormalized || undefined,
        } as any);
      } catch {}
    }

    this.logger.log(
      `Đã gộp contact ${sourceContactId} vào ${targetContactId} theo SĐT "${result.mergeLog.phoneNormalized}" (Log: ${result.mergeLog.id})`,
    );

    return {
      success: true,
      mergeLogId: result.mergeLog.id,
      targetContact: result.updatedTarget,
      movedIdentitiesCount: result.movedIdentitiesCount,
      movedConversationsCount: result.movedConversationsCount,
    };
  }

  /**
   * Hoàn tác / Tách lại hồ sơ nếu gộp nhầm (Unmerge)
   * Sử dụng Snapshot đã lưu để phục hồi nguyên trạng
   */
  async unmergeContact(params: UnmergeContactParams) {
    const mergeLog = await this.prisma.contactMergeLog.findUnique({
      where: { id: params.mergeLogId },
    });

    if (!mergeLog) {
      throw new NotFoundException(`Không tìm thấy lịch sử gộp với ID: ${params.mergeLogId}`);
    }

    if (mergeLog.isReverted) {
      throw new BadRequestException('Lần gộp này đã được hoàn tác / tách lại trước đó');
    }

    const snapshot = mergeLog.snapshotData as any;
    if (!snapshot || !snapshot.sourceContact) {
      throw new BadRequestException('Dữ liệu snapshot không hợp lệ để phục hồi');
    }

    const { sourceContact, movedIdentities = [], movedConversationIds = [], sourceCustomerId } = snapshot;

    await this.prisma.$transaction(async (tx) => {
      // 1. Phục hồi Source Contact
      await tx.contact.update({
        where: { id: sourceContact.id },
        data: {
          isMerged: false,
          mergedIntoContactId: null,
          displayName: sourceContact.displayName,
          email: sourceContact.email,
          notes: sourceContact.notes,
          phoneNormalized: null, // Đặt null để tránh xung đột SĐT đã gán nhầm
        },
      });

      // 2. Chuyển trả lại các ChannelIdentities ban đầu về Source Contact
      for (const idnt of movedIdentities) {
        await tx.channelIdentity.updateMany({
          where: {
            channel: idnt.channel,
            externalUserId: idnt.externalUserId,
          },
          data: {
            contactId: sourceContact.id,
          },
        });
      }

      // 3. Chuyển trả lại các Conversations về Source Customer nếu có
      if (sourceCustomerId && movedConversationIds.length > 0) {
        await tx.conversation.updateMany({
          where: {
            id: { in: movedConversationIds },
          },
          data: {
            customerId: sourceCustomerId,
          },
        });
      }

      // 4. Đánh dấu bản ghi ContactMergeLog là đã hoàn tác
      await tx.contactMergeLog.update({
        where: { id: mergeLog.id },
        data: {
          isReverted: true,
          revertedAt: new Date(),
          revertedBy: params.actorId || null,
        },
      });
    });

    // 5. Ghi Audit Log cho sự kiện CONTACT_UNMERGED
    await this.auditService.recordEvent({
      action: AuditAction.CONTACT_UNMERGED,
      actorId: params.actorId || null,
      metadata: {
        mergeLogId: mergeLog.id,
        targetContactId: mergeLog.targetContactId,
        sourceContactId: mergeLog.sourceContactId,
        revertedAt: new Date().toISOString(),
        reason: params.reason || 'Tách lại hồ sơ gộp nhầm (CUS-04)',
      },
    });

    this.logger.log(
      `Đã hoàn tác gộp (Unmerge) thành công cho log ${params.mergeLogId}. Phục hồi contact ${sourceContact.id}`,
    );

    return {
      success: true,
      message: 'Đã hoàn tác gộp thành công. Hai hồ sơ đã được tách biệt độc lập.',
      mergeLogId: mergeLog.id,
      restoredContactId: sourceContact.id,
      targetContactId: mergeLog.targetContactId,
    };
  }

  /**
   * Lấy danh sách lịch sử gộp linh hoạt theo Contact ID, Customer ID, Số điện thoại hoặc Identity
   */
  async getMergeHistory(identifier: string) {
    if (!identifier) {
      return { items: [], total: 0 };
    }

    const whereOr: any[] = [
      { targetContactId: identifier },
      { sourceContactId: identifier },
    ];

    // Tra cứu xem có phải Customer ID trong bảng Customer không
    try {
      if (this.prisma.customer?.findUnique) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: identifier },
        });

        if (customer) {
          if (customer.phone) {
            const std = standardizeVietnamesePhoneNumber(customer.phone);
            if (std) whereOr.push({ phoneNormalized: std });
          }
          const rawIdentities = customer.channelIdentities as any;
          const fbId = rawIdentities?.facebook || rawIdentities?.socialId;
          const zaloId = rawIdentities?.zalo?.id || rawIdentities?.zalo;
          const extIds: string[] = [];
          if (fbId) extIds.push(String(fbId));
          if (zaloId) extIds.push(String(zaloId));

          if (extIds.length > 0 && this.prisma.channelIdentity?.findMany) {
            const identities = await this.prisma.channelIdentity.findMany({
              where: { externalUserId: { in: extIds } },
              select: { contactId: true },
            });
            for (const idnt of identities || []) {
              whereOr.push({ targetContactId: idnt.contactId });
              whereOr.push({ sourceContactId: idnt.contactId });
            }
          }
        }
      }
    } catch { }

    // Tra cứu xem có phải là số điện thoại không
    const stdPhone = standardizeVietnamesePhoneNumber(identifier);
    if (stdPhone) {
      whereOr.push({ phoneNormalized: stdPhone });
    }

    // Tra cứu xem có phải là External User ID của kênh không
    try {
      if (this.prisma.channelIdentity?.findFirst) {
        const idnt = await this.prisma.channelIdentity.findFirst({
          where: { externalUserId: identifier },
          select: { contactId: true },
        });
        if (idnt) {
          whereOr.push({ targetContactId: idnt.contactId });
          whereOr.push({ sourceContactId: idnt.contactId });
        }
      }
    } catch { }

    const logs = await this.prisma.contactMergeLog.findMany({
      where: {
        OR: whereOr,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      items: logs,
      total: logs.length,
    };
  }

  /**
   * Helper tìm danh sách Customer liên quan đến một Contact
   */
  private async findRelatedCustomers(contact: any): Promise<any[]> {
    const identities = contact.channelIdentities || [];
    const conditions: any[] = [];

    if (contact.phoneNormalized) {
      conditions.push({ phone: contact.phoneNormalized });
    }

    for (const idnt of identities) {
      conditions.push({
        channelIdentities: {
          path: [idnt.channel.toLowerCase()],
          equals: idnt.externalUserId,
        },
      });
      conditions.push({
        channelIdentities: {
          path: [idnt.channel.toLowerCase(), 'id'],
          equals: idnt.externalUserId,
        },
      });
      conditions.push({
        channelIdentities: {
          path: ['socialId'],
          equals: idnt.externalUserId,
        },
      });
    }

    if (conditions.length === 0) return [];

    return this.prisma.customer.findMany({
      where: { OR: conditions },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

