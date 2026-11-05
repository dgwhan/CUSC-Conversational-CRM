import React from 'react';
import type {
  ConversationChannelFilter,
  ConversationStatusFilter,
} from '../../../types.js';
import { useTranslation } from '../../../../../i18n/index.js';
import { SearchInput } from '../../../../../components/ui/SearchInput.js';

export interface ConversationListFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedChannel: ConversationChannelFilter;
  onChannelChange: (channel: ConversationChannelFilter) => void;
  statusFilter: ConversationStatusFilter;
  onStatusFilterChange: (status: ConversationStatusFilter) => void;
  zaloAccounts?: { id: string; name: string }[];
  selectedZaloAccount?: string;
  onZaloAccountChange?: (accountId: string) => void;
  alertThresholdMinutes?: number;
}

export const ConversationListFilters: React.FC<ConversationListFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedChannel,
  onChannelChange,
  statusFilter,
  onStatusFilterChange,
  zaloAccounts,
  selectedZaloAccount,
  onZaloAccountChange,
  alertThresholdMinutes = 15,
}) => {
  const { t } = useTranslation();

  const channels: Array<{ id: ConversationChannelFilter; label: string; badge?: string }> = [
    { id: 'ALL', label: t('common.all') },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'ZALO', label: 'Zalo', badge: zaloAccounts && zaloAccounts.length > 1 ? `${zaloAccounts.length}` : undefined },
    { id: 'TIKTOK', label: 'TikTok' },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* 1. Thanh tìm kiếm chuẩn CUS-05 */}
      <div className="w-full">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Tìm tên, SĐT, tin nhắn..."
          size="sm"
          className="w-full text-xs"
        />
      </div>

      {/* 2. Tabs kênh dạng Segment Control tinh gọn chuẩn B2B SaaS */}
      <div className="w-full bg-slate-100 p-0.5 rounded-lg flex items-center text-xs font-medium text-slate-500">
        {channels.map((ch) => {
          const isActive = selectedChannel === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onChannelChange(ch.id)}
              className={`flex-1 py-1 text-center rounded-md transition-all cursor-pointer truncate ${
                isActive
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <span>{ch.label}</span>
              {ch.badge && <span className="ml-1 opacity-70 text-[10px]">({ch.badge})</span>}
            </button>
          );
        })}
      </div>

      {/* 3. Tài khoản Zalo phụ (nếu có nhiều Zalo) */}
      {selectedChannel === 'ZALO' && zaloAccounts && zaloAccounts.length > 1 && (
        <div className="w-full flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-md">
          <span className="text-[11px] font-medium text-slate-500 shrink-0">TK:</span>
          <select
            className="flex-1 h-5 text-[11px] font-medium text-slate-700 bg-transparent border-0 focus:outline-none cursor-pointer truncate"
            value={selectedZaloAccount || 'ALL'}
            onChange={(e) => onZaloAccountChange?.(e.target.value)}
          >
            <option value="ALL">Tất cả ({zaloAccounts.length})</option>
            {zaloAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Dropdown lọc trạng thái phụ tinh tế */}
      <div className="w-full">
        <select
          className="w-full h-7 px-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-colors cursor-pointer"
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as ConversationStatusFilter)
          }
        >
          <option value="ALL">Mọi trạng thái hội thoại</option>
          <option value="UNREAD">{t('inbox.filterUnread')}</option>
          {alertThresholdMinutes !== undefined && alertThresholdMinutes > 0 && (
            <option value="UNRESPONSIVE">
              Chưa phản hồi (&gt; {alertThresholdMinutes} phút)
            </option>
          )}
          <option value="OUT_OF_OFFICE">
            🌙 Ngoài giờ - Cần tư vấn hôm sau
          </option>
          <option value="ASSIGNED_TO_ME">{t('inbox.filterAssignedToMe')}</option>
          <option value="UNASSIGNED">{t('inbox.filterUnassigned')}</option>
        </select>
      </div>
    </div>
  );
};
