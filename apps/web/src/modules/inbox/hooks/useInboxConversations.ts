import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ConversationItem,
  ChatMessage,
  ChannelType,
  LeadStatus,
  LeadStage,
} from '../types.js';
import { mergeDuplicateConversations, deduplicateMessages } from '../utils/conversationUtils.js';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

interface UseInboxConversationsProps {
  activeWorkspaceId?: string | null;
  ownerId?: string | null;
  isOwner?: boolean;
  staffId?: string | null;
  staffName?: string | null;
  initialConversationId?: string | null;
  onNewMessage: (callback: (msg: any) => void) => () => void;
  onPipelineChange: (callback: (event: any) => void) => () => void;
  setUnreadCount: (count: number) => void;
}

const toIsoTimestamp = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
};

const isSameChannelFamily = (ch1: string, ch2: string): boolean => {
  if (ch1 === ch2) return true;
  if (ch1.startsWith('ZALO') && ch2.startsWith('ZALO')) return true;
  return false;
};

const isRealName = (n?: string): boolean =>
  Boolean(n && n.length > 1 && !n.includes('#') && !n.toLowerCase().startsWith('khách hàng') && !n.toLowerCase().startsWith('lead'));

export const useInboxConversations = ({
  activeWorkspaceId,
  ownerId,
  isOwner,
  staffId,
  staffName,
  initialConversationId,
  onNewMessage,
  onPipelineChange,
  setUnreadCount,
}: UseInboxConversationsProps) => {
  const effectiveOwnerId = ownerId || (isOwner ? staffId : '');
  const storageKey = activeWorkspaceId
    ? `crm_inbox_conversations_${activeWorkspaceId}`
    : (effectiveOwnerId ? `crm_inbox_conversations_${effectiveOwnerId}` : 'crm_inbox_conversations_v1');

  const [channelAccounts, setChannelAccounts] = useState<any[]>([]);

  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isSelfName = (n?: string) => {
            const lower = n?.trim()?.toLowerCase() || '';
            if (staffName && lower === staffName.trim().toLowerCase()) return true;
            return false;
          };
          const cleaned = parsed
            .filter((c: ConversationItem) => !isSelfName(c.customer?.fullName))
            .map((c: ConversationItem) => {
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
          return mergeDuplicateConversations(cleaned);
        }
      }
    } catch { }
    return [];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Khi chuyển đổi Workspace hoặc tài khoản, tự động nạp danh sách hội thoại của Workspace đó
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(mergeDuplicateConversations(parsed));
          setSelectedId(initialConversationId || parsed[0]?.id || null);
          return;
        }
      }
    } catch { }
    setConversations([]);
    setSelectedId(null);
  }, [storageKey, initialConversationId]);

  // Tải các tin nhắn đã lưu trong CSDL khi vào trang Inbox & ánh xạ khớp với dữ liệu khách hàng
  const loadSavedMessages = useCallback(async () => {
    try {
      const [messagesRes, customersRes, channelsRes] = await Promise.all([
        apiClient.getMessages({ limit: 100, workspaceId: activeWorkspaceId || undefined }),
        apiClient.getCustomers({ workspaceId: activeWorkspaceId || undefined }).catch(() => null),
        apiClient.getChannels(activeWorkspaceId || undefined).catch(() => []),
      ]);

      if (Array.isArray(channelsRes)) {
        setChannelAccounts(channelsRes);
      }

      if (!messagesRes?.items || messagesRes.items.length === 0) {
        setConversations([]);
        setSelectedId(null);
        try {
          localStorage.removeItem(storageKey);
        } catch { }
        return;
      }

      // Xây dựng bản đồ khách hàng từ cơ sở dữ liệu để gán chuẩn tên thật & avatar thật (đồng bộ với Kanban)
      const customerMap = new Map<string, any>();
      if (customersRes?.items) {
        for (const cust of customersRes.items) {
          if (cust.id) customerMap.set(cust.id, cust);
          const fbId = cust.channelIdentities?.facebook || cust.channelIdentities?.socialId;
          if (fbId) customerMap.set(String(fbId), cust);
          const zaloId = cust.channelIdentities?.zalo?.id || cust.channelIdentities?.zalo;
          if (zaloId) customerMap.set(String(zaloId), cust);
          if (cust.fullName) customerMap.set(cust.fullName, cust);
          if (cust.phone) customerMap.set(cust.phone, cust);
        }
      }

      const groups: Record<string, typeof messagesRes.items> = {};
      for (const item of messagesRes.items) {
        const raw = (item as any).rawPayload || {};
        const isOut = item.direction === 'OUTBOUND';
        const channelAccountExtId = item.channelAccount?.externalAccountId;
        // Đối với tin OUTBOUND, người đối thoại là recipient chứ không phải Page/Tư vấn viên
        const recipientId = raw.recipient?.id || raw.to?.data?.[0]?.id || raw.to?.id || raw.idTo;
        let senderId = String(
          (isOut && recipientId) ||
          (raw.uidFrom && raw.uidFrom !== channelAccountExtId ? raw.uidFrom : '') ||
          item.senderExternalId ||
          raw.senderExternalId ||
          raw.sender?.id ||
          raw.from?.id ||
          (item as any).conversation?.customer?.channelIdentities?.zalo?.id ||
          (item as any).conversation?.customer?.channelIdentities?.zalo ||
          (item as any).conversation?.customer?.channelIdentities?.facebook ||
          (item as any).conversation?.customerId ||
          'anonymous'
        );

        // Đảm bảo không gom nhóm theo chính tài khoản của tư vấn viên
        if (channelAccountExtId && senderId === channelAccountExtId) {
          if (recipientId && String(recipientId) !== channelAccountExtId) {
            senderId = String(recipientId);
          } else {
            // Tin nhắn tự gửi cho chính mình, bỏ qua
            continue;
          }
        }

        const dbConvId = (item as any).conversationId || (item as any).conversation?.id;
        const convId = dbConvId || (
          item.channel === 'FACEBOOK' && channelAccountExtId
            ? `FACEBOOK_${channelAccountExtId}_${senderId}`
            : `${item.channel}_${senderId}`
        );

        if (!groups[convId]) groups[convId] = [];
        groups[convId].push(item);
      }

      const knownAccountAvatars = new Set<string>();
      const knownAccountNames = new Set<string>();
      if (Array.isArray(channelsRes)) {
        for (const ca of channelsRes) {
          const caAvatar = (ca as any)?.avatarUrl;
          const caName = (ca as any)?.displayName;
          if (caAvatar && typeof caAvatar === 'string') knownAccountAvatars.add(caAvatar);
          if (caName && typeof caName === 'string') knownAccountNames.add(caName.trim().toLowerCase());
        }
      }
      for (const m of messagesRes.items) {
        const accAvatar = (m.channelAccount as any)?.avatarUrl;
        const accName = (m.channelAccount as any)?.displayName;
        if (accAvatar && typeof accAvatar === 'string') knownAccountAvatars.add(accAvatar);
        if (accName && typeof accName === 'string') knownAccountNames.add(accName.trim().toLowerCase());
      }

      setConversations((prev) => {
        const updated = [...prev];
        for (const [convId, groupItems] of Object.entries(groups)) {
          const sorted = [...groupItems].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          );
          const latest = sorted[sorted.length - 1];
          const latestInbound = [...sorted].reverse().find((m) => m.direction === 'INBOUND');
          const firstInbound = sorted.find((m) => m.direction === 'INBOUND');
          const lastCustomerMessageAt = [
            toIsoTimestamp((latest as any).conversation?.lastCustomerMessageAt),
            toIsoTimestamp(latestInbound?.sentAt),
          ].reduce<string | null>((latestTimestamp, value) => {
            if (!value) return latestTimestamp;
            return latestTimestamp === null || Date.parse(value) > Date.parse(latestTimestamp)
              ? value
              : latestTimestamp;
          }, null);

          const isPersonalZalo = Boolean(
            latest.channel === 'ZALO' && (
              (latest.channelAccount as any)?.isPersonal ||
              (latest.channelAccount as any)?.metadata?.isPersonal ||
              (latest.channelAccount as any)?.metadata?.engine === 'zca-js' ||
              (latest as any).rawPayload?.isPersonal ||
              (latest as any).rawPayload?.engine === 'zca-js'
            )
          );
          const effectiveConvChannel: ChannelType = isPersonalZalo ? 'ZALO_PERSONAL' : (latest.channel as any);
          const channelName =
            latest.channelAccount?.displayName && !latest.channelAccount.displayName.startsWith('Kênh ')
              ? latest.channelAccount.displayName
              : (isPersonalZalo ? 'Zalo Cá nhân' : (latest.channel === 'ZALO' ? 'Zalo OA' : latest.channel));

          const isLatestOut = latest.direction === 'OUTBOUND';
          const myExtId = latest.channelAccount?.externalAccountId;
          const outRecipient =
            (latest as any).rawPayload?.recipient?.id ||
            (latest as any).rawPayload?.to?.id ||
            (latest as any).rawPayload?.idTo;

          let latestSenderId = String(
            (isLatestOut && outRecipient) ||
            firstInbound?.senderExternalId ||
            (firstInbound as any)?.rawPayload?.uidFrom ||
            (firstInbound as any)?.rawPayload?.senderExternalId ||
            latest.senderExternalId ||
            'khách'
          );
          if (myExtId && latestSenderId === myExtId && outRecipient && outRecipient !== myExtId) {
            latestSenderId = String(outRecipient);
          }

          const latestSuffix = latestSenderId.length > 4 ? latestSenderId.slice(-4) : latestSenderId;
          const convCustomer = (latest as any).conversation?.customer;
          const matchedCust =
            convCustomer ||
            customerMap.get((latest as any).conversation?.customerId) ||
            customerMap.get(latestSenderId) ||
            (convCustomer?.fullName ? customerMap.get(convCustomer.fullName) : null);

          // Không lấy tên của tư vấn viên làm tên của khách hàng
          const candidateName = (latest as any).customerName || (latest as any).rawPayload?.customerName;
          const isCounselorName =
            candidateName &&
            (candidateName.toLowerCase() === latest.channelAccount?.displayName?.toLowerCase() ||
              Boolean(staffName && candidateName.toLowerCase() === staffName.toLowerCase()) ||
              knownAccountNames.has(candidateName.trim().toLowerCase()));

          const rawCustomerName =
            matchedCust?.fullName ||
            (!isCounselorName && candidateName) ||
            `Khách hàng ${latest.channel === 'ZALO' ? 'Zalo' : latest.channel === 'FACEBOOK' ? 'Facebook' : latest.channel} #${latestSuffix}`;

          const isSelfConv =
            (latestSenderId && myExtId && latestSenderId === myExtId && (!outRecipient || outRecipient === myExtId)) ||
            (rawCustomerName && latest.channelAccount?.displayName && rawCustomerName.trim().toLowerCase() === latest.channelAccount.displayName.trim().toLowerCase()) ||
            (staffName && rawCustomerName && rawCustomerName.trim().toLowerCase() === staffName.trim().toLowerCase()) ||
            knownAccountNames.has(rawCustomerName.trim().toLowerCase());

          if (isSelfConv) {
            continue;
          }

          let candidateAvatar =
            matchedCust?.avatarUrl ||
            (!isCounselorName && ((latest as any).customerAvatar || (latest as any).rawPayload?.customerAvatar));

          const latestCaAvatar = (latest.channelAccount as any)?.avatarUrl;
          if (candidateAvatar && (knownAccountAvatars.has(candidateAvatar) || (latestCaAvatar && candidateAvatar === latestCaAvatar))) {
            const fbAvatar = (latest as any).customerAvatar || (latest as any).rawPayload?.customerAvatar;
            candidateAvatar = fbAvatar && !knownAccountAvatars.has(fbAvatar) && fbAvatar !== latestCaAvatar ? fbAvatar : null;
          }

          const rawCustomerAvatar =
            candidateAvatar ||
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
              sentAt: m.sentAt ? new Date(m.sentAt).toISOString() : new Date().toISOString(),
              senderName: m.direction === 'OUTBOUND' ? channelName : (itemCustomerName || `Khách (${suffix})`),
              status: 'DELIVERED',
            };
          });

          const existingIndex = updated.findIndex((c) => {
            // CUS-04: Giữ tách biệt 2 cuộc hội thoại khác kênh, không gộp tin nhắn của kênh này vào kênh kia
            if (!isSameChannelFamily(c.channel, effectiveConvChannel)) return false;

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

          const assignedStaffFromMessage =
            (latest as any).assignedStaff ||
            (groupItems.find((m: any) => m.assignedStaff) as any)?.assignedStaff;
          const assignedStaffFromCust =
            matchedCust?.assignedStaff ||
            (matchedCust?.channelIdentities?.assignedStaffId
              ? {
                  id: matchedCust.channelIdentities.assignedStaffId,
                  name: matchedCust.channelIdentities.assignedStaffName || 'Tư vấn viên',
                  role: 'STAFF',
                  avatar: '',
                }
              : undefined);
          const effectiveAssignedStaff = assignedStaffFromMessage || assignedStaffFromCust;

          if (existingIndex >= 0) {
            const existing = updated[existingIndex];

            const shouldUpdateCustomer =
              (matchedCust || (latest as any).customerName) &&
              (existing.customer.fullName.includes('#') || existing.customer.fullName.includes('Khách hàng') || !existing.customer.avatarUrl);

            const identitiesList =
              matchedCust?.channelIdentitiesList ||
              (latestSenderId && latestSenderId !== 'anonymous' && latestSenderId !== 'khách'
                ? [{ channel: effectiveConvChannel, externalUserId: latestSenderId }]
                : []);

            const existingTags = Array.isArray(matchedCust?.tags)
              ? matchedCust.tags
              : existing.customer.tags || existing.tags || [];

            const shouldFixAvatar = !existing.customer.avatarUrl || knownAccountAvatars.has(existing.customer.avatarUrl) || existing.customer.avatarUrl.includes('ui-avatars.com');
            updated[existingIndex] = {
              ...existing,
              channel: effectiveConvChannel,
              channelAccountName: channelName,
              channelAccountId: (latest as any).channelAccountId || (latest.channelAccount as any)?.id || existing.channelAccountId || undefined,
              snippet: latest.content || existing.snippet,
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toISOString() : new Date().toISOString(),
              lastCustomerMessageAt,
              assignedStaff: existing.assignedStaff || effectiveAssignedStaff,
              tags: existingTags,
              customer: shouldUpdateCustomer
                ? {
                  ...existing.customer,
                  contactId: matchedCust?.contact?.id || existing.customer.contactId,
                  channelIdentities: identitiesList.length ? identitiesList : existing.customer.channelIdentities,
                  channel: effectiveConvChannel,
                  channelAccountName: channelName,
                  fullName: rawCustomerName,
                  avatarUrl: rawCustomerAvatar,
                  phone: matchedCust?.phone || existing.customer.phone,
                  email: matchedCust?.email || existing.customer.email,
                  leadStatus: (matchedCust?.leadStatus as any) || existing.customer.leadStatus,
                  leadStage: matchedCust?.leadStage || existing.customer.leadStage,
                  tags: existingTags,
                  interestCourses: existing.customer.interestCourses?.length
                    ? existing.customer.interestCourses
                    : (matchedCust?.interestCourses || []),
                  estimatedValue: existing.customer.estimatedValue || matchedCust?.estimatedValue || 0,
                }
                : {
                  ...existing.customer,
                  contactId: matchedCust?.contact?.id || existing.customer.contactId,
                  channelIdentities: identitiesList.length ? identitiesList : existing.customer.channelIdentities,
                  channel: effectiveConvChannel,
                  channelAccountName: channelName,
                  avatarUrl: shouldFixAvatar ? rawCustomerAvatar : existing.customer.avatarUrl,
                  leadStatus: (matchedCust?.leadStatus as any) || existing.customer.leadStatus,
                  leadStage: matchedCust?.leadStage || existing.customer.leadStage,
                  tags: existingTags,
                  interestCourses: existing.customer.interestCourses?.length
                    ? existing.customer.interestCourses
                    : (matchedCust?.interestCourses || []),
                  estimatedValue: existing.customer.estimatedValue || matchedCust?.estimatedValue || 0,
                },
              messages: deduplicateMessages([...existing.messages, ...formattedMessages]),
            };
          } else {
            const identitiesList =
              matchedCust?.channelIdentitiesList ||
              (latestSenderId && latestSenderId !== 'anonymous' && latestSenderId !== 'khách'
                ? [{ channel: effectiveConvChannel, externalUserId: latestSenderId }]
                : []);

            const initialCustomerTags = Array.isArray(matchedCust?.tags)
              ? matchedCust.tags
              : Array.isArray((latest as any).tags) && (latest as any).tags.length > 0
                ? (latest as any).tags.map((t: string) => t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t)
                : Array.isArray((latest as any).rawPayload?.tags) && (latest as any).rawPayload.tags.length > 0
                  ? (latest as any).rawPayload.tags.map((t: string) => t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t)
                  : [];

            const newConv: ConversationItem = {
              id: convId,
              channel: effectiveConvChannel,
              channelAccountName: channelName,
              channelAccountId: (latest as any).channelAccountId || (latest.channelAccount as any)?.id || (convCustomer as any)?.channelAccountId || undefined,
              snippet: latest.content || 'Tin nhắn mới',
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toISOString() : new Date().toISOString(),
              lastCustomerMessageAt,
              unreadCount: 0,
              assignedStaff: effectiveAssignedStaff,
              tags: initialCustomerTags,
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
                channel: effectiveConvChannel,
                channelAccountName: channelName,
                leadStatus: (matchedCust?.leadStatus as any) || 'POTENTIAL',
                leadStage: matchedCust?.leadStage || undefined,
                tags: initialCustomerTags,
                interestCourses: matchedCust?.interestCourses || [],
                estimatedValue: matchedCust?.estimatedValue || 0,
                notes: [],
              },
              messages: formattedMessages,
            };
            updated.unshift(newConv);
          }
        }
        // Role STAFF: chỉ xem các hội thoại mà mình được phân công (OWNER xem tất cả)
        const visibleList = (!isOwner && staffId)
          ? updated.filter((c) => {
              const assigned = c.assignedStaff;
              return (
                assigned?.id === staffId ||
                assigned?.memberId === staffId ||
                (assigned?.name && staffName && assigned.name.trim().toLowerCase() === staffName.trim().toLowerCase())
              );
            })
          : updated;
        return mergeDuplicateConversations(visibleList, knownAccountAvatars);
      });
    } catch {
      // Backend có thể chưa khởi động hoặc chưa có tin nhắn
    }
  }, [activeWorkspaceId, storageKey, staffName, isOwner, staffId]);

  useEffect(() => {
    loadSavedMessages();
  }, [loadSavedMessages, activeWorkspaceId]);

  // Lắng nghe sự kiện Realtime tin nhắn mới từ WebSocket
  useEffect(() => {
    const unsubscribe = onNewMessage((msg: any) => {
            const msgSenderId =
        msg.senderExternalId ||
        msg.senderId ||
        msg.rawPayload?.uidFrom ||
        msg.rawPayload?.sender?.id;

      setConversations((prev) => {
        let targetId = msg.conversationId;

        if (!targetId && msgSenderId) {
          targetId = `${msg.channel}_${msgSenderId}`;
        }
        if (!targetId) targetId = `conv-${Date.now()}`;

        const isMsgPersonalZalo = Boolean(
          msg.channel === 'ZALO_PERSONAL' || (
            msg.channel === 'ZALO' && (
              (msg as any).isPersonal ||
              (msg as any).channelAccount?.isPersonal ||
              (msg as any).channelAccount?.metadata?.isPersonal ||
              (msg as any).channelAccount?.metadata?.engine === 'zca-js' ||
              (msg as any).rawPayload?.isPersonal ||
              (msg as any).rawPayload?.engine === 'zca-js'
            )
          )
        );
        const effectiveMsgChannel: ChannelType = isMsgPersonalZalo ? 'ZALO_PERSONAL' : (msg.channel as any);

        const existingIdx = prev.findIndex((c) => {
          // CUS-04: Bắt buộc cùng kênh mới gộp tin nhắn vào cuộc hội thoại
          if (!isSameChannelFamily(c.channel, effectiveMsgChannel)) return false;

          if (c.id === targetId || (msg.conversationId && c.id === msg.conversationId)) return true;
          if (msgSenderId && (c.customer.socialId === msgSenderId || c.id.includes(msgSenderId))) return true;
          return false;
        });

        const matchedConvId = existingIdx >= 0 ? prev[existingIdx].id : targetId;
        const sentAtIso = msg.sentAt && !isNaN(Date.parse(msg.sentAt))
          ? new Date(msg.sentAt).toISOString()
          : new Date().toISOString();
        const newChatMsg: ChatMessage = {
          id: msg.id || `msg-${Date.now()}`,
          conversationId: matchedConvId,
          direction: msg.direction || ('INBOUND' as const),
          content: msg.content,
          sentAt: sentAtIso,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          status: 'DELIVERED' as const,
        };

        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const isCurrentlyOpen = existing.id === selectedId;

          const updatedMessages = deduplicateMessages([...existing.messages, newChatMsg]);
          const latestMsg = updatedMessages[updatedMessages.length - 1];

          const updatedTarget: ConversationItem = {
            ...existing,
            snippet: latestMsg?.content || msg.content,
            lastMessageAt: latestMsg?.sentAt || sentAtIso,
            lastCustomerMessageAt: msg.direction === 'INBOUND' ? sentAtIso : existing.lastCustomerMessageAt,
            unreadCount:
              msg.direction === 'OUTBOUND' ||
              (isCurrentlyOpen && effectiveMsgChannel !== 'FACEBOOK')
                ? 0
                : (existing.unreadCount || 0) + 1,
            customer: {
              ...existing.customer,
              avatarUrl:
                msg.direction === 'INBOUND' && msg.senderAvatar && !msg.senderAvatar.includes('ui-avatars.com')
                  ? msg.senderAvatar
                  : ((msg as any).customerAvatar && !(msg as any).customerAvatar.includes('ui-avatars.com')
                    ? (msg as any).customerAvatar
                    : existing.customer.avatarUrl),
            },
            messages: updatedMessages,
          };

          // Đưa hội thoại vừa có tương tác mới lên đầu danh sách và đồng bộ Customer Profile
          const remaining = prev.filter((_, idx) => idx !== existingIdx);
          return mergeDuplicateConversations([updatedTarget, ...remaining]);
        }

        // Bỏ qua tin nhắn OUTBOUND chưa rõ người nhận để tránh sinh trùng hộp thoại chính mình
        if (msg.direction === 'OUTBOUND' && !(msg as any).recipientName && !(msg as any).customerName) {
          return prev;
        }

        // Tự động tạo cuộc hội thoại mới khi nhận được tin nhắn từ khách hàng mới chưa từng có trong hệ thống
        const isFb = msg.channel === 'FACEBOOK';
        const defaultTags = isFb ? ['Lead'] : ['Khách hàng mới'];

        const isCounselorName = (n?: string) => {
          const lower = n?.trim()?.toLowerCase() || '';
          return (
            lower.includes('(bạn)') ||
            lower === 'tư vấn viên' ||
            lower === 'bạn' ||
            Boolean(staffName && lower === staffName.toLowerCase())
          );
        };

        const resolvedCustomerName =
          msg.direction === 'OUTBOUND'
            ? (msg as any).recipientName || (msg as any).customerName || `Khách hàng (${msg.channel})`
            : (!isCounselorName(msg.senderName) ? msg.senderName : `Khách hàng (${msg.channel})`);

        const resolvedAccountName =
          (msg as any).channelAccount?.displayName && !(msg as any).channelAccount.displayName.startsWith('Kênh ')
            ? (msg as any).channelAccount.displayName
            : (isMsgPersonalZalo ? 'Zalo Cá nhân' : (msg.channel === 'ZALO' ? 'Zalo OA' : msg.channel));

        const newConv: ConversationItem = {
          id: targetId,
          channel: effectiveMsgChannel,
          channelAccountName: resolvedAccountName,
          channelAccountId: (msg as any).channelAccountId || (msg as any).channelAccount?.id || undefined,
          snippet: msg.content,
          lastMessageAt: 'Vừa xong',
          lastCustomerMessageAt: msg.direction === 'INBOUND' ? sentAtIso : null,
          unreadCount: 1,
          tags: defaultTags,
          status: 'OPEN',
          customer: {
            id: `cust-${Date.now()}`,
            fullName: resolvedCustomerName,
            phone: msg.customerPhone || 'Chưa có SĐT',
            email: msg.customerEmail || 'Chưa có Email',
            avatarUrl:
              (msg.direction === 'INBOUND' && msg.senderAvatar)
                ? msg.senderAvatar
                : ((msg as any).customerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedCustomerName)}&background=0284c7&color=fff&bold=true`),
            socialId: (msg as any).senderExternalId || (msg as any).senderId || (msg as any).rawPayload?.uidFrom || (msg as any).rawPayload?.sender?.id || msg.id,
            channel: effectiveMsgChannel,
            channelAccountName: resolvedAccountName,
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
  }, [onNewMessage, selectedId, staffName]);

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
            let legacyStatus: LeadStatus;
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

  // Lưu danh sách hội thoại vào LocalStorage theo từng Workspace để không bị lẫn giữa các tài khoản
  useEffect(() => {
    try {
      if (conversations.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(conversations));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch { }
  }, [conversations, storageKey]);

  // Đồng bộ số lượng tin nhắn chưa đọc tổng thể với RealtimeContext
  const totalUnread = useMemo(
    () => conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0),
    [conversations]
  );

  useEffect(() => {
    setUnreadCount(totalUnread);
  }, [totalUnread, setUnreadCount]);

  const currentConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) || conversations[0],
    [conversations, selectedId]
  );

  useEffect(() => {
    if (currentConv?.channel !== 'FACEBOOK' || currentConv.unreadCount <= 0) return;

    let active = true;
    void apiClient.markFacebookConversationSeen(currentConv.id)
      .then(() => {
        if (!active) return;
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === currentConv.id
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      })
      .catch((error: unknown) => {
        notify.error(
          `Không thể đồng bộ trạng thái đã xem lên Facebook: ${
            error instanceof Error ? error.message : 'Lỗi không xác định'
          }`,
        );
      });

    return () => {
      active = false;
    };
  }, [currentConv?.id, currentConv?.channel, currentConv?.unreadCount]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
  };

  return {
    conversations,
    setConversations,
    selectedId,
    setSelectedId,
    currentConv,
    channelAccounts,
    loadSavedMessages,
    handleSelectConversation,
  };
};
