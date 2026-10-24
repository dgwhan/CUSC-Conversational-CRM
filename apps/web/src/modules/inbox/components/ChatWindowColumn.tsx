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
}

export const ChatWindowColumn: React.FC<ChatWindowColumnProps> = ({
  conversation,
  staffList,
  quickReplies,
  onSendMessage,
  onAssignStaff,
  onToggleStatus,
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

  // Kiểm tra cửa sổ 24 giờ của Meta
  const lastCustomerTime = new Date(conversation.lastCustomerMessageAt).getTime();
  const hoursSinceCustomer = (currentTimestamp - lastCustomerTime) / (1000 * 60 * 60);
  const isWithin24Hours = hoursSinceCustomer <= 24;
  const hoursRemaining = Math.max(0, Math.floor(24 - hoursSinceCustomer));

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (!isWithin24Hours && conversation.channel === 'FACEBOOK') {
      notify.warning(
        'Đã quá 24h từ tin nhắn cuối của khách hàng. Tin nhắn sẽ được gửi kèm Message Tag: CONFIRMED_EVENT_UPDATE theo chính sách Meta.',
        'Chính sách Cửa sổ 24h Meta'
      );
    }

    onSendMessage(trimmed);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectQuickReply = (content: string) => {
    setInputText((prev) => (prev ? `${prev} ${content}` : content));
  };

  // Giả lập gửi file ảnh mẫu
  const handleSimulateAttachImage = () => {
    onSendMessage('Em gửi thêm hình ảnh bằng tốt nghiệp để trường đối chiếu hồ sơ ạ:', [
      {
        id: `att-${Date.now()}`,
        type: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&auto=format&fit=crop&q=80',
        name: 'bang_tot_nghiep_thpt.jpg',
        size: '1.8 MB',
      },
    ]);
    notify.info('Đã đính kèm ảnh mẫu vào cuộc hội thoại.');
  };

  // Giả lập gửi file tài liệu
  const handleSimulateAttachFile = () => {
    onSendMessage('Gửi bạn đề án tuyển sinh và chương trình học chi tiết:', [
      {
        id: `att-${Date.now()}`,
        type: 'FILE',
        url: '#',
        name: 'De_An_Tuyen_Sinh_CUSC_2026.pdf',
        size: '3.5 MB',
      },
    ]);
  };

  // Giả lập ghi âm
  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      onSendMessage('Đã gửi tin nhắn thoại (0:18)', [
        {
          id: `att-${Date.now()}`,
          type: 'AUDIO',
          url: '#',
          duration: '0:18',
          name: 'Tin nhắn thoại tư vấn.mp3',
        },
      ]);
      notify.success('Đã gửi tin nhắn thoại thành công.');
    } else {
      setIsRecording(true);
      notify.info('Đang mô phỏng ghi âm... Nhấn lại vào micro để gửi.');
    }
  };

  return (
    <section className="pancake-col-center">
      {/* 1. Header Cửa Sổ Chat */}
      <div className="chat-window-header">
        <div className="chat-header-user">
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
                      {msg.attachments.map((att) => {
                        if (att.type === 'IMAGE') {
                          return (
                            <div key={att.id} className="attachment-image-card">
                              <img
                                src={att.url}
                                alt={att.name || 'Hình ảnh đính kèm'}
                                className="attachment-img-preview"
                              />
                              {att.name && <span className="att-file-name">{att.name}</span>}
                            </div>
                          );
                        }

                        if (att.type === 'AUDIO') {
                          return (
                            <div key={att.id} className="attachment-audio-player">
                              <div className="audio-play-circle">
                                <Volume2 size={16} />
                              </div>
                              <div className="audio-waveform-bar">
                                <div className="waveform-line active" />
                                <div className="waveform-line active" />
                                <div className="waveform-line" />
                                <div className="waveform-line" />
                              </div>
                              <span className="audio-duration">{att.duration || '0:18'}</span>
                            </div>
                          );
                        }

                        if (att.type === 'FILE') {
                          return (
                            <div key={att.id} className="attachment-file-card">
                              <FileText size={20} className="file-type-icon" />
                              <div className="file-info-text">
                                <span className="file-title">{att.name}</span>
                                <span className="file-size">{att.size}</span>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}

                  <div className="bubble-time-row">
                    <span className="bubble-time">{msg.sentAt}</span>
                    {isOutbound && (
                      <span className="bubble-status">
                        {msg.status === 'SEEN' ? (
                          <CheckCheck size={14} className="seen-blue" />
                        ) : (
                          <Check size={14} />
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

      {/* 3. Thanh Tin Nhắn Mẫu Trả Lời Nhanh (Quick Replies) */}
      <QuickReplyBar
        replies={quickReplies}
        onSelect={handleSelectQuickReply}
      />

      {/* 4. Khung Soạn Thảo & Gửi Tin Nhắn */}
      <div className="chat-input-area">
        <div className="chat-input-toolbar">
          <button
            type="button"
            className="input-tool-btn"
            onClick={handleSimulateAttachImage}
            title={t('inbox.input.tooltipPhoto')}
          >
            <ImageIcon size={18} />
          </button>
          <button
            type="button"
            className="input-tool-btn"
            onClick={handleSimulateAttachFile}
            title={t('inbox.input.tooltipFile')}
          >
            <Paperclip size={18} />
          </button>
          <button
            type="button"
            className={`input-tool-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleToggleRecord}
            title={t('inbox.input.tooltipMic')}
          >
            <Mic size={18} />
          </button>
          <button
            type="button"
            className="input-tool-btn"
            onClick={() => handleSelectQuickReply('Dạ vâng ạ! ')}
            title={t('inbox.input.tooltipEmoji')}
          >
            <Smile size={18} />
          </button>

          <span className="input-shortcut-hint">
            {t('inbox.input.shortcutHint')}
          </span>
        </div>

        <div className="chat-textarea-row">
          <textarea
            className="chat-textarea"
            rows={2}
            placeholder={`${t('inbox.input.placeholder')} ${conversation.customer.fullName}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="crm-btn crm-btn-primary crm-btn-gradient-primary send-msg-btn"
            onClick={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={16} />
            <span>{t('inbox.input.sendBtn')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
