import React, { type RefObject } from 'react';
import type { ConversationItem } from '../../../types.js';
import { getDateDividerLabel } from '../../../utils/conversationUtils.js';
import { MessageBubble } from './MessageBubble.js';

export interface MessageStreamProps {
  conversation: ConversationItem;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export const MessageStream: React.FC<MessageStreamProps> = ({
  conversation,
  messagesEndRef,
}) => {
  const messages = conversation.messages;
  const hasMultipleChannels = (conversation.customer.channelIdentities || []).length > 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-white custom-scrollbar scrollbar-thin">
      {messages.map((msg, index) => {
        const currentDateLabel = getDateDividerLabel(msg.sentAt);
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const prevDateLabel = prevMsg ? getDateDividerLabel(prevMsg.sentAt) : null;
        const showDateDivider = index === 0 || currentDateLabel !== prevDateLabel;

        return (
          <React.Fragment key={msg.id}>
            {/* Phân cách ngày */}
            {showDateDivider && (
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full select-none border border-slate-200/60">
                  {currentDateLabel}
                </span>
              </div>
            )}

            {/* Bong bóng tin nhắn */}
            <MessageBubble
              message={msg}
              customer={conversation.customer}
              hasMultipleChannels={hasMultipleChannels}
            />
          </React.Fragment>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
};
