import React from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Smile,
  AtSign,
} from 'lucide-react';
import type { ConversationItem, QuickReplyItem } from '../../../types.js';
import { Button } from '../../../../../components/ui/Button.js';
import { useTranslation } from '../../../../../i18n/index.js';

export interface ChatComposerProps {
  conversation: ConversationItem;
  inputText: string;
  isRecording: boolean;
  isWithin24Hours: boolean;
  quickReplies?: QuickReplyItem[];
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAttachSimulated: () => void;
  onAttachImageSimulated: () => void;
  onSimulateVoice: () => void;
  onInsertEmoji: () => void;
  onQuickReplySelect?: (content: string) => void;
  onOpenQuickReplySettings?: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  conversation,
  inputText,
  isRecording,
  isWithin24Hours,
  quickReplies,
  onInputChange,
  onKeyDown,
  onSend,
  onAttachSimulated,
  onAttachImageSimulated,
  onSimulateVoice,
  onInsertEmoji,
  onQuickReplySelect,
  onOpenQuickReplySettings,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-3 bg-white border-t border-slate-200/80 flex flex-col gap-2 shrink-0 select-none">
      {/* 1. Quick replies: Dạng button xám viền siêu mỏng, tối giản diện tích */}
      {quickReplies && quickReplies.length > 0 && onQuickReplySelect && (
        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 overflow-x-auto no-scrollbar scrollbar-none">
          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
            Mẫu phản hồi:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none">
            {quickReplies.map((item) => (
              <button
                key={item.id}
                type="button"
                className="px-2 py-0.5 text-xs font-normal text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70 rounded transition-colors cursor-pointer truncate max-w-[180px] whitespace-nowrap shrink-0"
                onClick={() => onQuickReplySelect(item.content)}
                title={item.content}
              >
                {item.label}
              </button>
            ))}
          </div>
          {onOpenQuickReplySettings && (
            <button
              type="button"
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 ml-auto"
              onClick={onOpenQuickReplySettings}
              title="Quản lý danh sách tin nhắn mẫu"
            >
              Quản lý
            </button>
          )}
        </div>
      )}

      {/* 2. Khung soạn thảo tin nhắn */}
      <div className="w-full">
        <textarea
          className="w-full min-h-[44px] max-h-[120px] resize-none border border-slate-200/80 rounded-lg px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
          placeholder={
            !isWithin24Hours && conversation.channel === 'FACEBOOK'
              ? 'Đã quá 24h Meta. Cần gắn Message Tag để phản hồi...'
              : `Nhập tin nhắn phản hồi cho ${conversation.customer.fullName}...`
          }
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
      </div>

      {/* 3. Toolbar công cụ & Nút Gửi */}
      <div className="flex items-center justify-between">
        {/* Bên trái: Công cụ đính kèm */}
        <div className="flex items-center gap-0.5 text-slate-400">
          <button
            type="button"
            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('inbox.chatInput.attachFile')}
            onClick={onAttachSimulated}
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('inbox.chatInput.attachImage')}
            onClick={onAttachImageSimulated}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('inbox.chatInput.insertEmoji')}
            onClick={onInsertEmoji}
          >
            <Smile size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title="Chèn ký hiệu @"
            onClick={() => onInputChange(inputText ? `${inputText} @` : '@')}
          >
            <AtSign size={16} />
          </button>
          <button
            type="button"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isRecording ? 'text-red-500 animate-pulse bg-red-50' : 'hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={t('inbox.chatInput.voiceMessage')}
            onClick={onSimulateVoice}
          >
            <Mic size={16} />
          </button>
        </div>

        {/* Bên phải: Nút Gửi */}
        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={<Send size={13} />}
          onClick={onSend}
          disabled={
            !inputText.trim() ||
            (conversation.channel === 'FACEBOOK' && !isWithin24Hours)
          }
        >
          {t('common.send')}
        </Button>
      </div>
    </div>
  );
};
