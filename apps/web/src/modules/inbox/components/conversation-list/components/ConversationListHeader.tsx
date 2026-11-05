import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../../i18n/index.js';

export interface ConversationListHeaderProps {
  totalCount: number;
  totalUnread: number;
  onSyncFacebook?: () => void;
  isSyncingFacebook?: boolean;
  onSyncZalo?: () => void;
  isSyncingZalo?: boolean;
}

export const ConversationListHeader: React.FC<ConversationListHeaderProps> = ({
  totalCount,
  totalUnread,
  onSyncFacebook,
  isSyncingFacebook,
  onSyncZalo,
  isSyncingZalo,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between pb-1">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900 m-0">
          {t('inbox.conversationsTitle')}
        </h2>
        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          {totalCount}
        </span>
        {totalUnread > 0 && (
          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 rounded-full leading-none">
            {totalUnread} mới
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onSyncFacebook && (
          <button
            type="button"
            disabled={isSyncingFacebook}
            onClick={onSyncFacebook}
            className="inline-flex items-center gap-1 h-6 px-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Đồng bộ tin nhắn Fanpage Facebook"
          >
            <RefreshCw size={10} className={isSyncingFacebook ? 'animate-spin text-blue-600' : 'text-slate-400'} />
            <span>FB</span>
          </button>
        )}
        {onSyncZalo && (
          <button
            type="button"
            disabled={isSyncingZalo}
            onClick={onSyncZalo}
            className="inline-flex items-center gap-1 h-6 px-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Đồng bộ tin nhắn Zalo"
          >
            <RefreshCw size={10} className={isSyncingZalo ? 'animate-spin text-blue-600' : 'text-slate-400'} />
            <span>Zalo</span>
          </button>
        )}
      </div>
    </div>
  );
};
