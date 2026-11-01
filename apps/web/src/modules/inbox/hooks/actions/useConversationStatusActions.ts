import React from 'react';
import type {
  ConversationItem,
  AssignedStaff,
} from '../../types.js';
import { apiClient } from '../../../../lib/api-client.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

interface UseConversationStatusActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
  staffList: AssignedStaff[];
  activeWorkspaceId?: string | null;
}

export const useConversationStatusActions = ({
  currentConv,
  setConversations,
  staffName,
  staffList,
  activeWorkspaceId,
}: UseConversationStatusActionsProps) => {
  // 1. Phân công nhân sự
  const handleAssignStaff = (staffId: string) => {
    if (!currentConv) return;
    const staff = staffId
      ? staffList.find((s) => s.id === staffId) ||
        (currentConv.assignedStaff?.id === staffId
          ? currentConv.assignedStaff
          : { id: staffId, name: staffName || 'Tư vấn viên', role: 'Tư vấn viên', avatar: '' })
      : undefined;

    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, assignedStaff: staff } : c))
    );

    if (currentConv.customer?.id) {
      apiClient
        .updateCustomer(
          currentConv.customer.id,
          {
            assignedStaffId: staff?.id || null,
            assignedStaffName: staff?.name || null,
            conversationId: currentConv.id,
          },
          activeWorkspaceId || undefined
        )
        .catch(() => {});
    }

    notify.success(
      staff
        ? `Đã phân công ${staff.name} phụ trách cuộc hội thoại này.`
        : 'Đã hủy phân công nhân sự.'
    );
  };

  // 2. Đổi trạng thái hội thoại (OPEN / RESOLVED)
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

  return {
    handleAssignStaff,
    handleToggleStatus,
  };
};
