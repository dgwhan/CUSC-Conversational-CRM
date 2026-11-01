import React from 'react';
import type { CustomerProfile } from '../../../types.js';
import { Button } from '../../../../../components/ui/Button.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';

export interface LinkedConversationsBannerProps {
  customer: CustomerProfile;
  onSelectConversation?: (conversationId: string) => void;
}

export const LinkedConversationsBanner: React.FC<LinkedConversationsBannerProps> = ({
  customer,
  onSelectConversation,
}) => {
  const linked = customer.linkedConversations || [];
  if (linked.length === 0) return null;

  return (
    <div className="px-4 py-2 bg-sky-50/90 border-b border-sky-100 flex items-center justify-between text-xs gap-3">
      <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
        <span className="font-semibold text-sky-800 shrink-0">Kênh liên kết:</span>
        <span className="text-slate-600 truncate">
          Khách hàng có {linked.length} cuộc hội thoại khác trên{' '}
          {linked.map((lc) => lc.channelAccountName || lc.channel).join(', ')}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {linked.map((lc) => {
          const meta = resolveChannelInfo(lc.channel);
          return (
            <Button
              key={lc.id}
              type="button"
              variant="secondary"
              size="sm"
              className="h-[26px] px-2 text-[11px] gap-1 font-semibold text-sky-700 bg-white border-sky-200 hover:bg-sky-50 shadow-none"
              icon={
                meta.iconUrl ? (
                  <img
                    src={meta.iconUrl}
                    alt={meta.label}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                ) : undefined
              }
              onClick={() => onSelectConversation && onSelectConversation(lc.id)}
              title={`Chuyển sang xem cuộc hội thoại trên ${meta.label}`}
            >
              Xem {meta.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

