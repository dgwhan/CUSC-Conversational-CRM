import { useState, useMemo } from 'react';
import type {
  ConversationItem,
  ConversationChannelFilter,
  ConversationStatusFilter,
} from '../../../types.js';
import { useUserRole } from '../../../../auth/UserRoleContext.js';
import { matchesSmartSearch } from '../../../../../lib/unaccent.js';
import { getUnresponsiveStatus } from '../../../utils/index.js';

export interface ZaloAccountOption {
  id: string;
  name: string;
}

export interface UseConversationFilterOptions {
  conversations: ConversationItem[];
  channelAccounts?: any[];
  alertThresholdMinutes?: number;
}

export interface UseConversationFilterReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedChannel: ConversationChannelFilter;
  setSelectedChannel: (channel: ConversationChannelFilter) => void;
  selectedZaloAccount: string;
  setSelectedZaloAccount: (accountId: string) => void;
  zaloAccounts: ZaloAccountOption[];
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
  channelAccounts,
  alertThresholdMinutes = 15,
}: UseConversationFilterOptions): UseConversationFilterReturn {
  const { isAgent, staffId } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ConversationChannelFilter>('ALL');
  const [selectedZaloAccount, setSelectedZaloAccount] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>('ALL');

  // Trích xuất danh sách các tài khoản Zalo duy nhất (khi kết nối nhiều Zalo cùng lúc)
  const zaloAccounts = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(channelAccounts)) {
      channelAccounts.forEach((ca) => {
        const isZalo =
          ca.channel === 'ZALO' ||
          ca.isPersonal ||
          ca.metadata?.engine === 'zca-js';
        if (isZalo && ca.isActive !== false) {
          const key = ca.id || ca.displayName;
          const name = ca.displayName || 'Tài khoản Zalo';
          if (key && !map.has(key)) {
            map.set(key, name);
          }
        }
      });
    }

    conversations.forEach((item) => {
      if (item.channel === 'ZALO' || item.channel === 'ZALO_PERSONAL') {
        const key = item.channelAccountId || item.channelAccountName;
        const name = item.channelAccountName || item.customer.channelAccountName || 'Zalo';
        if (key && !map.has(key)) {
          map.set(key, name);
        }
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [channelAccounts, conversations]);

  const handleChannelChange = (channel: ConversationChannelFilter) => {
    setSelectedChannel(channel);
    if (channel !== 'ZALO' && channel !== 'ALL') {
      setSelectedZaloAccount('ALL');
    }
  };

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

        // Lọc theo tài khoản Zalo cụ thể (khi kết nối nhiều Zalo 1 lúc)
        if (selectedZaloAccount !== 'ALL') {
          const isZaloChannel = item.channel === 'ZALO' || item.channel === 'ZALO_PERSONAL';
          if (!isZaloChannel) {
            return false;
          }
          const isMatchAccount =
            item.channelAccountId === selectedZaloAccount ||
            item.channelAccountName === selectedZaloAccount ||
            item.customer.channelAccountName === selectedZaloAccount;
          if (!isMatchAccount) {
            return false;
          }
        }

        // Lọc theo trạng thái phụ
        if (statusFilter === 'UNREAD' && item.unreadCount === 0) {
          return false;
        }
        if (statusFilter === 'UNRESPONSIVE') {
          const { isOverdue } = getUnresponsiveStatus(item, alertThresholdMinutes);
          if (!isOverdue) {
            return false;
          }
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
  }, [
    conversations,
    isAgent,
    staffId,
    selectedChannel,
    selectedZaloAccount,
    statusFilter,
    searchQuery,
    alertThresholdMinutes,
  ]);

  const totalUnread = useMemo(
    () => filteredConversations.reduce((acc, curr) => acc + curr.unreadCount, 0),
    [filteredConversations]
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedChannel,
    setSelectedChannel: handleChannelChange,
    selectedZaloAccount,
    setSelectedZaloAccount,
    zaloAccounts,
    statusFilter,
    setStatusFilter,
    filteredConversations,
    totalUnread,
  };
}
