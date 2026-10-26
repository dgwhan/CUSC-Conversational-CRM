import React, { useState, useEffect } from 'react';
import type { ConversationItem, LeadStatus, LeadStage, MessageAttachment, AssignedStaff } from '../types.js';
import { INITIAL_CONVERSATIONS, MOCK_QUICK_REPLIES } from '../mockData.js';
import { ConversationListColumn } from '../components/ConversationListColumn.js';
import { ChatWindowColumn } from '../components/ChatWindowColumn.js';
import { CustomerProfileColumn } from '../components/CustomerProfileColumn.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';
import { useUserRole } from '../../auth/index.js';
import { MessageSquare } from 'lucide-react';

interface UnifiedInboxPageProps {
  onNavigateToKanban?: () => void;
  initialConversationId?: string | null;
}

export const UnifiedInboxPage: React.FC<UnifiedInboxPageProps> = ({
  onNavigateToKanban,
  initialConversationId,
}) => {
  const { onNewMessage, staffPresences, setUnreadCount } = useRealtime();
  const { staffName } = useUserRole();
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    try {
      const saved = localStorage.getItem('crm_inbox_conversations_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
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
            avatarUrl: msg.senderAvatar || '',
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
    notify.success(`Đã cập nhật trạng thái khách hàng sang "${status}".`);
  };

  // 5. Chuyển giai đoạn tuyển sinh Kanban
  const handleUpdateLeadStage = (stage: LeadStage) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: { ...c.customer, leadStage: stage },
        };
      })
    );
    notify.success(`Đã cập nhật phễu tuyển sinh sang "${stage}".`);
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

  return (
    <div className={`pancake-inbox-container ${selectedId ? 'has-active-chat' : ''}`}>
      {/* CỘT 1 (Trái): Danh sách Hội thoại */}
      <ConversationListColumn
        conversations={conversations}
        selectedId={currentConv?.id || null}
        onSelect={handleSelectConversation}
      />

      {/* CỘT 2 (Giữa): Cửa sổ Chat Trực tuyến hoặc Placeholder trống */}
      {currentConv ? (
        <ChatWindowColumn
          conversation={currentConv}
          staffList={staffList}
          quickReplies={MOCK_QUICK_REPLIES}
          onSendMessage={handleSendMessage}
          onAssignStaff={handleAssignStaff}
          onToggleStatus={handleToggleStatus}
          onBackToList={() => setSelectedId(null)}
          onToggleProfile={() => setIsProfileMobileOpen((prev) => !prev)}
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
          isMobileOpen={isProfileMobileOpen}
          onCloseMobile={() => setIsProfileMobileOpen(false)}
        />
      )}
    </div>
  );
};
