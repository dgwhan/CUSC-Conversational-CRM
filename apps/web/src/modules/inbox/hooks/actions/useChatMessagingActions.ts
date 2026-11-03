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

/**
 * Phân giải Facebook recipientId (ưu tiên chuỗi số PSID từ Meta)
 */
export const extractFacebookRecipientId = (conv: ConversationItem): string => {
  const identitiesObj = conv.customer.channelIdentities as any;
  const fbIdentity =
    identitiesObj?.facebook?.id ||
    (typeof identitiesObj?.facebook === 'string' ? identitiesObj.facebook : undefined) ||
    (Array.isArray(identitiesObj)
      ? identitiesObj.find((id: any) => String(id.channel).toUpperCase() === 'FACEBOOK')?.externalUserId
      : undefined);

  if (fbIdentity && /^\d+$/.test(String(fbIdentity).trim())) {
    return String(fbIdentity).trim();
  }

  // Nếu socialId có dạng FACEBOOK_pageId_psid hoặc số thuần túy
  const socialId = conv.customer.socialId;
  if (socialId && socialId !== 'khách' && !socialId.startsWith('cust-')) {
    if (socialId.includes('_')) {
      const parts = socialId.split('_');
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) return lastPart;
    }
    if (/^\d+$/.test(socialId)) {
      return socialId;
    }
  }

  // Thử trích xuất từ tin nhắn INBOUND gần nhất
  const lastInbound = [...conv.messages]
    .reverse()
    .find((m) => m.direction === 'INBOUND' && (m as any).senderExternalId);
  const senderExt = (lastInbound as any)?.senderExternalId;
  if (senderExt && /^\d+$/.test(String(senderExt).trim())) {
    return String(senderExt).trim();
  }

  // Fallback: truyền socialId hoặc customer.id để backend tiếp tục phân giải từ DB
  return socialId && socialId !== 'khách' && !socialId.startsWith('cust-')
    ? socialId
    : conv.customer.id;
};

/**
 * Phân giải Zalo recipientId (Zalo UID dạng số hoặc số điện thoại)
 */
export const extractZaloRecipientId = (conv: ConversationItem): string => {
  const identitiesObj = conv.customer.channelIdentities as any;
  const customerZaloId =
    identitiesObj?.zalo?.id ||
    (typeof identitiesObj?.zalo === 'string' ? identitiesObj.zalo : undefined) ||
    (Array.isArray(identitiesObj)
      ? identitiesObj.find((id: any) => String(id.channel).toUpperCase() === 'ZALO')?.externalUserId
      : undefined);

  if (customerZaloId && /^\d+$/.test(String(customerZaloId).trim())) {
    return String(customerZaloId).trim();
  }

  const socialId = conv.customer.socialId;
  if (socialId && socialId !== 'khách' && !socialId.startsWith('cust-')) {
    return socialId;
  }

  return conv.customer.id;
};

/**
 * Gửi tin nhắn qua FACEBOOK Channel (Meta Graph API)
 */
const sendFacebookMessage = async (
  conv: ConversationItem,
  text: string,
  _attachments?: MessageAttachment[]
) => {
  const recipientId = extractFacebookRecipientId(conv);
  return apiClient.sendMessage({
    channel: 'FACEBOOK',
    recipientId,
    content: text,
    conversationId: conv.id,
    channelAccountId: conv.channelAccountId,
  });
};

/**
 * Gửi tin nhắn qua ZALO Channel (Zalo OA hoặc Zalo Cá Nhân)
 */
const sendZaloMessage = async (
  conv: ConversationItem,
  text: string,
  _attachments?: MessageAttachment[]
) => {
  const recipientId = extractZaloRecipientId(conv);
  return apiClient.sendMessage({
    channel: conv.channel,
    recipientId,
    content: text,
    conversationId: conv.id,
    channelAccountId: conv.channelAccountId,
  });
};

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

    // 2. Gửi thực tế qua API Outbound tương ứng (Tách riêng Facebook & Zalo)
    try {
      let res;
      const channelUpper = String(currentConv.channel || '').toUpperCase();

      if (channelUpper.includes('FACEBOOK') || channelUpper.includes('FB')) {
        res = await sendFacebookMessage(currentConv, text, attachments);
      } else if (channelUpper.includes('ZALO')) {
        res = await sendZaloMessage(currentConv, text, attachments);
      } else {
        res = await apiClient.sendMessage({
          channel: currentConv.channel,
          recipientId: currentConv.customer.socialId || currentConv.customer.id,
          content: text,
          conversationId: currentConv.id,
          channelAccountId: currentConv.channelAccountId,
        });
      }

      // 3. Cập nhật trạng thái tin nhắn thành DELIVERED và đồng bộ messageId thực tế
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

  return { handleSendMessage, sendFacebookMessage, sendZaloMessage };
};
