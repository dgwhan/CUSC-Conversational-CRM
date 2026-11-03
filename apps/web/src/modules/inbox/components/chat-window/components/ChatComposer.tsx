import React from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Smile,
  AtSign,
  Settings,
  Zap,
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
    <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0 select-none">
      {/* 1. Hàng Tin nhanh di chuyển LÊN TRÊN theo yêu cầu */}
      {quickReplies && quickReplies.length > 0 && onQuickReplySelect && (
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100 overflow-x-auto no-scrollbar scrollbar-none">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 whitespace-nowrap shrink-0">
            <Zap size={13} className="text-amber-500" />
            <span>Tin nhanh:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none">
            {quickReplies.map((item) => (
              <button
                key={item.id}
                type="button"
                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100/80 rounded-md transition-colors cursor-pointer truncate max-w-[200px] whitespace-nowrap shrink-0"
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
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ml-auto"
              onClick={onOpenQuickReplySettings}
              title="Tùy chỉnh danh sách tin nhắn nhanh"
            >
              <Settings size={11} />
              <span>Tùy chỉnh</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Khung soạn thảo tin nhắn (Input text gọn gàng, thanh thoát) */}
      <div className="w-full">
        <textarea
          className="w-full min-h-[46px] max-h-[120px] resize-none border border-slate-200 rounded-xl px-3 py-2 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-none"
          placeholder={
            !isWithin24Hours && conversation.channel === 'FACEBOOK'
              ? 'Đã quá 24h Meta. Cần gắn Message Tag để phản hồi...'
              : `Nhập tin nhắn phản hồi cho ${conversation.customer.fullName}... (Enter để gửi)`
          }
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
      </div>

      {/* 3. Hàng Toolbar công cụ & Nút Gửi (Đã BỎ dropdown Ghi chú nội bộ thừa) */}
      <div className="flex items-center justify-between">
        {/* Bên trái: Các công cụ đính kèm tệp, ảnh, emoji, tag, mic */}
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            title={t('inbox.chatInput.attachFile')}
            onClick={onAttachSimulated}
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            title={t('inbox.chatInput.attachImage')}
            onClick={onAttachImageSimulated}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            title={t('inbox.chatInput.insertEmoji')}
            onClick={onInsertEmoji}
          >
            <Smile size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            title="Nhắc đến hoặc chèn mã mẫu"
            onClick={() => onInputChange(inputText ? `${inputText} @` : '@')}
          >
            <AtSign size={16} />
          </button>
          <button
            type="button"
            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
              isRecording ? 'text-red-500 animate-pulse bg-red-50' : 'hover:text-slate-800'
            }`}
            title={t('inbox.chatInput.voiceMessage')}
            onClick={onSimulateVoice}
          >
            <Mic size={16} />
          </button>
        </div>

        {/* Bên phải: Nút Gửi duy nhất, không còn dropdown thừa gây chật chội */}
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
          className="h-8 px-4 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-1.5 cursor-pointer"
          title={
            conversation.channel === 'FACEBOOK' && !isWithin24Hours
              ? 'Đã hết cửa sổ phản hồi 24 giờ của Facebook'
              : 'Gửi tin nhắn (Enter)'
          }
        >
          Gửi
        </Button>
      </div>
    </div>
  );
};
