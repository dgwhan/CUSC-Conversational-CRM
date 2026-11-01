import type { ChatMessage, ConversationItem, LeadStatus } from '../types.js';
import { standardizeVietnamesePhoneNumber } from '../../../lib/phone.js';

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
 * Khử trùng lặp và gộp các cuộc hội thoại trùng kênh,
 * ĐỒNG THỜI giữ tách biệt các cuộc hội thoại khác kênh và định danh chung về 1 Customer (CUS-04).
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

      // CUS-04: KHÔNG gộp 2 cuộc hội thoại thuộc 2 kênh khác nhau thành 1 cuộc hội thoại!
      // Mỗi kênh giữ nguyên cuộc hội thoại riêng rẽ để tư vấn viên chat đúng kênh.
      // Chỉ gộp khi CÙNG KÊNH:
      const isSameChannel =
        m.channel === conv.channel ||
        ((m.channel === 'ZALO' || m.channel === 'ZALO_PERSONAL') &&
          (conv.channel === 'ZALO' || conv.channel === 'ZALO_PERSONAL'));

      if (!isSameChannel) {
        return false;
      }

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
        isRealName(mCust.fullName) &&
        isRealName(cCust.fullName) &&
        mCust.fullName.trim().toLowerCase() === cCust.fullName.trim().toLowerCase()
      ) {
        return true;
      }

      // Gộp placeholder 'Khách hàng' hoặc 'Khách hàng Zalo #xxxx' nếu trùng ảnh hoặc trùng trích dẫn
      const isPlaceholder = (n?: string) =>
        !n || n === 'Khách hàng' || n.startsWith('Khách hàng Zalo #') || n.startsWith('Lead');
      if (
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
      const combinedMessages = deduplicateMessages([...target.messages, ...conv.messages]);
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

  // CUS-04: ĐỒNG BỘ ĐỊNH DANH 2 SỐ ĐIỆN THOẠI TRÙNG VỀ 1 CUSTOMER
  // (Giữ nguyên 2 cuộc hội thoại riêng biệt trong danh sách, nhưng gộp chung Customer Profile & Identities)
  const phoneCustomerMap = new Map<string, {
    contactId?: string;
    customerId?: string;
    fullName: string;
    avatarUrl: string;
    phone: string;
    email: string;
    tags: string[];
    leadStatus: LeadStatus;
    leadStage?: any;
    interestCourses: string[];
    estimatedValue: number;
    identities: any[];
    linkedConversations: { id: string; channel: any; channelAccountName?: string }[];
  }>();

  for (const item of merged) {
    const rawPhone = item.customer.phone;
    const stdPhone = rawPhone && rawPhone !== 'Chưa có SĐT' ? standardizeVietnamesePhoneNumber(rawPhone) : null;
    const groupKey = stdPhone || (item.customer.id && !item.customer.id.startsWith('cust-conv_') ? item.customer.id : null);
    if (!groupKey) continue;

    const existingGroup = phoneCustomerMap.get(groupKey);
    const itemIdentities = item.customer.channelIdentities && item.customer.channelIdentities.length > 0
      ? item.customer.channelIdentities
      : (item.customer.socialId ? [{ channel: item.channel, externalUserId: item.customer.socialId }] : []);

    if (!existingGroup) {
      phoneCustomerMap.set(groupKey, {
        contactId: item.customer.contactId,
        customerId: item.customer.id,
        fullName: item.customer.fullName,
        avatarUrl: item.customer.avatarUrl,
        phone: rawPhone || 'Chưa có SĐT',
        email: item.customer.email || 'Chưa có Email',
        tags: item.customer.tags || [],
        leadStatus: item.customer.leadStatus,
        leadStage: item.customer.leadStage,
        interestCourses: item.customer.interestCourses || [],
        estimatedValue: item.customer.estimatedValue || 0,
        identities: [...itemIdentities],
        linkedConversations: [{ id: item.id, channel: item.channel, channelAccountName: item.channelAccountName }],
      });
    } else {
      // Gộp identities đa kênh
      const idMap = new Map<string, any>();
      for (const idnt of [...existingGroup.identities, ...itemIdentities]) {
        idMap.set(`${idnt.channel}_${idnt.externalUserId}`, idnt);
      }
      existingGroup.identities = Array.from(idMap.values());
      if (item.customer.contactId && !existingGroup.contactId) {
        existingGroup.contactId = item.customer.contactId;
      }
      if (item.customer.id && !existingGroup.customerId) {
        existingGroup.customerId = item.customer.id;
      }

      if (isRealName(item.customer.fullName) && !isRealName(existingGroup.fullName)) {
        existingGroup.fullName = item.customer.fullName;
      }
      if (item.customer.avatarUrl && !item.customer.avatarUrl.includes('ui-avatars.com') && existingGroup.avatarUrl.includes('ui-avatars.com')) {
        existingGroup.avatarUrl = item.customer.avatarUrl;
      }
      existingGroup.tags = Array.from(new Set([...existingGroup.tags, ...(item.customer.tags || [])]));
      existingGroup.interestCourses = Array.from(new Set([...existingGroup.interestCourses, ...(item.customer.interestCourses || [])]));
      if (item.customer.estimatedValue && item.customer.estimatedValue > existingGroup.estimatedValue) {
        existingGroup.estimatedValue = item.customer.estimatedValue;
      }
      if (rawPhone && rawPhone !== 'Chưa có SĐT' && existingGroup.phone === 'Chưa có SĐT') {
        existingGroup.phone = rawPhone;
      }
      existingGroup.linkedConversations.push({ id: item.id, channel: item.channel, channelAccountName: item.channelAccountName });
    }
  }

  // Áp dụng định danh thống nhất cho từng cuộc hội thoại
  for (const item of merged) {
    const rawPhone = item.customer.phone;
    const stdPhone = rawPhone && rawPhone !== 'Chưa có SĐT' ? standardizeVietnamesePhoneNumber(rawPhone) : null;
    const groupKey = stdPhone || (item.customer.id && !item.customer.id.startsWith('cust-conv_') ? item.customer.id : null);
    if (groupKey && phoneCustomerMap.has(groupKey)) {
      const unified = phoneCustomerMap.get(groupKey)!;
      item.customer = {
        ...item.customer,
        contactId: unified.contactId || item.customer.contactId,
        fullName: unified.fullName,
        avatarUrl: unified.avatarUrl,
        phone: unified.phone,
        email: unified.email,
        tags: unified.tags,
        leadStatus: unified.leadStatus,
        leadStage: unified.leadStage || item.customer.leadStage,
        interestCourses: unified.interestCourses,
        estimatedValue: unified.estimatedValue,
        channelIdentities: unified.identities,
        linkedConversations: unified.linkedConversations.filter((lc) => lc.id !== item.id),
      };
    }
  }

  return merged.sort((a, b) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });
};
