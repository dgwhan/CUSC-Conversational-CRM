import React from 'react';
import type {
  ConversationListColumnProps,
  ConversationChannelFilter,
  ConversationStatusFilter,
} from '../../types.js';
import {
  useConversationFilter,
  ConversationListHeader,
  ConversationListFilters,
  ConversationCard,
  EmptyConversationList,
} from './index.js';

export type {
  ConversationListColumnProps,
  ConversationChannelFilter,
  ConversationStatusFilter,
};

export const ConversationListColumn: React.FC<ConversationListColumnProps> = ({
  conversations,
  selectedId,
  onSelect,
  onSyncFacebook,
  isSyncingFacebook,
  onSyncZalo,
  isSyncingZalo,
  channelAccounts,
  alertThresholdMinutes = 15,
  isSyncing,
}) => {
  const syncingFb = isSyncingFacebook ?? isSyncing;
  const syncingZl = isSyncingZalo ?? false;

  const {
    searchQuery,
    setSearchQuery,
    selectedChannel,
    setSelectedChannel,
    selectedZaloAccount,
    setSelectedZaloAccount,
    zaloAccounts,
    statusFilter,
    setStatusFilter,
    filteredConversations,
    totalUnread,
  } = useConversationFilter({
    conversations,
    channelAccounts,
    alertThresholdMinutes,
  });

  return (
    <aside className="pancake-col-left w-[300px] min-w-[300px] max-w-[300px] border-r border-slate-200/80 bg-slate-50/50 flex flex-col h-full shrink-0 select-none">
      <div className="p-3 pb-2.5 border-b border-slate-200/80 flex flex-col gap-2.5 bg-white shrink-0">
        <ConversationListHeader
          totalCount={conversations.length}
          totalUnread={totalUnread}
          onSyncFacebook={onSyncFacebook}
          isSyncingFacebook={syncingFb}
          onSyncZalo={onSyncZalo}
          isSyncingZalo={syncingZl}
        />

        <ConversationListFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          selectedZaloAccount={selectedZaloAccount}
          onZaloAccountChange={setSelectedZaloAccount}
          zaloAccounts={zaloAccounts}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          alertThresholdMinutes={alertThresholdMinutes}
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 custom-scrollbar scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <EmptyConversationList />
        ) : (
          filteredConversations.map((item) => (
            <ConversationCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onSelect={onSelect}
              alertThresholdMinutes={alertThresholdMinutes}
            />
          ))
        )}
      </div>
    </aside>
  );
};
