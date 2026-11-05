import React from 'react';
import {
  Check,
  CheckCheck,
  FileText,
  Volume2,
} from 'lucide-react';
import type { ChatMessage, CustomerProfile } from '../../../types.js';
import { formatMessageTime } from '../../../utils/conversationUtils.js';
import { Avatar } from '../../../../../components/common/Avatar.js';

export interface MessageBubbleProps {
  message: ChatMessage;
  customer: CustomerProfile;
  hasMultipleChannels: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  customer,
  hasMultipleChannels,
}) => {
  const isOutbound = message.direction === 'OUTBOUND';
  const isZaloChannel =
    (message.senderName || '').toLowerCase().includes('zalo') ||
    (message.conversationId || '').startsWith('ZALO');

  return (
    <div
      className={`flex items-end gap-2 my-1 ${
        isOutbound ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Avatar người gửi tin nhắn đến (Inbound) */}
      {!isOutbound && (
        <Avatar
          src={customer.avatarUrl}
          name={message.senderName}
          size={28}
          className="border border-slate-200/80 shrink-0 mb-1"
        />
      )}

      {/* Khối bong bóng tin nhắn */}
      <div
        className={`max-w-[70%] flex flex-col ${
          isOutbound ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`px-3.5 py-2.5 text-sm leading-relaxed break-words ${
            isOutbound
              ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
              : 'bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm'
          }`}
        >
          {/* Nội dung tin nhắn văn bản */}
          {message.content && (
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Danh sách tệp tin đính kèm */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {message.attachments.map((att) => (
                <div key={att.id}>
                  {att.type === 'IMAGE' && (
                    <img
                      src={att.url}
                      alt={att.name || 'Ảnh đính kèm'}
                      className="max-w-[260px] max-h-[220px] rounded-lg object-cover border border-black/10"
                    />
                  )}

                  {att.type === 'AUDIO' && (
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                        isOutbound
                          ? 'bg-white/20 text-white'
                          : 'bg-white/80 text-slate-700'
                      }`}
                    >
                      <Volume2 size={15} />
                      <span className="truncate max-w-[120px]">{att.name}</span>
                      <span className="opacity-80 font-mono text-[11px]">{att.duration}</span>
                    </div>
                  )}

                  {att.type === 'FILE' && (
                    <div
                      className={`inline-flex items-center gap-2 p-2 rounded-lg text-xs font-medium border ${
                        isOutbound
                          ? 'bg-white/15 border-white/20 text-white'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <FileText size={16} className={isOutbound ? 'text-white' : 'text-blue-500'} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate max-w-[160px]">{att.name}</span>
                        {att.size && (
                          <span className="text-[11px] opacity-75">{att.size}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Meta footer: Channel Tag (nếu đa kênh), Thời gian gửi, Icon đã xem */}
          <div
            className={`flex items-center gap-1.5 mt-1 text-[11px] ${
              isOutbound ? 'justify-end text-blue-200' : 'justify-start text-slate-400'
            }`}
          >
            {hasMultipleChannels && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                  isZaloChannel
                    ? isOutbound ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    : isOutbound ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isZaloChannel ? 'Zalo' : 'FB'}
              </span>
            )}

            <span>{formatMessageTime(message.sentAt)}</span>

            {isOutbound && (
              <span
                className="inline-flex shrink-0"
                title={
                  message.status === 'SEEN'
                    ? 'Đã xem'
                    : message.status === 'DELIVERED'
                    ? 'Đã nhận'
                    : 'Đã gửi'
                }
              >
                {message.status === 'SEEN' ? (
                  <CheckCheck size={13} className="text-white" />
                ) : message.status === 'DELIVERED' ? (
                  <CheckCheck size={13} className="text-blue-200" />
                ) : (
                  <Check size={13} className="text-blue-200" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
