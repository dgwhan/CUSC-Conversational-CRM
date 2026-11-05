import React, { useState, useEffect, useMemo } from 'react';
import type { AssignedStaff } from '../types.js';
import { useRealtime } from '../../realtime/RealtimeContext.js';
import { useUserRole } from '../../auth/index.js';
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';
import {
  ConversationListColumn,
  ChatWindowColumn,
  CustomerProfileColumn,
  EmptyInboxView,
  QuickReplyModal,
  InboxZaloAlertBanner,
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
  const { staffName, staffId, ownerId, isOwner, staffEmail } = useUserRole();
  const { config, activeWorkspaceId, staffMembers, isCurrentWorkspaceOwner } = useWorkspaceConfig();

  const [isProfileMobileOpen, setIsProfileMobileOpen] = useState(false);

  // 1. Quản lý danh sách nhân sự (lấy chuẩn vai trò thực từ hệ thống: OWNER, STAFF)
  const staffList: AssignedStaff[] = useMemo(() => {
    const isOwnerEffective = Boolean(isOwner || isCurrentWorkspaceOwner);
    const matchedCurrentMember = staffMembers?.find(
      (m) => m.id === staffId || (staffEmail && m.email === staffEmail)
    );
    const currentUserRole = matchedCurrentMember
      ? matchedCurrentMember.role === 'OWNER'
        ? 'Chủ doanh nghiệp'
        : 'Tư vấn viên'
      : isOwnerEffective
        ? 'Chủ doanh nghiệp'
        : 'Tư vấn viên';
    const presenceById = new Map(Object.values(staffPresences).map((presence) => [presence.staffId, presence]));

    if (staffMembers?.length) {
      const membersByIdentity = new Map<string, (typeof staffMembers)[number]>();
      for (const member of staffMembers) {
        const identity = member.email.trim().toLowerCase() || member.id;
        const existing = membersByIdentity.get(identity);
        if (!existing || (member.role === 'OWNER' && existing.role !== 'OWNER')) {
          membersByIdentity.set(identity, member);
        }
      }

      return Array.from(membersByIdentity.values()).map((member) => {
        const presence = presenceById.get(member.id);
        const isCurrentUser = member.id === staffId || (staffEmail && member.email === staffEmail);
        return {
          id: member.id,
          name: isCurrentUser
            ? `${member.fullName || member.email} (Bạn)`
            : member.fullName || member.email,
          avatar: presence?.avatar || '',
          role: member.role === 'OWNER' ? 'Chủ doanh nghiệp' : 'Tư vấn viên',
          presenceStatus: presence?.status,
        };
      });
    }

    const list: AssignedStaff[] = Object.values(staffPresences).map((presence) => ({
      id: presence.staffId,
      name: presence.staffId === staffId
        ? (presence.name.includes('(Bạn)') ? presence.name : `${presence.name} (Bạn)`)
        : presence.name,
      avatar: presence.avatar,
      role: presence.staffId === staffId ? currentUserRole : 'Tư vấn viên',
      presenceStatus: presence.status,
    }));

    if (staffId && !list.some((member) => member.id === staffId)) {
      list.unshift({
        id: staffId,
        name: staffName ? `${staffName} (Bạn)` : 'Bạn',
        avatar: '',
        role: currentUserRole,
      });
    }

    return list;
  }, [
    staffPresences,
    staffId,
    staffName,
    staffEmail,
    isOwner,
    isCurrentWorkspaceOwner,
    staffMembers,
  ]);

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
    channelAccounts,
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

      <div className={`pancake-inbox-container flex flex-1 min-h-0 h-full w-full overflow-hidden bg-slate-50/50 ${selectedId ? 'has-active-chat' : ''}`}>
        {/* CỘT 1 (Trái): Danh sách Hội thoại */}
        <ConversationListColumn
          conversations={conversations}
          selectedId={currentConv?.id || null}
          onSelect={handleSelectConversation}
          onSyncFacebook={handleSyncFacebook}
          isSyncingFacebook={isSyncingFb}
          onSyncZalo={handleSyncZalo}
          isSyncingZalo={isSyncingZalo}
          channelAccounts={channelAccounts}
          alertThresholdMinutes={config.unresponsiveAlertMinutes ?? 15}
        />

        {/* CỘT 2 (Giữa): Cửa sổ Chat Trực tuyến hoặc Placeholder trống */}
        {currentConv ? (
          <ChatWindowColumn
            conversation={currentConv}
            staffList={staffList}
            quickReplies={quickReplies}
            alertThresholdMinutes={config.unresponsiveAlertMinutes ?? 15}
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
            messages={currentConv.messages}
            assignedStaff={currentConv.assignedStaff}
            staffList={staffList}
            onAssignStaff={handleAssignStaff}
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
