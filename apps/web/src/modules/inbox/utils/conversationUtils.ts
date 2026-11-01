import type { ChatMessage, ConversationItem, LeadStatus } from '../types.js';

/**
 * Chuẩn hóa hiển thị thời gian cho tin nhắn
 */
export const formatMessageTime = (timeStr?: string): string => {
  if (!timeStr || timeStr === 'Vừa xong') return 'Vừa xong';
  if (timeStr.includes('T') || (!timeStr.includes(':') && !isNaN(Date.parse(timeStr)))) {
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch { }
  }
  return timeStr;
};

/**
 * Khử trùng lặp tin nhắn dựa trên content + sentAt hoặc message ID
 */
export const deduplicateMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const seenIds = new Set<string>();
  const seenContentTime = new Set<string>();
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.id && !msg.id.startsWith('temp-') && !msg.id.startsWith('msg-')) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);
    }

    const contentKey = `${msg.direction}_${(msg.content || '').trim()}_${formatMessageTime(msg.sentAt)}`;
    if (seenContentTime.has(contentKey)) continue;
    seenContentTime.add(contentKey);

    const existingIdx = result.findIndex((m) => {
      if (m.id === msg.id && msg.id && !msg.id.startsWith('temp-')) return true;
      if (
        m.direction === msg.direction &&
        (m.content || '').trim() === (msg.content || '').trim() &&
        (m.sentAt === msg.sentAt ||
          Math.abs(new Date(m.sentAt).getTime() - new Date(msg.sentAt).getTime()) < 5000 ||
          formatMessageTime(m.sentAt) === formatMessageTime(msg.sentAt))
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx !== -1) {
      if (
        msg.id &&
        !msg.id.startsWith('temp-') &&
        (result[existingIdx].id.startsWith('temp-') || result[existingIdx].id.startsWith('msg-'))
      ) {
        result[existingIdx] = msg;
      }
    } else {
      result.push(msg);
    }
  }

  return result.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
};

/**
 * Khử trùng lặp và gộp các cuộc hội thoại trùng khách hàng hoặc trùng kênh
 */
export const mergeDuplicateConversations = (
  conversations: ConversationItem[],
  excludedAvatars?: Set<string>,
): ConversationItem[] => {
  const merged: ConversationItem[] = [];

  const isRealName = (name?: string) =>
    Boolean(
      name &&
      name.length > 1 &&
      !name.includes('#') &&
      !name.toLowerCase().startsWith('khách hàng') &&
      !name.toLowerCase().startsWith('lead')
    );

  for (const conv of conversations) {
    const existingIdx = merged.findIndex((m) => {
      if (m.id === conv.id) return true;

      const mCust = m.customer;
      const cCust = conv.customer;

      if (mCust.id && cCust.id && mCust.id === cCust.id) return true;

      if (
        mCust.socialId &&
        cCust.socialId &&
        mCust.socialId !== 'khách' &&
        mCust.socialId !== 'anonymous' &&
        mCust.socialId === cCust.socialId
      ) {
        return true;
      }

      const mIdentities = mCust.channelIdentities || [];
      const cIdentities = cCust.channelIdentities || [];
      for (const mId of mIdentities) {
        for (const cId of cIdentities) {
          if (
            mId.channel === cId.channel &&
            mId.externalUserId &&
            mId.externalUserId === cId.externalUserId
          ) {
            return true;
          }
        }
      }

      if (
        mCust.phone &&
        cCust.phone &&
        mCust.phone !== 'Chưa có SĐT' &&
        mCust.phone === cCust.phone
      ) {
        return true;
      }

      if (
        mCust.email &&
        cCust.email &&
        mCust.email !== 'Chưa có Email' &&
        mCust.email.toLowerCase() === cCust.email.toLowerCase()
      ) {
        return true;
      }

      if (
        isRealName(mCust.fullName) &&
        isRealName(cCust.fullName) &&
        mCust.fullName.trim().toLowerCase() === cCust.fullName.trim().toLowerCase()
      ) {
        if (m.channel === conv.channel) {
          return true;
        }
      }

      // Gộp placeholder 'Khách hàng' hoặc 'Khách hàng Zalo #xxxx' nếu trùng ảnh hoặc trùng trích dẫn
      const isPlaceholder = (n?: string) =>
        !n || n === 'Khách hàng' || n.startsWith('Khách hàng Zalo #') || n.startsWith('Lead');
      if (
        m.channel === conv.channel &&
        (isPlaceholder(mCust.fullName) || isPlaceholder(cCust.fullName)) &&
        ((mCust.avatarUrl && cCust.avatarUrl && mCust.avatarUrl === cCust.avatarUrl && !mCust.avatarUrl.includes('ui-avatars.com')) ||
          (m.snippet && conv.snippet && m.snippet.trim() === conv.snippet.trim()))
      ) {
        return true;
      }

      return false;
    });

    if (existingIdx === -1) {
      merged.push({ ...conv, messages: deduplicateMessages(conv.messages) });
    } else {
      const target = merged[existingIdx];

      // Gộp và khử trùng lặp toàn bộ tin nhắn, sắp xếp theo thời gian
      const combinedMessages = deduplicateMessages([...target.messages, ...conv.messages]);

      // Gộp các nhãn phân loại (tags), ánh xạ Facebook Lead sang Lead và khử trùng lặp
      const rawCombined = [
        ...(target.customer?.tags || target.tags || []),
        ...(conv.customer?.tags || conv.tags || []),
      ];
      const normalizedMapped = rawCombined.map((t) =>
        t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t.trim()
      );
      const allTags = Array.from(new Set(normalizedMapped));
      const filteredTags =
        allTags.length > 1 && allTags.some((t) => t !== 'Khách hàng mới')
          ? allTags.filter((t) => t !== 'Khách hàng mới')
          : allTags;

      // Ưu tiên trạng thái Lead cao hơn
      const priority: Record<LeadStatus, number> = {
        CONVERTED: 4,
        POTENTIAL: 3,
        UNQUALIFIED: 2,
        NEW: 1,
      };
      const finalStatus =
        (priority[target.customer.leadStatus] || 0) >= (priority[conv.customer.leadStatus] || 0)
          ? target.customer.leadStatus
          : conv.customer.leadStatus;

      // Ưu tiên Avatar ảnh thật của khách hàng, bỏ qua avatar của tư vấn viên
      const preferAvatar = (a1?: string, a2?: string) => {
        if (a1 && excludedAvatars?.has(a1)) a1 = undefined;
        if (a2 && excludedAvatars?.has(a2)) a2 = undefined;
        if (a1 && !a1.includes('ui-avatars.com')) return a1;
        if (a2 && !a2.includes('ui-avatars.com')) return a2;
        return a1 || a2 || '';
      };

      const finalFullName = isRealName(target.customer.fullName)
        ? target.customer.fullName
        : isRealName(conv.customer.fullName)
          ? conv.customer.fullName
          : target.customer.fullName;

      const latestMsg = combinedMessages[combinedMessages.length - 1];

      const finalChannel =
        target.channel === 'ZALO_PERSONAL' || conv.channel === 'ZALO_PERSONAL'
          ? 'ZALO_PERSONAL'
          : target.channel;
      const finalChannelAccountName =
        (target.channelAccountName && !target.channelAccountName.startsWith('Kênh ') && target.channelAccountName) ||
        (conv.channelAccountName && !conv.channelAccountName.startsWith('Kênh ') && conv.channelAccountName) ||
        target.channelAccountName ||
        conv.channelAccountName;

      merged[existingIdx] = {
        ...target,
        channel: finalChannel,
        channelAccountName: finalChannelAccountName,
        snippet: latestMsg?.content || target.snippet || conv.snippet,
        lastMessageAt: latestMsg?.sentAt || target.lastMessageAt || conv.lastMessageAt,
        unreadCount: (target.unreadCount || 0) + (conv.unreadCount || 0),
        tags: filteredTags,
        customer: {
          ...target.customer,
          ...conv.customer,
          channel: finalChannel,
          channelAccountName: finalChannelAccountName,
          fullName: finalFullName,
          avatarUrl: preferAvatar(target.customer.avatarUrl, conv.customer.avatarUrl),
          leadStatus: finalStatus,
          leadStage: target.customer.leadStage || conv.customer.leadStage,
          tags: filteredTags,
          phone: target.customer.phone !== 'Chưa có SĐT' ? target.customer.phone : conv.customer.phone,
          email: target.customer.email !== 'Chưa có Email' ? target.customer.email : conv.customer.email,
        },
        messages: combinedMessages,
      };
    }
  }

  return merged.sort((a, b) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });
};

