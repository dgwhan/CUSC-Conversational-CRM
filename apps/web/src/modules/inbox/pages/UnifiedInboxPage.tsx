import React, { useState, useEffect } from 'react';
import type { ConversationItem, LeadStatus, LeadStage, MessageAttachment } from '../types.js';
import { INITIAL_CONVERSATIONS, MOCK_STAFF_LIST, MOCK_QUICK_REPLIES } from '../mockData.js';
import { ConversationListColumn } from '../components/ConversationListColumn.js';
import { ChatWindowColumn } from '../components/ChatWindowColumn.js';
import { CustomerProfileColumn } from '../components/CustomerProfileColumn.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';

interface UnifiedInboxPageProps {
  onNavigateToKanban?: () => void;
  initialConversationId?: string | null;
}

export const UnifiedInboxPage: React.FC<UnifiedInboxPageProps> = ({
  onNavigateToKanban,
  initialConversationId,
}) => {
  const { onNewMessage } = useRealtime();
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId || INITIAL_CONVERSATIONS[0]?.id || null
  );

  // Cập nhật selectedId nếu initialConversationId thay đổi từ bên ngoài (ví dụ bấm Chat từ Kanban)
  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
    }
  }, [initialConversationId]);

  // Lắng nghe sự kiện tin nhắn thời gian thực (Realtime SSE)
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      setConversations((prev) => {
        const targetId = msg.conversationId || prev[0]?.id || 'conv-1';
        const exists = prev.some((c) => c.id === targetId);

        const newChatMsg = {
          id: msg.id,
          conversationId: targetId,
          direction: 'INBOUND' as const,
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
        return prev;
      });
    });

    return unsubscribe;
  }, [onNewMessage, selectedId]);

  const currentConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    // Đánh dấu đã đọc khi nhấp vào hội thoại
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
      attachments,
      sentAt: 'Vừa xong',
      senderName: 'Nguyễn Văn Minh (Bạn)',
      status: 'SENT' as const,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          snippet: text,
          lastMessageAt: 'Vừa xong',
          messages: [...c.messages, newMsg],
        };
      })
    );

    notify.success(
      'Đã gửi tin nhắn phản hồi thành công.',
      `Gửi đến ${currentConv.customer.fullName}`
    );

    // Mô phỏng khách hàng phản hồi sau 4 giây (nếu gửi tin nhắn mới)
    if (!attachments) {
      setTimeout(() => {
        const autoReply = {
          id: `msg-${Date.now()}-reply`,
          conversationId: currentConv.id,
          direction: 'INBOUND' as const,
          content: 'Dạ em cảm ơn thầy cô đã giải đáp nhanh chóng ạ!',
          sentAt: 'Vừa xong',
          senderName: currentConv.customer.fullName,
        };

        setConversations((latest) =>
          latest.map((c) => {
            if (c.id !== currentConv.id) return c;
            return {
              ...c,
              snippet: autoReply.content,
              lastMessageAt: 'Vừa xong',
              lastCustomerMessageAt: new Date().toISOString(),
              messages: [...c.messages, autoReply],
            };
          })
        );

        notify.info(
          `Tin nhắn mới từ ${currentConv.customer.fullName}: "Dạ em cảm ơn..."`,
          `[${currentConv.channel}] Tin nhắn Realtime`
        );
      }, 4000);
    }
  };

  // 2. Phân công nhân sự
  const handleAssignStaff = (staffId: string) => {
    const staff = MOCK_STAFF_LIST.find((s) => s.id === staffId);
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, assignedStaff: staff } : c))
    );
    notify.success(
      staff
        ? `Đã phân công ${staff.name} phụ trách cuộc hội thoại này.`
        : 'Đã hủy phân công nhân sự.'
    );
  };

  // 3. Đổi trạng thái hội thoại
  const handleToggleStatus = () => {
    const nextStatus = currentConv.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, status: nextStatus } : c))
    );
    notify.info(
      nextStatus === 'RESOLVED'
        ? 'Đã chuyển cuộc hội thoại sang trạng thái Hoàn tất / Đã giải quyết.'
        : 'Đã mở lại cuộc hội thoại để tiếp tục tư vấn.'
    );
  };

  // 4. Cập nhật Lead Status
  const handleUpdateLeadStatus = (newStatus: LeadStatus) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            leadStatus: newStatus,
          },
        };
      })
    );
    notify.success(`Đã cập nhật phễu khách hàng sang "${newStatus}".`);
  };

  // 4b. Cập nhật Lead Stage theo 7 giai đoạn tuyển sinh
  const handleUpdateLeadStage = (newStage: LeadStage) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            leadStage: newStage,
          },
        };
      })
    );
  };

  // 5. Thêm nhãn
  const handleAddTag = (tag: string) => {
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
    notify.success(`Đã thêm nhãn "${tag}".`);
  };

  // 6. Xóa nhãn
  const handleRemoveTag = (tag: string) => {
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
    const newNote = {
      id: `note-${Date.now()}`,
      author: 'Nguyễn Văn Minh (Bạn)',
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
    <div className="pancake-inbox-container">
      {/* CỘT 1 (Trái): Danh sách Hội thoại */}
      <ConversationListColumn
        conversations={conversations}
        selectedId={currentConv?.id || null}
        onSelect={handleSelectConversation}
      />

      {/* CỘT 2 (Giữa): Cửa sổ Chat Trực tuyến */}
      {currentConv && (
        <ChatWindowColumn
          conversation={currentConv}
          staffList={MOCK_STAFF_LIST}
          quickReplies={MOCK_QUICK_REPLIES}
          onSendMessage={handleSendMessage}
          onAssignStaff={handleAssignStaff}
          onToggleStatus={handleToggleStatus}
        />
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
        />
      )}
    </div>
  );
};
