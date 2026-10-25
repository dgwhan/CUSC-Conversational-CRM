import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Clock,
  UserCheck,
  Check,
  CheckCheck,
  FileText,
  Volume2,
  AlertTriangle,
  Smile,
  Radio,
  ArrowLeft,
  User,
} from 'lucide-react';
import type { ConversationItem, AssignedStaff, QuickReplyItem, MessageAttachment } from '../types.js';
import { QuickReplyBar } from './QuickReplyBar.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useTranslation } from '../../../i18n/index.js';
import { useUserRole } from '../../auth/UserRoleContext.js';

export interface ChatWindowColumnProps {
  conversation: ConversationItem;
  staffList: AssignedStaff[];
  quickReplies: QuickReplyItem[];
  onSendMessage: (text: string, attachments?: MessageAttachment[]) => void;
  onAssignStaff: (staffId: string) => void;
  onToggleStatus: () => void;
  onBackToList?: () => void;
  onToggleProfile?: () => void;
}

export const ChatWindowColumn: React.FC<ChatWindowColumnProps> = ({
  conversation,
  staffList,
  quickReplies,
  onSendMessage,
  onAssignStaff,
  onToggleStatus,
  onBackToList,
  onToggleProfile,
}) => {
  const { t } = useTranslation();
  const { isOwner, staffId } = useUserRole();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentTimestamp] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống tin nhắn cuối cùng khi có tin mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Kiểm tra thời hạn 24 giờ của Meta (Facebook Messenger)
  const lastCustomerMessageTime = conversation.lastCustomerMessageAt
    ? new Date(conversation.lastCustomerMessageAt).getTime()
    : new Date(conversation.lastMessageAt).getTime();

  const hoursDiff = (currentTimestamp - lastCustomerMessageTime) / (1000 * 60 * 60);
  const isWithin24Hours = hoursDiff <= 24;
  const hoursRemaining = Math.max(0, Math.floor(24 - hoursDiff));

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReplySelect = (content: string) => {
    setInputText((prev) => (prev ? `${prev} ${content}` : content));
  };

  const handleSimulateVoice = () => {
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
  };

  return (
    <section className="pancake-col-center">
      {/* 1. Header Cửa Sổ Chat */}
      <div className="chat-window-header">
        <div className="chat-header-user">
          {onBackToList && (
            <button
              type="button"
              className="chat-mobile-back-btn"
              onClick={onBackToList}
              title="Quay lại danh sách hội thoại"
            >
              <ArrowLeft size={16} />
              <span>Danh sách</span>
            </button>
          )}

          <div className="chat-avatar-box">
            <img
              src={conversation.customer.avatarUrl}
              alt={conversation.customer.fullName}
              className="chat-header-avatar"
            />
            <span className={`chat-online-dot ${conversation.status === 'OPEN' ? 'online' : ''}`} />
          </div>

          <div className="chat-user-details">
            <div className="chat-user-name-row">
              <h3 className="chat-user-name">{conversation.customer.fullName}</h3>
              <span className={`channel-indicator-badge ${conversation.channel.toLowerCase()}`}>
                {conversation.channel}
              </span>
            </div>
            <div className="chat-user-sub">
              <span>{t('inbox.chatHeader.messagingVia')} <strong>{conversation.channelAccountName}</strong></span>
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* Badge 24h Meta */}
          {conversation.channel === 'FACEBOOK' && (
            <div
              className={`meta-24h-pill ${isWithin24Hours ? 'valid' : 'expired'}`}
              title={
                isWithin24Hours
                  ? `Còn ${hoursRemaining} giờ để phản hồi miễn phí theo chính sách Meta`
                  : 'Đã quá 24 giờ kể từ tin nhắn cuối của khách. Cần dùng Message Tag.'
              }
            >
              {isWithin24Hours ? (
                <>
                  <Clock size={13} />
                  <span>{t('inbox.chatHeader.meta24hValid')} ~{hoursRemaining}h</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} />
                  <span>{t('inbox.chatHeader.meta24hExpired')}</span>
                </>
              )}
            </div>
          )}

          {/* Phân công nhân viên: Owner được chọn bất kỳ ai, Agent chỉ được bấm "Nhận tư vấn" */}
          {isOwner ? (
            <div className="assign-staff-dropdown-wrapper">
              <UserCheck size={14} className="assign-icon" />
              <select
                className="assign-staff-select"
                value={conversation.assignedStaff?.id || ''}
                onChange={(e) => onAssignStaff(e.target.value)}
                title="Chủ doanh nghiệp: Phân công cho bất kỳ tư vấn viên nào"
              >
                <option value="">{t('inbox.chatHeader.unassigned')}</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="agent-claim-box">
              {conversation.assignedStaff?.id === staffId ? (
                <span
                  className="assigned-pill-mine"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: '#ecfdf5',
                    color: '#059669',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <UserCheck size={13} />
                  <span>Bạn đang phụ trách</span>
                </span>
              ) : !conversation.assignedStaff ? (
                <button
                  type="button"
                  className="crm-btn crm-btn-sm crm-btn-primary"
                  onClick={() => onAssignStaff(staffId)}
                  title="Nhận cuộc hội thoại này để bắt đầu tư vấn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <UserCheck size={13} />
                  <span>Nhận việc (Claim)</span>
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    padding: '4px 6px',
                  }}
                >
                  Phụ trách: {conversation.assignedStaff.name}
                </span>
              )}
            </div>
          )}

          {/* Nút Đổi trạng thái Giải quyết */}
          <button
            type="button"
            className="crm-btn crm-btn-sm crm-btn-secondary"
            onClick={onToggleStatus}
            title={conversation.status === 'RESOLVED' ? t('inbox.chatHeader.reopenBtn') : t('inbox.chatHeader.resolveBtn')}
          >
            {conversation.status === 'RESOLVED' ? (
              <>
                <Radio size={14} style={{ color: 'var(--color-primary)' }} />
                <span>{t('inbox.chatHeader.reopenBtn')}</span>
              </>
            ) : (
              <>
                <Check size={14} style={{ color: 'var(--color-success)' }} />
                <span>{t('inbox.chatHeader.resolveBtn')}</span>
              </>
            )}
          </button>

          {/* Nút Xem Hồ Sơ trên Mobile */}
          {onToggleProfile && (
            <button
              type="button"
              className="chat-mobile-info-btn"
              onClick={onToggleProfile}
              title="Xem thông tin chi tiết hồ sơ khách hàng"
            >
              <User size={14} />
              <span>Hồ sơ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Luồng Tin Nhắn (Message Stream) */}
      <div className="chat-messages-stream">
        <div className="chat-date-divider">
          <span>{t('common.today')}</span>
        </div>

        {conversation.messages.map((msg) => {
          const isOutbound = msg.direction === 'OUTBOUND';

          return (
            <div
              key={msg.id}
              className={`chat-bubble-row ${isOutbound ? 'outbound' : 'inbound'}`}
            >
              {!isOutbound && (
                <img
                  src={conversation.customer.avatarUrl}
                  alt={msg.senderName}
                  className="msg-bubble-avatar"
                />
              )}

              <div className="msg-bubble-content-box">
                {!isOutbound && (
                  <span className="msg-sender-label">{msg.senderName}</span>
                )}

                <div className={`chat-bubble ${isOutbound ? 'bubble-outbound' : 'bubble-inbound'}`}>
                  {/* Nội dung văn bản */}
                  {msg.content && <p className="bubble-text">{msg.content}</p>}

                  {/* Tệp đính kèm */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="bubble-attachments-container">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className="attachment-item">
                          {att.type === 'IMAGE' && (
                            <img src={att.url} alt={att.name || 'Ảnh đính kèm'} className="att-preview-img" />
                          )}

                          {att.type === 'AUDIO' && (
                            <div className="att-audio-pill">
                              <Volume2 size={16} />
                              <div className="att-audio-info">
                                <span className="att-audio-name">{att.name}</span>
                                <span className="att-audio-duration">{att.duration}</span>
                              </div>
                            </div>
                          )}

                          {att.type === 'FILE' && (
                            <div className="att-file-pill">
                              <FileText size={16} />
                              <div className="att-file-info">
                                <span className="att-file-name">{att.name}</span>
                                <span className="att-file-size">{att.size}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Thời gian và Trạng thái đã gửi / đã xem */}
                  <div className="bubble-meta-row">
                    <span className="bubble-time">{msg.sentAt}</span>
                    {isOutbound && (
                      <span className="bubble-status-icon">
                        {msg.status === 'SEEN' ? (
                          <CheckCheck size={14} className="status-seen" />
                        ) : msg.status === 'DELIVERED' ? (
                          <CheckCheck size={14} className="status-delivered" />
                        ) : (
                          <Check size={14} className="status-sent" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Thanh Mẫu Phản Hồi Nhanh (Quick Replies) */}
      <QuickReplyBar
        replies={quickReplies}
        onSelect={handleQuickReplySelect}
      />

      {/* 4. Khung Soạn Thảo & Gửi Tin Nhắn (Composer) */}
      <div className="chat-composer-area">
        {/* Thanh công cụ đính kèm */}
        <div className="composer-toolbar">
          <button
            type="button"
            className="composer-tool-btn"
            title={t('inbox.chatInput.attachFile')}
            onClick={() => notify.info(t('inbox.chatInput.attachSimulated'))}
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className="composer-tool-btn"
            title={t('inbox.chatInput.attachImage')}
            onClick={() => {
              onSendMessage('Đã gửi tài liệu / hình ảnh minh họa', [
                {
                  id: `att-img-${Date.now()}`,
                  type: 'IMAGE',
                  url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60',
                  name: 'chung_chi_cusc.jpg',
                },
              ]);
            }}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className={`composer-tool-btn ${isRecording ? 'recording' : ''}`}
            title={t('inbox.chatInput.voiceMessage')}
            onClick={handleSimulateVoice}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            className="composer-tool-btn"
            title={t('inbox.chatInput.insertEmoji')}
            onClick={() => setInputText((prev) => `${prev} 😊 `)}
          >
            <Smile size={16} />
          </button>
        </div>

        {/* Ô nhập tin nhắn */}
        <div className="composer-input-row">
          <textarea
            className="composer-textarea"
            placeholder={
              !isWithin24Hours && conversation.channel === 'FACEBOOK'
                ? 'Đã quá 24h Meta. Cần gắn Message Tag để phản hồi...'
                : `Nhập tin nhắn phản hồi cho ${conversation.customer.fullName}... (Enter để gửi)`
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />

          <button
            type="button"
            className="crm-btn crm-btn-primary crm-btn-gradient-primary send-msg-btn"
            onClick={handleSend}
            disabled={!inputText.trim()}
            title="Gửi tin nhắn (Enter)"
          >
            <Send size={15} />
            <span>Gửi</span>
          </button>
        </div>
      </div>
    </section>
  );
};
