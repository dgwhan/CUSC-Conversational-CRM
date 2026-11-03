import { useState, useRef, useEffect, useCallback } from 'react';
import type { ConversationItem, MessageAttachment } from '../../../types.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import { useTranslation } from '../../../../../i18n/index.js';

export interface UseChatComposerOptions {
  conversation: ConversationItem;
  onSendMessage: (text: string, attachments?: MessageAttachment[]) => void;
}

export function useChatComposer({ conversation, onSendMessage }: UseChatComposerOptions) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Tự động cuộn xuống tin nhắn cuối cùng khi có tin mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Kiểm tra thời hạn 24 giờ của Meta (Facebook Messenger)
  const lastCustomerMessageTime = conversation.lastCustomerMessageAt
    ? new Date(conversation.lastCustomerMessageAt).getTime()
    : Number.NaN;

  const hoursDiff = (currentTimestamp - lastCustomerMessageTime) / (1000 * 60 * 60);
  const isWithin24Hours = Number.isFinite(hoursDiff) && hoursDiff >= 0 && hoursDiff < 24;
  const hoursRemaining = Number.isFinite(hoursDiff) ? Math.max(0, Math.floor(24 - hoursDiff)) : 0;

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    if (conversation.channel === 'FACEBOOK' && !isWithin24Hours) {
      notify.warning(
        'Đã hết cửa sổ phản hồi 24 giờ của Facebook. Chờ khách nhắn lại hoặc dùng phương thức được Meta cho phép.',
      );
      return;
    }
    onSendMessage(inputText.trim());
    setInputText('');
  }, [conversation.channel, inputText, isWithin24Hours, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickReplySelect = useCallback((content: string) => {
    setInputText((prev) => (prev ? `${prev} ${content}` : content));
  }, []);

  const handleSimulateVoice = useCallback(() => {
    setIsRecording(true);
    notify.info(t('inbox.chatInput.voiceRecordingNotice'));
    setTimeout(() => {
      setIsRecording(false);
      onSendMessage('Tin nhắn thoại (Ghi âm từ nhân viên tư vấn CUSC)', [
        {
          id: `att-voice-${Date.now()}`,
          type: 'AUDIO',
          url: 'https://example.com/audio/voice-sample.mp3',
          name: 'tuvan_khoahoc_cusc.mp3',
          duration: '0:35',
        },
      ]);
      notify.success(t('inbox.chatInput.voiceSentSuccess'));
    }, 2000);
  }, [onSendMessage, t]);

  const handleAttachSimulated = useCallback(() => {
    notify.info(t('inbox.chatInput.attachSimulated'));
  }, [t]);

  const handleAttachImageSimulated = useCallback(() => {
    onSendMessage('Đã gửi tài liệu / hình ảnh minh họa', [
      {
        id: `att-img-${Date.now()}`,
        type: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60',
        name: 'chung_chi_polarisx.jpg',
      },
    ]);
  }, [onSendMessage]);

  const handleInsertEmoji = useCallback(() => {
    setInputText((prev) => `${prev} 😊 `);
  }, []);

  return {
    inputText,
    setInputText,
    isRecording,
    messagesEndRef,
    isWithin24Hours,
    hoursRemaining,
    handleSend,
    handleKeyDown,
    handleQuickReplySelect,
    handleSimulateVoice,
    handleAttachSimulated,
    handleAttachImageSimulated,
    handleInsertEmoji,
  };
}
