import React from 'react';
import type {
  ConversationItem,
  ChatMessage,
  MessageAttachment,
} from '../../types.js';
import { deduplicateMessages } from '../../utils/conversationUtils.js';
import { apiClient } from '../../../../lib/api-client.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

interface UseChatMessagingActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
}

export const useChatMessagingActions = ({
  currentConv,
  setConversations,
  staffName,
}: UseChatMessagingActionsProps) => {
  const handleSendMessage = async (text: string, attachments?: MessageAttachment[]) => {
    if (!currentConv) return;

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newMsg: ChatMessage = {
      id: tempId,
      conversationId: currentConv.id,
      direction: 'OUTBOUND' as const,
      content: text,
      sentAt: nowIso,
      senderName: staffName ? `${staffName} (Bạn)` : 'Bạn',
      status: 'SENT' as const,
      attachments,
    };

    // 1. Cập nhật Optimistic UI ngay lập tức
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          snippet: text || (attachments ? `[Đính kèm ${attachments.length} tệp]` : ''),
          lastMessageAt: nowIso,
          messages: deduplicateMessages([...c.messages, newMsg]),
        };
      })
    );

    // 2. Gửi thực tế qua API Outbound của kênh tương ứng (ZALO, FACEBOOK...)
    try {
      const identitiesObj = currentConv.customer.channelIdentities as any;
      const customerZaloId =
        identitiesObj?.zalo?.id ||
        (typeof identitiesObj?.zalo === 'string' ? identitiesObj.zalo : undefined) ||
        (Array.isArray(identitiesObj)
          ? identitiesObj.find((id: any) => id.channel === 'ZALO')?.externalUserId
          : undefined);

      const recipientId =
        ((currentConv.channel === 'ZALO' || currentConv.channel === 'ZALO_PERSONAL') && customerZaloId) ||
        (currentConv.customer.socialId &&
          currentConv.customer.socialId !== 'khách' &&
          !currentConv.customer.socialId.startsWith('cust-')
          ? currentConv.customer.socialId
          : '') ||
        currentConv.customer.id;

      const res = await apiClient.sendMessage({
        channel: currentConv.channel,
        recipientId,
        content: text,
        conversationId: currentConv.id,
      });

      // 3. Cập nhật trạng thái tin nhắn thành DELIVERED và đồng bộ messageId
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConv.id) return c;

          const hasRealMsg = Boolean(
            res.messageId && c.messages.some((m) => m.id === res.messageId && m.id !== tempId)
          );

          let updatedMessages: ChatMessage[];
          if (hasRealMsg) {
            updatedMessages = c.messages.filter((m) => m.id !== tempId);
          } else {
            updatedMessages = c.messages.map((m) =>
              m.id === tempId ? { ...m, id: res.messageId || m.id, status: 'DELIVERED' as const } : m
            );
          }

          return {
            ...c,
            messages: deduplicateMessages(updatedMessages),
          };
        })
      );
    } catch (err) {
      notify.error(
        `Không thể gửi tin nhắn qua ${currentConv.channel}: ${(err as Error).message}`,
        'Lỗi gửi tin'
      );
    }
  };

  return { handleSendMessage };
};
