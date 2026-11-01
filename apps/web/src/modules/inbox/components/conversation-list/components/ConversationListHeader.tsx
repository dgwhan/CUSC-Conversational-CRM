import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../../i18n/index.js';
import { Button } from '../../../../../components/ui/Button.js';

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[15px] font-bold text-slate-800 m-0">
          {t('inbox.conversationsTitle')}
        </h2>
        <span className="text-xs text-slate-400 font-medium">
          ({totalCount})
        </span>
        {totalUnread > 0 && (
          <span className="text-[11px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full shadow-sm shadow-red-500/20 leading-none">
            {totalUnread}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {onSyncFacebook && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={11} className={isSyncingFacebook ? 'animate-spin' : ''} />}
            className="h-[26px] px-2 text-[11px] font-semibold text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100"
            disabled={isSyncingFacebook}
            onClick={onSyncFacebook}
            title="Kéo tin nhắn từ Fanpage Facebook"
          >
            {isSyncingFacebook ? 'Kéo...' : 'FB'}
          </Button>
        )}
        {onSyncZalo && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={11} className={isSyncingZalo ? 'animate-spin' : ''} />}
            className="h-[26px] px-2 text-[11px] font-semibold text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100"
            disabled={isSyncingZalo}
            onClick={onSyncZalo}
            title="Kéo tin nhắn từ Zalo OA & Zalo Cá nhân"
          >
            {isSyncingZalo ? 'Kéo...' : 'Zalo'}
          </Button>
        )}
      </div>
    </div>
  );
};
