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
          return parsed.map((c: ConversationItem) => {
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
        const senderId = String(item.senderExternalId || (item as any).rawPayload?.senderExternalId || (item as any).rawPayload?.sender_id || 'anonymous');
        const convId = item.channel === 'FACEBOOK' && item.channelAccount?.externalAccountId
          ? `FACEBOOK_${item.channelAccount.externalAccountId}_${senderId}`
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

          const latestSenderId = String(latest.senderExternalId || (latest as any).rawPayload?.senderExternalId || (latest as any).rawPayload?.sender_id || 'khách');
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
            `Khách hàng Facebook #${latestSuffix}`;

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

          const existingIndex = updated.findIndex((c) => c.id === convId);
          if (existingIndex >= 0) {
            const existing = updated[existingIndex];
            const existingIds = new Set(existing.messages.map((m) => m.id));
            const newMsgs = formattedMessages.filter((m) => !existingIds.has(m.id));

            const shouldUpdateCustomer =
              (matchedCust || (latest as any).customerName) &&
              (existing.customer.fullName.includes('#') || existing.customer.fullName.includes('Khách hàng') || !existing.customer.avatarUrl);

            updated[existingIndex] = {
              ...existing,
              snippet: latest.content || existing.snippet,
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              customer: shouldUpdateCustomer
                ? {
                    ...existing.customer,
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
            const newConv: ConversationItem = {
              id: convId,
              channel: latest.channel as any,
              channelAccountName: channelName,
              snippet: latest.content || 'Tin nhắn mới',
              lastMessageAt: latest.sentAt ? new Date(latest.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              lastCustomerMessageAt: firstInbound.sentAt,
              unreadCount: 0,
              tags: ['Facebook Lead'],
              status: 'OPEN',
              customer: {
                id: matchedCust?.id || convCustomer?.id || (latestSenderId !== 'anonymous' && latestSenderId !== 'khách' ? `cust-${latestSenderId}` : `cust-${convId}`),
                fullName: rawCustomerName,
                phone: matchedCust?.phone || 'Chưa có SĐT',
                email: matchedCust?.email || 'Chưa có Email',
                avatarUrl: rawCustomerAvatar,
                socialId: latestSenderId,
                channel: latest.channel as any,
                channelAccountName: channelName,
                leadStatus: (matchedCust?.leadStatus as any) || 'NEW',
                leadStage: matchedCust?.leadStage || undefined,
                tags: ['Facebook Lead'],
                interestCourses: matchedCust?.interestCourses || [],
                estimatedValue: matchedCust?.estimatedValue || 0,
                notes: [],
              },
              messages: formattedMessages,
            };
            updated.unshift(newConv);
          }
        }
        return updated;
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
      const fbChannels = channels.filter((c: any) => c.channel === 'FACEBOOK' && c.isActive);

      if (fbChannels.length === 0) {
        notify.warning('Chưa có Fanpage Facebook nào được kích hoạt trong Workspace. Vui lòng kết nối Fanpage trước.');
        return;
      }

      let totalSynced = 0;
      for (const ch of fbChannels) {
        try {
          const res = await apiClient.syncChannel(ch.id as string);
          totalSynced += res.syncedCount;
        } catch (err) {
          notify.warning(`Không thể kéo tin từ ${(ch as any).displayName}: ${(err as Error).message}`);
        }
      }

      if (totalSynced > 0) {
        await loadSavedMessages();
        notify.success(`Đã kéo thành công ${totalSynced} tin nhắn từ Fanpage Facebook vào Hộp thư!`, 'Đồng bộ hoàn tất');
      } else {
        notify.info('Đã quét Fanpage: Hiện chưa có tin nhắn khách hàng mới nào cần kéo về.');
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
        const exists = prev.some((c) => c.id === targetId);

        const newChatMsg = {
          id: msg.id,
          conversationId: targetId,
          direction: msg.direction || ('INBOUND' as const),
          content: msg.content,
          sentAt: msg.sentAt || 'Vừa xong',
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          status: 'DELIVERED' as const,
        };

        if (exists) {
          return prev.map((c) => {
            if (c.id !== targetId) return c;
            const isCurrentlyOpen = c.id === selectedId;
            return {
              ...c,
              snippet: msg.content,
              lastMessageAt: 'Vừa xong',
              lastCustomerMessageAt: new Date().toISOString(),
              unreadCount: isCurrentlyOpen ? 0 : c.unreadCount + 1,
              messages: [...c.messages, newChatMsg],
            };
          });
        }

        // Tự động tạo cuộc hội thoại mới khi nhận được tin nhắn từ khách hàng qua Webhook
        const newConv: ConversationItem = {
          id: targetId,
          channel: msg.channel,
          channelAccountName: `Kênh ${msg.channel}`,
          snippet: msg.content,
          lastMessageAt: 'Vừa xong',
          lastCustomerMessageAt: new Date().toISOString(),
          unreadCount: 1,
          tags: ['Khách hàng mới'],
          status: 'OPEN',
          customer: {
            id: `cust-${Date.now()}`,
            fullName: msg.senderName || `Khách hàng (${msg.channel})`,
            phone: msg.customerPhone || 'Chưa có SĐT',
            email: msg.customerEmail || 'Chưa có Email',
            avatarUrl: msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'Lead')}&background=0284c7&color=fff&bold=true`,
            socialId: msg.id,
            channel: msg.channel,
            channelAccountName: `Kênh ${msg.channel}`,
            leadStatus: 'NEW',
            tags: ['Khách hàng mới'],
            interestCourses: [],
            notes: [],
          },
          messages: [newChatMsg],
        };

        if (!selectedId) {
          setSelectedId(targetId);
        }

        return [newConv, ...prev];
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

  // 1. Gửi tin nhắn phản hồi (Outbound)
  const handleSendMessage = (text: string, attachments?: MessageAttachment[]) => {
    if (!currentConv) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      conversationId: currentConv.id,
      direction: 'OUTBOUND' as const,
      content: text,
      sentAt: 'Vừa xong',
      senderName: staffName ? `${staffName} (Bạn)` : 'Bạn',
      status: 'SENT' as const,
      attachments,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          snippet: text || (attachments ? `[Đính kèm ${attachments.length} tệp]` : ''),
          lastMessageAt: 'Vừa xong',
          messages: [...c.messages, newMsg],
        };
      })
    );
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

    let stageForKanban: LeadStage = currentConv.customer.leadStage || 'STAGE_NEW';
    if (!currentConv.customer.leadStage) {
      if (status === 'CONVERTED') stageForKanban = 'STAGE_ENROLLED';
      else if (status === 'POTENTIAL') stageForKanban = 'STAGE_QUALIFIED';
      else if (status === 'UNQUALIFIED') stageForKanban = 'STAGE_LOST';
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
      (s) => s.id === stage || s.id === `STAGE_${stage}` || s.id.replace('STAGE_', '') === stage
    );
    const stageIdx = config.pipelineStages.findIndex(
      (s) => s.id === stage || s.id === `STAGE_${stage}` || s.id.replace('STAGE_', '') === stage
    );
    const isFirstStage = stageIdx === 0 || targetStageConfig?.order === 1;

    let computedStatus: LeadStatus = 'POTENTIAL';
    if (targetStageConfig?.isWon) {
      computedStatus = 'CONVERTED';
    } else if (targetStageConfig?.isLost) {
      computedStatus = 'UNQUALIFIED';
    } else if (isFirstStage || stage === 'STAGE_NEW' || stage === 'NEW') {
      computedStatus = 'NEW';
    } else {
      const upper = String(stage).toUpperCase();
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
          customer: { ...c.customer, leadStage: stage, leadStatus: computedStatus },
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
                stage,
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
        leadStage: stage,
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
            leadStage: stage,
            leadStatus: computedStatus,
          },
        })
      );
    }

    notify.success(`Đã chuyển sang giai đoạn "${targetStageConfig?.name || stage}".`);
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
