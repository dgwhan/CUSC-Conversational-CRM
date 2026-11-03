import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  deduplicateTags,
  tagSyncLogger,
  TAG_SYNC_STAGE,
  TAG_SYNC_ERROR_TYPE,
  TAG_EVENT_SOURCE,
} from '../domain/tag-mapping/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CustomerTagService {
  private readonly logger = new Logger(CustomerTagService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gỡ trực tiếp một tag khỏi khách hàng và hội thoại thông qua CRM
   */
  async removeCustomerTag(id: string, tagToRemove: string) {
    let existing: any = null;
    try {
      existing = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { id },
            { channelIdentities: { path: ['facebook'], equals: id } },
            { channelIdentities: { path: ['zalo'], equals: id } },
          ],
        },
        include: {
          conversations: {
            select: { id: true, tags: true },
          },
        },
      });
    } catch {
      existing = null;
    }

    if (!existing) {
      return { success: false, message: 'Customer not found' };
    }

    const identities = (existing.channelIdentities as any) || {};
    const currentIdentityTags: string[] = Array.isArray(identities.tags) ? identities.tags : [];
    const convTags: string[] = existing.conversations?.[0]?.tags || [];
    const allCurrent = Array.from(new Set([...currentIdentityTags, ...convTags]));

    const isTargetTag = (t: string) => {
      const lower = t.trim().toLowerCase();
      const removeLower = tagToRemove.trim().toLowerCase();
      if (lower === removeLower) return true;
      if (removeLower === 'lead' && (lower === 'facebook lead' || lower === 'fb lead')) return true;
      if ((removeLower === 'facebook lead' || removeLower === 'fb lead') && lower === 'lead') return true;
      return false;
    };

    const nextTags = allCurrent.filter((t) => !isTargetTag(t));
    const prevManuallyRemoved: string[] = Array.isArray(identities.manuallyRemovedTags) ? identities.manuallyRemovedTags : [];
    const tagsToMark = [tagToRemove];
    if (tagToRemove.trim().toLowerCase() === 'lead') {
      tagsToMark.push('Facebook Lead');
    } else if (tagToRemove.trim().toLowerCase() === 'facebook lead') {
      tagsToMark.push('Lead');
    }
    const manuallyRemovedTags = deduplicateTags([...prevManuallyRemoved, ...tagsToMark]);

    const updated = await this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        channelIdentities: {
          ...identities,
          tags: nextTags,
          manuallyRemovedTags,
        },
      },
    });

    if (this.prisma.conversation) {
      try {
        await this.prisma.conversation.updateMany({
          where: { customerId: existing.id },
          data: { tags: nextTags },
        });
      } catch (err) {
        tagSyncLogger.logError({
          stage: TAG_SYNC_STAGE.DELETE,
          errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
          message: `Không thể đồng bộ gỡ nhãn hội thoại trong CSDL: ${(err as Error).message}`,
          eventSource: TAG_EVENT_SOURCE.CRM_MANUAL_ACTION,
          customerId: existing.id,
          targetTags: nextTags,
          error: err,
        });
      }
    }

    this.logger.log(`Tư vấn viên gỡ tag "${tagToRemove}" khỏi khách hàng "${updated.fullName}" (${updated.id}) qua CRM`);

    return {
      success: true,
      id: updated.id,
      tags: nextTags,
      removedTag: tagToRemove,
    };
  }

  async syncConversationTags(customerId: string, conversationId?: string, cleanTags?: string[]) {
    try {
      const isConvUuid = conversationId && UUID_REGEX.test(conversationId);
      const convWhere = isConvUuid
        ? { id: conversationId }
        : { customerId };

      await this.prisma.conversation.updateMany({
        where: convWhere,
        data: {
          tags: cleanTags,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not update conversation tags: ${(err as Error).message}`);
      tagSyncLogger.logError({
        stage: TAG_SYNC_STAGE.UPDATE,
        errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
        message: `Không thể đồng bộ nhãn hội thoại vào CSDL: ${(err as Error).message}`,
        eventSource: TAG_EVENT_SOURCE.CRM_MANUAL_ACTION,
        customerId,
        conversationId,
        targetTags: cleanTags,
        error: err,
      });
    }
  }
}

