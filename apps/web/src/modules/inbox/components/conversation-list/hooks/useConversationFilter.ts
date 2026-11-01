import { useState, useMemo } from 'react';
import type {
  ConversationItem,
  ConversationChannelFilter,
  ConversationStatusFilter,
} from '../../../types.js';
import { useUserRole } from '../../../../auth/UserRoleContext.js';
import { matchesSmartSearch } from '../../../../../lib/unaccent.js';

export interface UseConversationFilterOptions {
  conversations: ConversationItem[];
}

export interface UseConversationFilterReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedChannel: ConversationChannelFilter;
  setSelectedChannel: (channel: ConversationChannelFilter) => void;
  statusFilter: ConversationStatusFilter;
  setStatusFilter: (status: ConversationStatusFilter) => void;
  filteredConversations: ConversationItem[];
  totalUnread: number;
}

/**
 * Hook quản lý nghiệp vụ lọc, phân quyền RBAC và tìm kiếm không dấu cho danh sách hội thoại
 */
export function useConversationFilter({
  conversations,
}: UseConversationFilterOptions): UseConversationFilterReturn {
  const { isAgent, staffId } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ConversationChannelFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>('ALL');

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((item) => {
        // PHƯƠNG ÁN A: Phân quyền theo vai trò (RBAC)
        // Nhân viên tư vấn (AGENT): Chỉ thấy tin nhắn gán cho mình hoặc chưa ai nhận (Unassigned)
        if (isAgent) {
          const isAssignedToMe = item.assignedStaff?.id === staffId;
          const isUnassigned = !item.assignedStaff;
          if (!isAssignedToMe && !isUnassigned) {
            return false;
          }
        }

        // Lọc theo kênh liên lạc
        if (selectedChannel !== 'ALL') {
          if (selectedChannel === 'ZALO') {
            if (item.channel !== 'ZALO' && item.channel !== 'ZALO_PERSONAL') {
              return false;
            }
          } else if (item.channel !== selectedChannel) {
            return false;
          }
        }

        // Lọc theo trạng thái phụ
        if (statusFilter === 'UNREAD' && item.unreadCount === 0) {
          return false;
        }
        if (statusFilter === 'ASSIGNED_TO_ME' && item.assignedStaff?.id !== staffId) {
          return false;
        }
        if (statusFilter === 'UNASSIGNED' && item.assignedStaff) {
          return false;
        }

        // Tìm kiếm thông minh (không dấu + SĐT chuẩn hóa) - CUS-05
        if (searchQuery.trim()) {
          const isMatched = matchesSmartSearch(
            {
              fullName: item.customer.fullName,
              phone: item.customer.phone,
              snippet: item.snippet,
              tags: item.tags,
              notes: (item.customer as any).notes,
            },
            searchQuery
          );
          if (!isMatched) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [conversations, isAgent, staffId, selectedChannel, statusFilter, searchQuery]);

  const totalUnread = useMemo(
    () => filteredConversations.reduce((acc, curr) => acc + curr.unreadCount, 0),
    [filteredConversations]
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedChannel,
    setSelectedChannel,
    statusFilter,
    setStatusFilter,
    filteredConversations,
    totalUnread,
  };
}
