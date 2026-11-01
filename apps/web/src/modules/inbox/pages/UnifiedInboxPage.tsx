import React, { useState, useEffect, useMemo } from 'react';
import type { AssignedStaff } from '../types.js';
import { InboxZaloAlertBanner } from '../components/InboxZaloAlertBanner.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';
import { useUserRole } from '../../auth/index.js';
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';
import {
  ConversationListColumn,
  ChatWindowColumn,
  CustomerProfileColumn,
  EmptyInboxView,
  QuickReplyModal,
} from '../components/index.js';
import {
  useQuickReplies,
  useChannelSync,
  useInboxConversations,
  useInboxActions,
} from '../hooks/index.js';

export {
  formatMessageTime,
  deduplicateMessages,
  mergeDuplicateConversations,
} from '../utils/index.js';

export interface UnifiedInboxPageProps {
  onNavigateToKanban?: () => void;
  initialConversationId?: string | null;
}

export const UnifiedInboxPage: React.FC<UnifiedInboxPageProps> = ({
  onNavigateToKanban,
  initialConversationId,
}) => {
  const { onNewMessage, onPipelineChange, staffPresences, setUnreadCount } = useRealtime();
  const { staffName, staffId, ownerId, isOwner } = useUserRole();
  const { config, activeWorkspaceId } = useWorkspaceConfig();

  const [isProfileMobileOpen, setIsProfileMobileOpen] = useState(false);

  // 1. Quản lý danh sách nhân sự trực tuyến
  const staffList: AssignedStaff[] = useMemo(
    () =>
      Object.values(staffPresences).map((s) => ({
        id: s.staffId,
        name: s.name,
        avatar: s.avatar,
        role: s.role,
      })),
    [staffPresences]
  );

  // 2. Quản lý tin nhắn nhanh (Quick Replies)
  const {
    quickReplies,
    isQuickReplyModalOpen,
    setIsQuickReplyModalOpen,
    handleSaveQuickReplies,
  } = useQuickReplies();

  // 3. Quản lý hội thoại, nạp dữ liệu, socket realtime và đồng bộ LocalStorage
  const {
    conversations,
    setConversations,
    selectedId,
    setSelectedId,
    currentConv,
    loadSavedMessages,
    handleSelectConversation,
  } = useInboxConversations({
    activeWorkspaceId,
    ownerId,
    isOwner,
    staffId,
    staffName,
    initialConversationId,
    onNewMessage,
    onPipelineChange,
    setUnreadCount,
  });

  // 4. Đồng bộ tin nhắn từ Facebook và Zalo
  const {
    isSyncingFb,
    isSyncingZalo,
    handleSyncFacebook,
    handleSyncZalo,
  } = useChannelSync({
    activeWorkspaceId,
    onSyncCompleted: loadSavedMessages,
  });

  // 5. Thao tác xử lý tin nhắn, phân công, trạng thái Lead, nhãn, ghi chú, khóa học
  const {
    handleSendMessage,
    handleAssignStaff,
    handleToggleStatus,
    handleUpdateLeadStatus,
    handleUpdateLeadStage,
    handleAddTag,
    handleRemoveTag,
    handleAddNote,
    handleRemoveNote,
    handleUpdateProducts,
    handleUpdateContactInfo,
  } = useInboxActions({
    currentConv,
    setConversations,
    staffName,
    staffList,
    config,
    activeWorkspaceId,
  });

  // Cập nhật selectedId nếu initialConversationId thay đổi từ bên ngoài (ví dụ bấm Chat từ Kanban)
  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
    }
  }, [initialConversationId, setSelectedId]);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden">
      {/* Banner cảnh báo thời hạn Zalo cá nhân (< 2h hoặc đã ngắt kết nối) */}
      <InboxZaloAlertBanner />

      <div className={`pancake-inbox-container flex-1 min-h-0 ${selectedId ? 'has-active-chat' : ''}`}>
        {/* CỘT 1 (Trái): Danh sách Hội thoại */}
      <ConversationListColumn
        conversations={conversations}
        selectedId={currentConv?.id || null}
        onSelect={handleSelectConversation}
        onSyncFacebook={handleSyncFacebook}
        isSyncingFacebook={isSyncingFb}
        onSyncZalo={handleSyncZalo}
        isSyncingZalo={isSyncingZalo}
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
        <EmptyInboxView />
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
    </div>
  );
};
