import React from 'react';
import type { ChatWindowColumnProps } from '../../types.js';
import {
  useChatComposer,
  ChatHeader,
  LinkedConversationsBanner,
  MessageStream,
  ChatComposer,
} from './index.js';

// Re-export types để đảm bảo backward compatibility
export type { ChatWindowColumnProps };

/**
 * Cột Cửa Sổ Trò Chuyện (Column 2 - Unified Inbox)
 * Tách tầng kiến trúc:
 * - Tầng Logic & State: `useChatComposer` (Soạn thảo tin nhắn, âm thanh voice, 24h Meta, cuộn mượt)
 * - Tầng UI Molecules: Header, LinkedConversationsBanner, MessageStream, ChatComposer (tích hợp quick replies)
 */
export const ChatWindowColumn: React.FC<ChatWindowColumnProps> = ({
  conversation,
  staffList,
  quickReplies,
  alertThresholdMinutes = 15,
  onSendMessage,
  onAssignStaff,
  onBackToList,
  onToggleProfile,
  onOpenQuickReplySettings,
  onSelectConversation,
}) => {
  // Tầng 1: Nghiệp vụ soạn thảo, voice và tính toán 24h Meta
  const {
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
  } = useChatComposer({ conversation, onSendMessage });

  return (
    <section className="pancake-col-center flex-1 flex flex-col h-full bg-slate-50/40 border-r border-slate-200 min-w-[380px] overflow-hidden">
      {/* 1. Header cuộc trò chuyện */}
      <ChatHeader
        conversation={conversation}
        staffList={staffList}
        isWithin24Hours={isWithin24Hours}
        hoursRemaining={hoursRemaining}
        alertThresholdMinutes={alertThresholdMinutes}
        onAssignStaff={onAssignStaff}
        onBackToList={onBackToList}
        onToggleProfile={onToggleProfile}
      />

      {/* 2. Banner hội thoại liên kết đa kênh (CUS-04) */}
      <LinkedConversationsBanner
        customer={conversation.customer}
        onSelectConversation={onSelectConversation}
      />

      {/* 3. Luồng bong bóng tin nhắn (Message Stream & Date Dividers) */}
      <MessageStream
        conversation={conversation}
        messagesEndRef={messagesEndRef}
      />

      {/* 4. Khung soạn thảo tin nhắn hiện đại tích hợp toolbar & quick replies theo mẫu */}
      <ChatComposer
        conversation={conversation}
        inputText={inputText}
        isRecording={isRecording}
        isWithin24Hours={isWithin24Hours}
        quickReplies={quickReplies}
        onInputChange={setInputText}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onAttachSimulated={handleAttachSimulated}
        onAttachImageSimulated={handleAttachImageSimulated}
        onSimulateVoice={handleSimulateVoice}
        onInsertEmoji={handleInsertEmoji}
        onQuickReplySelect={handleQuickReplySelect}
        onOpenQuickReplySettings={onOpenQuickReplySettings}
      />
    </section>
  );
};
