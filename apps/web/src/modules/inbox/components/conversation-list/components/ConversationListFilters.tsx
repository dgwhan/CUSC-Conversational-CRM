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
}

export const ConversationListFilters: React.FC<ConversationListFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedChannel,
  onChannelChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Thanh tìm kiếm chuẩn CUS-05 */}
      <div className="w-full">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Tìm theo tên (không dấu), SĐT, tin nhắn..."
          size="sm"
          className="w-full"
        />
      </div>

      {/* Bộ lọc kênh dạng Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar scrollbar-none">
        <button
          type="button"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
            selectedChannel === 'ALL'
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm shadow-blue-500/20'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-800'
          }`}
          onClick={() => onChannelChange('ALL')}
        >
          {t('common.all')}
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
            selectedChannel === 'FACEBOOK'
              ? 'bg-[#1877F2] text-white border-[#1877F2] shadow-sm shadow-blue-500/20'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-[#1877F2] hover:border-blue-200'
          }`}
          onClick={() => onChannelChange('FACEBOOK')}
        >
          Facebook
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
            selectedChannel === 'ZALO'
              ? 'bg-[#0068FF] text-white border-[#0068FF] shadow-sm shadow-sky-500/20'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-[#0068FF] hover:border-sky-200'
          }`}
          onClick={() => onChannelChange('ZALO')}
        >
          Zalo
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
            selectedChannel === 'TIKTOK'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/20'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
          }`}
          onClick={() => onChannelChange('TIKTOK')}
        >
          TikTok
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
            selectedChannel === 'INSTAGRAM'
              ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-pink-500 shadow-sm shadow-pink-500/20'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200'
          }`}
          onClick={() => onChannelChange('INSTAGRAM')}
        >
          Instagram
        </button>
      </div>

      {/* Dropdown lọc trạng thái phụ */}
      <div className="w-full">
        <select
          className="w-full h-7 px-2 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors cursor-pointer"
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as ConversationStatusFilter)
          }
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="UNREAD">{t('inbox.filterUnread')}</option>
          <option value="ASSIGNED_TO_ME">{t('inbox.filterAssignedToMe')}</option>
          <option value="UNASSIGNED">{t('inbox.filterUnassigned')}</option>
        </select>
      </div>
    </>
  );
};
