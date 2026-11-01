import React from 'react';
import type {
  ConversationItem,
  AssignedStaff,
} from '../types.js';
import {
  useChatMessagingActions,
  useConversationStatusActions,
  useLeadPipelineActions,
  useCustomerDataActions,
} from './actions/index.js';

export interface UseInboxActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
  staffList: AssignedStaff[];
  config: { pipelineStages: any[] };
  activeWorkspaceId?: string | null;
}

/**
 * Composite Orchestrator Hook quản lý toàn bộ các hành động tương tác trong Unified Inbox.
 * Được phân rã theo Single Responsibility Principle (SRP):
 *  - useChatMessagingActions: Gửi tin nhắn đa kênh (Zalo OA / Facebook Messenger)
 *  - useConversationStatusActions: Phân công nhân sự & đổi trạng thái hội thoại
 *  - useLeadPipelineActions: Cập nhật Lead CRM & đồng bộ Kanban
 *  - useCustomerDataActions: Quản lý nhãn, ghi chú nội bộ, khóa học & thông tin liên hệ
 */
export const useInboxActions = ({
  currentConv,
  setConversations,
  staffName,
  staffList,
  config,
  activeWorkspaceId,
}: UseInboxActionsProps) => {
  // 1. Gửi tin nhắn Outbound
  const { handleSendMessage } = useChatMessagingActions({
    currentConv,
    setConversations,
    staffName,
  });

  // 2. Phân công nhân sự & Trạng thái hội thoại
  const { handleAssignStaff, handleToggleStatus } = useConversationStatusActions({
    currentConv,
    setConversations,
    staffName,
    staffList,
    activeWorkspaceId,
  });

  // 3. Phễu tuyển sinh CRM & Kanban Pipeline
  const { handleUpdateLeadStatus, handleUpdateLeadStage } = useLeadPipelineActions({
    currentConv,
    setConversations,
    staffName,
    config,
    activeWorkspaceId,
  });

  // 4. Dữ liệu khách hàng (Tags, Notes, Khóa học, Thông tin liên hệ)
  const {
    handleAddTag,
    handleRemoveTag,
    handleAddNote,
    handleRemoveNote,
    handleUpdateProducts,
    handleUpdateContactInfo,
  } = useCustomerDataActions({
    currentConv,
    setConversations,
    staffName,
  });

  return {
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
  };
};
