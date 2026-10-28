import React, { useState, useEffect } from 'react';
import type {
  ConversationItem,
  LeadStatus,
  LeadStage,
  MessageAttachment,
  AssignedStaff,
  ChatMessage,
  QuickReplyItem,
} from '../types.js';
import { INITIAL_CONVERSATIONS, MOCK_QUICK_REPLIES } from '../mockData.js';
import { ConversationListColumn } from '../components/ConversationListColumn.js';
import { ChatWindowColumn } from '../components/ChatWindowColumn.js';
import { CustomerProfileColumn } from '../components/CustomerProfileColumn.js';
import { QuickReplyModal } from '../components/QuickReplyModal.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';
import { useUserRole } from '../../auth/index.js';
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';
import { apiClient } from '../../../lib/api-client.js';
import { MessageSquare } from 'lucide-react';

interface UnifiedInboxPageProps {
  onNavigateToKanban?: () => void;
  initialConversationId?: string | null;
}

// Hàm tiện ích hợp nhất các cuộc hội thoại trùng lặp của cùng một khách hàng
export const mergeDuplicateConversations = (conversations: ConversationItem[]): ConversationItem[] => {
  const isRealName = (name?: string) =>
    Boolean(
      name &&
      name.trim().length > 1 &&
      !name.includes('#') &&
      !name.toLowerCase().startsWith('khách hàng') &&
      !name.toLowerCase().startsWith('lead')
    );

  const merged: ConversationItem[] = [];

  for (const conv of conversations) {
    const existingIdx = merged.findIndex((m) => {
      // 1. Khớp chính xác ID hội thoại
      if (m.id === conv.id) return true;

      // 2. Một trong 2 ID chứa ID còn lại (ví dụ FACEBOOK_pageId_senderId và FACEBOOK_senderId)
      if (m.id && conv.id && (m.id.includes(conv.id) || conv.id.includes(m.id))) return true;

      const mCust = m.customer;
      const cCust = conv.customer;
      if (!mCust || !cCust) return false;

      // 3. Khớp ID khách hàng trong database
      if (
        mCust.id &&
        cCust.id &&
        mCust.id === cCust.id &&
        !mCust.id.startsWith('cust-') &&
        !cCust.id.startsWith('cust-')
      ) {
        return true;
      }

      // 4. Khớp Social ID / External User ID (Facebook PSID / Zalo ID)
      const mSocial = mCust.socialId || mCust.channelIdentities?.[0]?.externalUserId;
      const cSocial = cCust.socialId || cCust.channelIdentities?.[0]?.externalUserId;
      if (
        mSocial &&
        cSocial &&
        mSocial !== 'anonymous' &&
        mSocial !== 'khách' &&
        mSocial === cSocial
      ) {
        return true;
      }

      // 5. Social ID của một bên nằm trong ID hội thoại của bên kia
      if (mSocial && mSocial !== 'khách' && mSocial !== 'anonymous' && conv.id.includes(mSocial)) return true;
      if (cSocial && cSocial !== 'khách' && cSocial !== 'anonymous' && m.id.includes(cSocial)) return true;

      // 6. Khớp Tên thật của khách hàng trong cùng kênh liên lạc
      if (
        m.channel === conv.channel &&
        isRealName(mCust.fullName) &&
        isRealName(cCust.fullName) &&
        mCust.fullName.trim().toLowerCase() === cCust.fullName.trim().toLowerCase()
      ) {
        return true;
      }

      // 7. Khớp Số điện thoại hoặc Email
      if (mCust.phone && cCust.phone && mCust.phone !== 'Chưa có SĐT' && mCust.phone === cCust.phone) {
        return true;
      }
      if (mCust.email && cCust.email && mCust.email !== 'Chưa có Email' && mCust.email === cCust.email) {
        return true;
      }

      return false;
    });

    if (existingIdx === -1) {
      merged.push({ ...conv });
    } else {
      const target = merged[existingIdx];

      // Gộp và khử trùng lặp toàn bộ tin nhắn, sắp xếp theo thời gian
      const seenMsgIds = new Set<string>();
      const combinedMessages: ChatMessage[] = [];
      for (const msg of [...target.messages, ...conv.messages]) {
        const msgKey = msg.id || `${msg.direction}_${msg.content}_${msg.sentAt}`;
        if (!seenMsgIds.has(msgKey)) {
          seenMsgIds.add(msgKey);
          combinedMessages.push(msg);
        }
      }

      // Gộp các nhãn phân loại (tags), ưu tiên giữ nhãn cụ thể như 'Facebook Lead', 'lead'
      const allTags = Array.from(new Set([...(target.tags || []), ...(conv.tags || [])]));
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

      // Ưu tiên Avatar ảnh thật
      const preferAvatar = (a1?: string, a2?: string) => {
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

      merged[existingIdx] = {
        ...target,
        snippet: latestMsg?.content || target.snippet || conv.snippet,
        lastMessageAt: latestMsg?.sentAt || target.lastMessageAt || conv.lastMessageAt,
        unreadCount: (target.unreadCount || 0) + (conv.unreadCount || 0),
        tags: filteredTags.length > 0 ? filteredTags : ['Facebook Lead'],
        customer: {
          ...target.customer,
          ...conv.customer,
          fullName: finalFullName,
          avatarUrl: preferAvatar(target.customer.avatarUrl, conv.customer.avatarUrl),
          leadStatus: finalStatus,
          leadStage: target.customer.leadStage || conv.customer.leadStage,
          tags: filteredTags.length > 0 ? filteredTags : ['Facebook Lead'],
          phone: target.customer.phone !== 'Chưa có SĐT' ? target.customer.phone : conv.customer.phone,
          email: target.customer.email !== 'Chưa có Email' ? target.customer.email : conv.customer.email,
        },
        messages: combinedMessages,
      };
    }
  }

  return merged;
};

export const UnifiedInboxPage: React.FC<UnifiedInboxPageProps> = ({
  onNavigateToKanban,
  initialConversationId,
}) => {
  const { onNewMessage, onPipelineChange, staffPresences, setUnreadCount } = useRealtime();
  const { staffName } = useUserRole();
  const { config } = useWorkspaceConfig();

  // Quản lý mẫu câu trả lời nhanh (Quick Replies) với persistence trong LocalStorage
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(() => {
    try {
      const saved = localStorage.getItem('polarisx_crm_quick_replies_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_QUICK_REPLIES;
  });
  const [isQuickReplyModalOpen, setIsQuickReplyModalOpen] = useState(false);

  const handleSaveQuickReplies = (replies: QuickReplyItem[]) => {
    setQuickReplies(replies);
    try {
      localStorage.setItem('polarisx_crm_quick_replies_v1', JSON.stringify(replies));
    } catch {}
  };

  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    try {
      const saved = localStorage.getItem('crm_inbox_conversations_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Làm sạch dữ liệu rác nếu trước đó bị lưu tên "#hách" vào cache trình duyệt
          const cleaned = parsed.map((c: ConversationItem) => {
            if (c.customer?.fullName?.includes('#hách')) {
              return {
                ...c,
                customer: {
                  ...c.customer,
                  fullName: 'Khách hàng Facebook',
                },
              };
            }
            return c;
          });
          // Tự động gộp các cuộc hội thoại trùng lặp của cùng một khách hàng
          return mergeDuplicateConversations(cleaned);
        }
      }
    } catch {}
    return INITIAL_CONVERSATIONS;
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialConversationId) return initialConversationId;
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return null;
    }
    return INITIAL_CONVERSATIONS[0]?.id || null;
  });
  const [isProfileMobileOpen, setIsProfileMobileOpen] = useState(false);
  const [isSyncingFb, setIsSyncingFb] = useState(false);

  // Tải các tin nhắn đã lưu trong CSDL khi vào trang Inbox & ánh xạ khớp với dữ liệu khách hàng
  const loadSavedMessages = async () => {
    try {
      const [messagesRes, customersRes] = await Promise.all([
        apiClient.getMessages({ limit: 100 }),
        apiClient.getCustomers().catch(() => null),
      ]);
      if (!messagesRes?.items || messagesRes.items.length === 0) return;

      // Xây dựng bản đồ khách hàng từ cơ sở dữ liệu để gán chuẩn tên thật & avatar thật (đồng bộ với Kanban)
      const customerMap = new Map<string, any>();
      if (customersRes?.items) {
        for (const cust of customersRes.items) {
          if (cust.id) customerMap.set(cust.id, cust);
          const fbId = cust.channelIdentities?.facebook || cust.channelIdentities?.socialId;
          if (fbId) customerMap.set(String(fbId), cust);
          const zaloId = cust.channelIdentities?.zalo;
          if (zaloId) customerMap.set(String(zaloId), cust);
          if (cust.fullName) customerMap.set(cust.fullName, cust);
          if (cust.phone) customerMap.set(cust.phone, cust);
        }
      }

      const groups: Record<string, typeof messagesRes.items> = {};
      for (const item of messagesRes.items) {
        const raw = (item as any).rawPayload || {};
        const isOut = item.direction === 'OUTBOUND';
        // Đối với tin OUTBOUND, người đối thoại là recipient chứ không phải Page
        const recipientId = raw.recipient?.id || raw.to?.data?.[0]?.id || raw.to?.id;
        const senderId = String(
          (isOut && recipientId) ||
          item.senderExternalId ||
          raw.senderExternalId ||
          raw.sender?.id ||
          raw.from?.id ||
          (item as any).conversation?.customer?.channelIdentities?.facebook ||
          (item as any).conversation?.customerId ||
          'anonymous'
        );

        const channelAccountExtId = item.channelAccount?.externalAccountId;
        const convId = item.channel === 'FACEBOOK' && channelAccountExtId
          ? `FACEBOOK_${channelAccountExtId}_${senderId}`
          : `${item.channel}_${senderId}`;

        if (!groups[convId]) groups[convId] = [];
        groups[convId].push(item);
      }

      setConversations((prev) => {
        let updated = [...prev];
        for (const [convId, groupItems] of Object.entries(groups)) {
          const sorted = [...groupItems].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          );
          const latest = sorted[sorted.length - 1];
          const firstInbound = sorted.find((m) => m.direction === 'INBOUND') || latest;
          const channelName = latest.channelAccount?.displayName || `Kênh ${latest.channel}`;

          const latestSenderId = String(
            latest.senderExternalId ||
            (latest as any).rawPayload?.senderExternalId ||
            (latest as any).rawPayload?.sender?.id ||
            (latest as any).rawPayload?.from?.id ||
            'khách'
          );
          const latestSuffix = latestSenderId.length > 4 ? latestSenderId.slice(-4) : latestSenderId;
          const convCustomer = (latest as any).conversation?.customer;
          const matchedCust =
            convCustomer ||
            customerMap.get((latest as any).conversation?.customerId) ||
            customerMap.get(latestSenderId) ||
            (convCustomer?.fullName ? customerMap.get(convCustomer.fullName) : null);

          const rawCustomerName =
            matchedCust?.fullName ||
            (latest as any).customerName ||
            (latest as any).rawPayload?.customerName ||
            `Khách hàng ${latest.channel === 'ZALO' ? 'Zalo' : latest.channel === 'FACEBOOK' ? 'Facebook' : latest.channel} #${latestSuffix}`;

          const rawCustomerAvatar =
            matchedCust?.avatarUrl ||
            (latest as any).customerAvatar ||
            (latest as any).rawPayload?.customerAvatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(rawCustomerName)}&background=0284c7&color=fff&bold=true`;

          const formattedMessages: ChatMessage[] = sorted.map((m) => {
            const senderId = String(m.senderExternalId || 'khách');
            const suffix = senderId.length > 4 ? senderId.slice(-4) : senderId;
            const itemCustomerName = (m as any).customerName || matchedCust?.fullName;
            return {
              id: m.id,
              conversationId: convId,
              direction: m.direction,
              content: m.content || '',
              sentAt: m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              senderName: m.direction === 'OUTBOUND' ? channelName : (itemCustomerName || `Khách (${suffix})`),
              status: 'DELIVERED',
            };
          });

          const isRealName = (n?: string) =>
            Boolean(n && n.length > 1 && !n.includes('#') && !n.toLowerCase().startsWith('khách hàng') && !n.toLowerCase().startsWith('lead'));

          const existingIndex = updated.findIndex((c) => {
            if (c.id === convId) return true;
            if (c.id.includes(convId) || convId.includes(c.id)) return true;
            if (latestSenderId && latestSenderId !== 'khách' && latestSenderId !== 'anonymous') {
              if (c.customer.socialId === latestSenderId || c.id.includes(latestSenderId)) return true;
            }
            if (matchedCust?.id && c.customer.id === matchedCust.id) return true;
            if (
              isRealName(rawCustomerName) &&
              isRealName(c.customer.fullName) &&
              c.customer.fullName.trim().toLowerCase() === rawCustomerName.trim().toLowerCase()
            ) {
              return true;
            }
            return false;
          });

          if (existingIndex >= 0) {
            const existing = updated[existingIndex];
            const existingIds = new Set(existing.messages.map((m) => m.id));
            const newMsgs = formattedMessages.filter((m) => !existingIds.has(m.id));

            const shouldUpdateCustomer =
              (matchedCust || (latest as any).customerName) &&
              (existing.customer.fullName.includes('#') || existing.customer.fullName.includes('Khách hàng') || !existing.customer.avatarUrl);

            const identitiesList =
              matchedCust?.channelIdentitiesList ||
              (latestSenderId && latestSenderId !== 'anonymous' && latestSenderId !== 'khách'
                ? [{ channel: latest.channel, externalUserId: latestSenderId }]
                : []);

            updated[existingIndex] = {
              ...existing,
              snippet: latest.content || existing.snippet,
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              customer: shouldUpdateCustomer
                ? {
                    ...existing.customer,
                    contactId: matchedCust?.contact?.id || existing.customer.contactId,
                    channelIdentities: identitiesList.length ? identitiesList : existing.customer.channelIdentities,
                    fullName: rawCustomerName,
                    avatarUrl: rawCustomerAvatar,
                    phone: matchedCust?.phone || existing.customer.phone,
                    email: matchedCust?.email || existing.customer.email,
                    leadStatus: (matchedCust?.leadStatus as any) || existing.customer.leadStatus,
                    leadStage: matchedCust?.leadStage || existing.customer.leadStage,
                    interestCourses: existing.customer.interestCourses?.length
                      ? existing.customer.interestCourses
                      : (matchedCust?.interestCourses || []),
                    estimatedValue: existing.customer.estimatedValue || matchedCust?.estimatedValue || 0,
                  }
                : {
                    ...existing.customer,
                    contactId: matchedCust?.contact?.id || existing.customer.contactId,
                    channelIdentities: identitiesList.length ? identitiesList : existing.customer.channelIdentities,
                    leadStatus: (matchedCust?.leadStatus as any) || existing.customer.leadStatus,
                    leadStage: matchedCust?.leadStage || existing.customer.leadStage,
                    interestCourses: existing.customer.interestCourses?.length
                      ? existing.customer.interestCourses
                      : (matchedCust?.interestCourses || []),
                    estimatedValue: existing.customer.estimatedValue || matchedCust?.estimatedValue || 0,
                  },
              messages: newMsgs.length > 0 ? [...existing.messages, ...newMsgs] : existing.messages,
            };
          } else {
            const identitiesList =
              matchedCust?.channelIdentitiesList ||
              (latestSenderId && latestSenderId !== 'anonymous' && latestSenderId !== 'khách'
                ? [{ channel: latest.channel, externalUserId: latestSenderId }]
                : []);

            const newConv: ConversationItem = {
              id: convId,
              channel: latest.channel as any,
              channelAccountName: channelName,
              snippet: latest.content || 'Tin nhắn mới',
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              lastCustomerMessageAt: firstInbound.sentAt,
              unreadCount: 0,
              tags:
                Array.isArray((latest as any).tags) && (latest as any).tags.length > 0
                  ? (latest as any).tags
                  : Array.isArray((latest as any).rawPayload?.tags) && (latest as any).rawPayload.tags.length > 0
                  ? (latest as any).rawPayload.tags
                  : ['Facebook Lead'],
              status: 'OPEN',
              customer: {
                id: matchedCust?.id || convCustomer?.id || (latestSenderId !== 'anonymous' && latestSenderId !== 'khách' ? `cust-${latestSenderId}` : `cust-${convId}`),
                contactId: matchedCust?.contact?.id,
                channelIdentities: identitiesList,
                fullName: rawCustomerName,
                phone: matchedCust?.phone || 'Chưa có SĐT',
                email: matchedCust?.email || 'Chưa có Email',
                avatarUrl: rawCustomerAvatar,
                socialId: latestSenderId,
                channel: latest.channel as any,
                channelAccountName: channelName,
                leadStatus: (matchedCust?.leadStatus as any) || 'POTENTIAL',
                leadStage: matchedCust?.leadStage || undefined,
                tags:
                  Array.isArray((latest as any).tags) && (latest as any).tags.length > 0
                    ? (latest as any).tags
                    : Array.isArray((latest as any).rawPayload?.tags) && (latest as any).rawPayload.tags.length > 0
                    ? (latest as any).rawPayload.tags
                    : ['Facebook Lead'],
                interestCourses: matchedCust?.interestCourses || [],
                estimatedValue: matchedCust?.estimatedValue || 0,
                notes: [],
              },
              messages: formattedMessages,
            };
            updated.unshift(newConv);
          }
        }
        return mergeDuplicateConversations(updated);
      });
    } catch {
      // Backend có thể chưa khởi động hoặc chưa có tin nhắn
    }
  };

  useEffect(() => {
    loadSavedMessages();
  }, []);

  // Kéo các cuộc trò chuyện và tin nhắn mới nhất từ Meta Graph API của các Fanpage đã kết nối
  const handleSyncFacebook = async () => {
    setIsSyncingFb(true);
    notify.info('Đang kết nối Meta Graph API để kéo tin nhắn từ các Fanpage...', 'Đồng bộ Facebook');
    try {
      const channels = await apiClient.getChannels();
      const activeChannels = channels.filter(
        (c: any) => (c.channel === 'FACEBOOK' || c.channel === 'ZALO') && c.isActive,
      );

      if (activeChannels.length === 0) {
        notify.warning('Chưa có kênh Zalo hoặc Facebook nào được kích hoạt trong Workspace. Vui lòng kết nối kênh trước.');
        return;
      }

      let totalSynced = 0;
      for (const ch of activeChannels) {
        try {
          const res = await apiClient.syncChannel(ch.id as string);
          totalSynced += res.syncedCount;
        } catch (err) {
          notify.warning(`Không thể kéo tin từ ${(ch as any).displayName}: ${(err as Error).message}`);
        }
      }

      if (totalSynced > 0) {
        await loadSavedMessages();
        notify.success(`Đã kéo thành công ${totalSynced} tin nhắn từ Zalo & Facebook vào Hộp thư!`, 'Đồng bộ hoàn tất');
      } else {
        notify.info('Đã quét các kênh: Hiện chưa có tin nhắn khách hàng mới nào cần kéo về.');
      }
    } catch (err) {
      notify.error(`Lỗi khi đồng bộ: ${(err as Error).message}`);
    } finally {
      setIsSyncingFb(false);
    }
  };

  // Danh sách nhân viên tư vấn động từ trạng thái trực tuyến của Socket / Hệ thống
  const staffList: AssignedStaff[] = Object.values(staffPresences).map((s) => ({
    id: s.staffId,
    name: s.name,
    avatar: s.avatar,
    role: s.role,
  }));

  // Cập nhật selectedId nếu initialConversationId thay đổi từ bên ngoài (ví dụ bấm Chat từ Kanban)
  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
    }
  }, [initialConversationId]);

  // Lắng nghe sự kiện tin nhắn thời gian thực qua WebSocket
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      setConversations((prev) => {
        const targetId = msg.conversationId || `conv-${Date.now()}`;
        const isRealName = (name?: string) =>
          Boolean(
            name &&
            name.trim().length > 1 &&
            !name.includes('#') &&
            !name.toLowerCase().startsWith('khách hàng') &&
            !name.toLowerCase().startsWith('lead')
          );

        // Tìm kiếm cuộc hội thoại tương ứng trong danh sách
        const existingIdx = prev.findIndex((c) => {
          // 1. Khớp chính xác ID hội thoại
          if (c.id === targetId) return true;
          // 2. Một trong 2 ID chứa ID còn lại
          if (msg.conversationId && (c.id.includes(msg.conversationId) || msg.conversationId.includes(c.id))) return true;
          // 3. ID của tin nhắn nằm trong ID hội thoại
          if (msg.id && c.id.includes(msg.id)) return true;
          // 4. Khớp theo Tên thật của khách hàng
          if (
            msg.senderName &&
            isRealName(msg.senderName) &&
            isRealName(c.customer.fullName) &&
            c.customer.fullName.trim().toLowerCase() === msg.senderName.trim().toLowerCase()
          ) {
            return true;
          }
          // 5. Khớp Số điện thoại
          if (
            msg.customerPhone &&
            c.customer.phone &&
            c.customer.phone !== 'Chưa có SĐT' &&
            c.customer.phone === msg.customerPhone
          ) {
            return true;
          }
          // 6. Khớp Email
          if (
            msg.customerEmail &&
            c.customer.email &&
            c.customer.email !== 'Chưa có Email' &&
            c.customer.email === msg.customerEmail
          ) {
            return true;
          }
          return false;
        });

        const matchedConvId = existingIdx >= 0 ? prev[existingIdx].id : targetId;
        const newChatMsg = {
          id: msg.id || `msg-${Date.now()}`,
          conversationId: matchedConvId,
          direction: msg.direction || ('INBOUND' as const),
          content: msg.content,
          sentAt: msg.sentAt || 'Vừa xong',
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          status: 'DELIVERED' as const,
        };

        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const isCurrentlyOpen = existing.id === selectedId;

          const updatedTarget: ConversationItem = {
            ...existing,
            snippet: msg.content,
            lastMessageAt: 'Vừa xong',
            lastCustomerMessageAt: new Date().toISOString(),
            unreadCount: isCurrentlyOpen ? 0 : (existing.unreadCount || 0) + 1,
            customer: {
              ...existing.customer,
              avatarUrl:
                msg.senderAvatar && !msg.senderAvatar.includes('ui-avatars.com')
                  ? msg.senderAvatar
                  : existing.customer.avatarUrl,
            },
            messages: [...existing.messages, newChatMsg],
          };

          // Đưa hội thoại vừa có tương tác mới lên đầu danh sách
          const remaining = prev.filter((_, idx) => idx !== existingIdx);
          return [updatedTarget, ...remaining];
        }

        // Tự động tạo cuộc hội thoại mới khi nhận được tin nhắn từ khách hàng mới chưa từng có trong hệ thống
        const isFb = msg.channel === 'FACEBOOK';
        const defaultTags = isFb ? ['Facebook Lead'] : ['Khách hàng mới'];

        const newConv: ConversationItem = {
          id: targetId,
          channel: msg.channel,
          channelAccountName: `Kênh ${msg.channel}`,
          snippet: msg.content,
          lastMessageAt: 'Vừa xong',
          lastCustomerMessageAt: new Date().toISOString(),
          unreadCount: 1,
          tags: defaultTags,
          status: 'OPEN',
          customer: {
            id: `cust-${Date.now()}`,
            fullName: msg.senderName || `Khách hàng (${msg.channel})`,
            phone: msg.customerPhone || 'Chưa có SĐT',
            email: msg.customerEmail || 'Chưa có Email',
            avatarUrl:
              msg.senderAvatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'Lead')}&background=0284c7&color=fff&bold=true`,
            socialId: msg.id,
            channel: msg.channel,
            channelAccountName: `Kênh ${msg.channel}`,
            leadStatus: isFb ? 'POTENTIAL' : 'NEW',
            tags: defaultTags,
            interestCourses: [],
            notes: [],
          },
          messages: [newChatMsg],
        };

        if (!selectedId) {
          setSelectedId(targetId);
        }

        return mergeDuplicateConversations([newConv, ...prev]);
      });
    });

    return unsubscribe;
  }, [onNewMessage, selectedId]);

  // Lắng nghe sự kiện Realtime cập nhật Phễu / Trạng thái Lead từ Kanban & Socket SSE
  useEffect(() => {
    const unsubscribe = onPipelineChange((event) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (
            c.customer.id === event.customerId ||
            c.customer.fullName === event.customerName ||
            (event.customerId && c.id.includes(event.customerId))
          ) {
            let legacyStatus: LeadStatus = 'NEW';
            const upper = String(event.newStage).toUpperCase();
            if (upper.includes('ENROLLED') || upper.includes('WON') || upper.includes('CONVERTED')) {
              legacyStatus = 'CONVERTED';
            } else if (upper.includes('LOST') || upper.includes('UNQUALIFIED')) {
              legacyStatus = 'UNQUALIFIED';
            } else if (upper.includes('NEW')) {
              legacyStatus = 'NEW';
            } else {
              legacyStatus = 'POTENTIAL';
            }

            return {
              ...c,
              customer: {
                ...c.customer,
                leadStage: event.newStage,
                leadStatus: legacyStatus,
              },
            };
          }
          return c;
        })
      );
    });
    return unsubscribe;
  }, [onPipelineChange]);

  // Lắng nghe sự kiện cập nhật trạng thái Lead nội bộ từ Kanban (cùng tab / window)
  useEffect(() => {
    const handleLeadUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{
        customerId?: string;
        fullName?: string;
        conversationId?: string;
        leadStage?: LeadStage;
        leadStatus?: LeadStatus;
      }>;
      if (!customEvent.detail) return;
      const { customerId, fullName, conversationId, leadStage, leadStatus } = customEvent.detail;
      setConversations((prev) =>
        prev.map((c) => {
          if (
            (customerId && c.customer.id === customerId) ||
            (conversationId && c.id === conversationId) ||
            (fullName && c.customer.fullName === fullName)
          ) {
            return {
              ...c,
              customer: {
                ...c.customer,
                ...(leadStage !== undefined ? { leadStage } : {}),
                ...(leadStatus !== undefined ? { leadStatus } : {}),
              },
            };
          }
          return c;
        })
      );
    };
    window.addEventListener('crm:lead-updated', handleLeadUpdated);
    return () => window.removeEventListener('crm:lead-updated', handleLeadUpdated);
  }, []);

  // Lưu danh sách hội thoại vào LocalStorage để không bị mất khi chuyển tab
  useEffect(() => {
    try {
      localStorage.setItem('crm_inbox_conversations_v1', JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  // Đồng bộ số lượng tin nhắn chưa đọc tổng thể với RealtimeContext (dùng cho chấm đỏ Sidebar & Navbar)
  const totalUnread = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
  useEffect(() => {
    setUnreadCount(totalUnread);
  }, [totalUnread, setUnreadCount]);

  const currentConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // 1. Gửi tin nhắn phản hồi (Outbound) qua Zalo OA API / Facebook Graph API
  const handleSendMessage = async (text: string, attachments?: MessageAttachment[]) => {
    if (!currentConv) return;

    const tempId = `msg-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: tempId,
      conversationId: currentConv.id,
      direction: 'OUTBOUND' as const,
      content: text,
      sentAt: 'Vừa xong',
      senderName: staffName ? `${staffName} (Bạn)` : 'Bạn',
      status: 'SENT' as const,
      attachments,
    };

    // Cập nhật optimistic UI ngay lập tức
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          snippet: text || (attachments ? `[Đính kèm ${attachments.length} tệp]` : ''),
          lastMessageAt: 'Vừa xong',
          messages: [...c.messages, newMsg],
        };
      }),
    );

    // Gửi thực tế qua API Outbound của kênh tương ứng (ZALO, FACEBOOK...)
    try {
      const recipientId = currentConv.customer.socialId || currentConv.customer.id;
      const res = await apiClient.sendMessage({
        channel: currentConv.channel,
        recipientId,
        content: text,
        conversationId: currentConv.id,
      });

      // Cập nhật trạng thái tin nhắn thành DELIVERED
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConv.id) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === tempId ? { ...m, id: res.messageId || m.id, status: 'DELIVERED' as const } : m,
            ),
          };
        }),
      );
    } catch (err) {
      notify.error(
        `Không thể gửi tin nhắn qua ${currentConv.channel}: ${(err as Error).message}`,
        'Lỗi gửi tin',
      );
    }
  };

  // 2. Phân công nhân sự
  const handleAssignStaff = (staffId: string) => {
    if (!currentConv) return;
    const staff = staffList.find((s) => s.id === staffId);
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, assignedStaff: staff } : c))
    );
    notify.success(
      staff
        ? `Đã phân công ${staff.name} phụ trách cuộc hội thoại này.`
        : 'Đã hủy phân công nhân sự.'
    );
  };

  // 3. Đổi trạng thái hội thoại (OPEN / RESOLVED)
  const handleToggleStatus = () => {
    if (!currentConv) return;
    const nextStatus = currentConv.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, status: nextStatus } : c))
    );
    notify.info(
      nextStatus === 'RESOLVED'
        ? 'Đã đánh dấu hoàn tất cuộc trò chuyện.'
        : 'Đã mở lại cuộc trò chuyện.'
    );
  };

  // 4. Cập nhật Lead Status (CRM)
  const handleUpdateLeadStatus = (status: LeadStatus) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: { ...c.customer, leadStatus: status },
        };
      })
    );

    let stageForKanban: LeadStage = currentConv.customer.leadStage || (config.pipelineStages[0]?.id as LeadStage) || 'STAGE_NEW';
    if (!currentConv.customer.leadStage) {
      if (status === 'CONVERTED') stageForKanban = (config.pipelineStages.find((s) => s.isWon)?.id as LeadStage) || 'STAGE_ENROLLED';
      else if (status === 'POTENTIAL') stageForKanban = (config.pipelineStages[1]?.id as LeadStage) || 'STAGE_CONTACTED';
      else if (status === 'UNQUALIFIED') stageForKanban = (config.pipelineStages.find((s) => s.isLost)?.id as LeadStage) || 'STAGE_LOST';
    }

    // Đồng bộ sang phễu Kanban trong LocalStorage để bên Kanban nhận ngay
    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (kanbanRaw) {
        const kanbanList = JSON.parse(kanbanRaw);
        if (Array.isArray(kanbanList)) {
          const updatedKanban = kanbanList.map((cand: any) => {
            if (
              cand.conversationId === currentConv.id ||
              cand.id === currentConv.customer.id ||
              cand.fullName === currentConv.customer.fullName
            ) {
              return {
                ...cand,
                stage: stageForKanban,
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch {}

    // Lưu vào Backend Database Customer qua API
    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        fullName: currentConv.customer.fullName,
        phone: currentConv.customer.phone,
        email: currentConv.customer.email,
        leadStatus: status,
        leadStage: stageForKanban,
        updatedBy: staffName || undefined,
      }).catch((err) => {
        console.warn('Lỗi cập nhật leadStatus vào DB:', err);
      });
    }

    // Phát sự kiện đồng bộ toàn cục cho Kanban nếu đang hiển thị
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('crm:lead-updated', {
          detail: {
            customerId: currentConv.customer.id,
            fullName: currentConv.customer.fullName,
            conversationId: currentConv.id,
            leadStatus: status,
            leadStage: stageForKanban,
          },
        })
      );
    }

    notify.success(`Đã cập nhật trạng thái khách hàng sang "${status}".`);
  };

  // 5. Chuyển giai đoạn tuyển sinh Kanban
  const handleUpdateLeadStage = (stage: LeadStage) => {
    if (!currentConv) return;

    const targetStageConfig = config.pipelineStages.find(
      (s) =>
        s.id === stage ||
        s.id === `STAGE_${stage}` ||
        s.id.replace('STAGE_', '') === stage ||
        s.name.toLowerCase() === String(stage).toLowerCase()
    );
    const stageIdx = config.pipelineStages.findIndex(
      (s) =>
        s.id === stage ||
        s.id === `STAGE_${stage}` ||
        s.id.replace('STAGE_', '') === stage ||
        s.name.toLowerCase() === String(stage).toLowerCase()
    );
    const resolvedStageId = targetStageConfig ? (targetStageConfig.id as LeadStage) : stage;
    const isFirstStage = stageIdx === 0 || targetStageConfig?.order === 1;

    let computedStatus: LeadStatus = 'POTENTIAL';
    if (targetStageConfig?.isWon) {
      computedStatus = 'CONVERTED';
    } else if (targetStageConfig?.isLost) {
      computedStatus = 'UNQUALIFIED';
    } else if (isFirstStage || resolvedStageId === 'STAGE_NEW' || resolvedStageId === 'NEW') {
      computedStatus = 'NEW';
    } else {
      const upper = String(resolvedStageId).toUpperCase();
      if (upper.includes('ENROLLED') || upper.includes('WON') || upper.includes('CONVERTED')) {
        computedStatus = 'CONVERTED';
      } else if (upper.includes('LOST') || upper.includes('UNQUALIFIED')) {
        computedStatus = 'UNQUALIFIED';
      } else {
        computedStatus = 'POTENTIAL';
      }
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: { ...c.customer, leadStage: resolvedStageId, leadStatus: computedStatus },
        };
      })
    );

    // Đồng bộ sang phễu Kanban trong LocalStorage để bên Kanban lập tức cập nhật
    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (kanbanRaw) {
        const kanbanList = JSON.parse(kanbanRaw);
        if (Array.isArray(kanbanList)) {
          const updatedKanban = kanbanList.map((cand: any) => {
            if (
              cand.conversationId === currentConv.id ||
              cand.id === currentConv.customer.id ||
              cand.fullName === currentConv.customer.fullName
            ) {
              return {
                ...cand,
                stage: resolvedStageId,
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch {}

    // Lưu vào Backend Database Customer qua API
    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        fullName: currentConv.customer.fullName,
        phone: currentConv.customer.phone,
        email: currentConv.customer.email,
        leadStage: resolvedStageId,
        leadStatus: computedStatus,
        updatedBy: staffName || undefined,
      }).catch((err) => {
        console.warn('Lỗi cập nhật leadStage vào DB:', err);
      });
    }

    // Phát sự kiện đồng bộ toàn cục cho Kanban nếu đang hiển thị
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('crm:lead-updated', {
          detail: {
            customerId: currentConv.customer.id,
            fullName: currentConv.customer.fullName,
            conversationId: currentConv.id,
            leadStage: resolvedStageId,
            leadStatus: computedStatus,
          },
        })
      );
    }

    notify.success(`Đã chuyển sang giai đoạn "${targetStageConfig?.name || resolvedStageId}".`);
  };

  // 6. Gán / Gỡ nhãn (Tags)
  const handleAddTag = (tag: string) => {
    if (!currentConv) return;
    if (currentConv.tags.includes(tag)) return;
    const nextTags = [...currentConv.tags, tag];
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          tags: nextTags,
          customer: { ...c.customer, tags: nextTags },
        };
      })
    );
  };

  const handleRemoveTag = (tag: string) => {
    if (!currentConv) return;
    const nextTags = currentConv.tags.filter((t) => t !== tag);
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          tags: nextTags,
          customer: { ...c.customer, tags: nextTags },
        };
      })
    );
  };

  // 7. Thêm ghi chú nội bộ
  const handleAddNote = (content: string) => {
    if (!currentConv) return;
    const newNote = {
      id: `note-${Date.now()}`,
      author: staffName ? `${staffName} (Bạn)` : 'Bạn',
      content,
      createdAt: 'Vừa xong',
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            notes: [newNote, ...c.customer.notes],
          },
        };
      })
    );
    notify.success('Đã lưu ghi chú nội bộ thành công.');
  };

  // 8. Xóa ghi chú nội bộ
  const handleRemoveNote = (noteId: string) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            notes: c.customer.notes.filter((n) => n.id !== noteId),
          },
        };
      })
    );
    notify.info('Đã xóa ghi chú nội bộ.');
  };

  // 9. Gán Khóa học / Dự án / Gói dịch vụ từ catalog & cập nhật giá trị dự kiến
  const handleUpdateProducts = (courses: string[], estimatedValue: number) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            interestCourses: courses,
            estimatedValue,
          },
        };
      })
    );

    // Đồng bộ sang phễu Kanban trong LocalStorage để bên Kanban lập tức cập nhật
    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (kanbanRaw) {
        const kanbanList = JSON.parse(kanbanRaw);
        if (Array.isArray(kanbanList)) {
          const updatedKanban = kanbanList.map((cand: any) => {
            if (
              cand.conversationId === currentConv.id ||
              cand.id === currentConv.customer.id ||
              cand.fullName === currentConv.customer.fullName
            ) {
              return {
                ...cand,
                interestCourses: courses,
                estimatedTuition: estimatedValue,
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch {}

    // Lưu vào Backend Database Customer qua API
    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        interestCourses: courses,
        estimatedValue,
      }).catch(() => {});
    }
  };

  // 10. Cập nhật thông tin liên hệ (Phone, Email, FullName) trực tiếp từ Customer Profile Column
  const handleUpdateContactInfo = (info: { phone?: string; email?: string; fullName?: string }) => {
    if (!currentConv) return;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            phone: info.phone !== undefined ? info.phone : c.customer.phone,
            email: info.email !== undefined ? info.email : c.customer.email,
            fullName: info.fullName !== undefined ? info.fullName : c.customer.fullName,
          },
        };
      })
    );

    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (kanbanRaw) {
        const kanbanList = JSON.parse(kanbanRaw);
        if (Array.isArray(kanbanList)) {
          const updatedKanban = kanbanList.map((cand: any) => {
            if (
              cand.conversationId === currentConv.id ||
              cand.id === currentConv.customer.id ||
              cand.fullName === currentConv.customer.fullName
            ) {
              return {
                ...cand,
                ...(info.phone !== undefined ? { phone: info.phone } : {}),
                ...(info.email !== undefined ? { email: info.email } : {}),
                ...(info.fullName !== undefined ? { fullName: info.fullName } : {}),
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch {}

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        phone: info.phone !== undefined ? info.phone : currentConv.customer.phone,
        email: info.email !== undefined ? info.email : currentConv.customer.email,
        fullName: info.fullName !== undefined ? info.fullName : currentConv.customer.fullName,
      }).then(() => {
        notify.success('Đã lưu thông tin liên hệ thành công.');
      }).catch((err) => {
        console.warn('Lỗi lưu thông tin liên hệ:', err);
        notify.warning('Đã cập nhật giao diện, nhưng đồng bộ DB gặp sự cố.');
      });
    } else {
      notify.success('Đã lưu thông tin liên hệ.');
    }
  };

  return (
    <div className={`pancake-inbox-container ${selectedId ? 'has-active-chat' : ''}`}>
      {/* CỘT 1 (Trái): Danh sách Hội thoại */}
      <ConversationListColumn
        conversations={conversations}
        selectedId={currentConv?.id || null}
        onSelect={handleSelectConversation}
        onSyncFacebook={handleSyncFacebook}
        isSyncing={isSyncingFb}
      />

      {/* CỘT 2 (Giữa): Cửa sổ Chat Trực tuyến hoặc Placeholder trống */}
      {currentConv ? (
        <ChatWindowColumn
          conversation={currentConv}
          staffList={staffList}
          quickReplies={quickReplies}
          onSendMessage={handleSendMessage}
          onAssignStaff={handleAssignStaff}
          onToggleStatus={handleToggleStatus}
          onBackToList={() => setSelectedId(null)}
          onToggleProfile={() => setIsProfileMobileOpen((prev) => !prev)}
          onOpenQuickReplySettings={() => setIsQuickReplyModalOpen(true)}
        />
      ) : (
        <main
          className="pancake-chat-window empty-placeholder-view"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#94a3b8',
            flexDirection: 'column',
            padding: '32px',
            textAlign: 'center',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              background: '#ffffff',
              borderRadius: '12px',
              padding: '36px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <MessageSquare size={30} />
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '18px', fontWeight: 600 }}>
              Hộp thoại đang trống
            </h3>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
              Chưa có cuộc hội thoại nào. Khi khách hàng nhắn tin từ Facebook Messenger hoặc Zalo OA,
              tin nhắn sẽ được đẩy tự động qua kết nối WebSocket Realtime và xuất hiện tại đây ngay lập tức.
            </p>
          </div>
        </main>
      )}

      {/* CỘT 3 (Phải): Hồ sơ Khách hàng & CRM Lead Funnel */}
      {currentConv && (
        <CustomerProfileColumn
          customer={currentConv.customer}
          onUpdateLeadStatus={handleUpdateLeadStatus}
          onUpdateLeadStage={handleUpdateLeadStage}
          onUpdateContactInfo={handleUpdateContactInfo}
          onNavigateToKanban={onNavigateToKanban}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onAddNote={handleAddNote}
          onRemoveNote={handleRemoveNote}
          onUpdateProducts={handleUpdateProducts}
          isMobileOpen={isProfileMobileOpen}
          onCloseMobile={() => setIsProfileMobileOpen(false)}
        />
      )}

      {/* Modal Tùy Chỉnh & Thêm/Sửa Tin Nhắn Nhanh */}
      <QuickReplyModal
        isOpen={isQuickReplyModalOpen}
        onClose={() => setIsQuickReplyModalOpen(false)}
        quickReplies={quickReplies}
        onSaveReplies={handleSaveQuickReplies}
      />
    </div>
  );
};
