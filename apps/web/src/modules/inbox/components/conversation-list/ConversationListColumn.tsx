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
  isSyncing,
}) => {
  const syncingFb = isSyncingFacebook ?? isSyncing;
  const syncingZl = isSyncingZalo ?? false;

  const {
    searchQuery,
    setSearchQuery,
    selectedChannel,
    setSelectedChannel,
    statusFilter,
    setStatusFilter,
    filteredConversations,
    totalUnread,
  } = useConversationFilter({ conversations });

  return (
    <aside className="pancake-col-left w-[320px] min-w-[300px] max-w-[340px] border-r border-slate-200 bg-white flex flex-col h-full shrink-0 select-none">
      <div className="p-3.5 pb-2.5 border-b border-slate-200 flex flex-col gap-2.5 bg-white shrink-0">
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
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredConversations.length === 0 ? (
          <EmptyConversationList />
        ) : (
          filteredConversations.map((item) => (
            <ConversationCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
};
