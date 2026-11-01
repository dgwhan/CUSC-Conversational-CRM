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
  ArrowLeft,
  User,
} from 'lucide-react';
import type { ConversationItem, AssignedStaff, QuickReplyItem, MessageAttachment } from '../types.js';
import { QuickReplyBar } from './QuickReplyBar.js';
import { Avatar } from '../../../components/common/Avatar.js';
import { resolveChannelInfo } from '../../../lib/channel-meta.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useTranslation } from '../../../i18n/index.js';
import { useUserRole } from '../../auth/UserRoleContext.js';

export interface ChatWindowColumnProps {
  conversation: ConversationItem;
  staffList: AssignedStaff[];
  quickReplies: QuickReplyItem[];
  onSendMessage: (text: string, attachments?: MessageAttachment[]) => void;
  onAssignStaff: (staffId: string) => void;
  onToggleStatus?: () => void;
  onBackToList?: () => void;
  onToggleProfile?: () => void;
  onOpenQuickReplySettings?: () => void;
  onSelectConversation?: (conversationId: string) => void;
}

const formatMessageTime = (timeStr?: string): string => {
  if (!timeStr || timeStr === 'Vừa xong') return 'Vừa xong';
  if (timeStr.includes('T') || (!timeStr.includes(':') && !isNaN(Date.parse(timeStr)))) {
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
  }
  return timeStr;
};

const getDateDividerLabel = (timeStr?: string): string => {
  if (!timeStr || timeStr === 'Vừa xong') return 'Hôm nay';

  let date: Date | null = null;
  if (timeStr.includes('T') || timeStr.includes('-') || timeStr.includes('/')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      date = d;
    }
  }

  if (!date) return 'Hôm nay';

  const now = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(now, date)) {
    return 'Hôm nay';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(yesterday, date)) {
    return 'Hôm qua';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (date.getFullYear() === now.getFullYear()) {
    return `${day}/${month}`;
  }
  return `${day}/${month}/${date.getFullYear()}`;
};

export const ChatWindowColumn: React.FC<ChatWindowColumnProps> = ({
  conversation,
  staffList,
  quickReplies,
  onSendMessage,
  onAssignStaff,
  onBackToList,
  onToggleProfile,
  onOpenQuickReplySettings,
  onSelectConversation,
}) => {
  const { t } = useTranslation();
  const { isOwner, staffId } = useUserRole();
  const channelMeta = resolveChannelInfo(conversation.channel);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentTimestamp] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasMultipleChannels = (conversation.customer.channelIdentities || []).length > 1;
  const filteredMessages = conversation.messages;

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
            <Avatar
              src={conversation.customer.avatarUrl}
              name={conversation.customer.fullName}
              size={40}
              className="chat-header-avatar"
            />
          </div>

          <div className="chat-user-details">
            <div className="chat-user-name-row">
              <h3 className="chat-user-name" title={conversation.customer.fullName}>
                {conversation.customer.fullName}
              </h3>
            </div>
            <div className="chat-user-sub">
              {channelMeta.iconUrl && (
                <img src={channelMeta.iconUrl} alt={channelMeta.label} className="chat-channel-icon-mini" />
              )}
              <span className="chat-channel-label">{channelMeta.label}</span>
              {conversation.channelAccountName &&
                !conversation.channelAccountName.startsWith('Kênh ') &&
                conversation.channelAccountName.toLowerCase() !== channelMeta.label.toLowerCase() && (
                  <>
                    <span className="chat-sub-dot">•</span>
                    <span className="chat-account-name">{conversation.channelAccountName}</span>
                  </>
                )}
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
                  <span>Hết hạn 24h</span>
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

          {/* Bỏ nút hoàn tất theo yêu cầu người dùng */}

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

      {/* CUS-04: Banner liên kết hội thoại khác kênh của cùng khách hàng */}
      {conversation.customer.linkedConversations && conversation.customer.linkedConversations.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, color: '#0369a1' }}>Kênh liên kết:</span>
            <span style={{ color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              Khách hàng này có {conversation.customer.linkedConversations.length} cuộc hội thoại khác trên{' '}
              {conversation.customer.linkedConversations.map((lc) => lc.channelAccountName || lc.channel).join(', ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
            {conversation.customer.linkedConversations.map((lc) => {
              const meta = resolveChannelInfo(lc.channel);
              return (
                <button
                  key={lc.id}
                  type="button"
                  onClick={() => onSelectConversation && onSelectConversation(lc.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: '#ffffff',
                    color: '#0284c7',
                    fontWeight: 600,
                    fontSize: '11px',
                    border: '1px solid #7dd3fc',
                    cursor: 'pointer'
                  }}
                  title={`Chuyển sang xem cuộc hội thoại trên ${meta.label}`}
                >
                  {meta.iconUrl && (
                    <img src={meta.iconUrl} alt={meta.label} style={{ width: '14px', height: '14px', borderRadius: '50%' }} />
                  )}
                  <span>Xem chat {meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Luồng Tin Nhắn (Message Stream) */}
      <div className="chat-messages-stream">
        {filteredMessages.map((msg, index) => {
          const isOutbound = msg.direction === 'OUTBOUND';
          const currentDateLabel = getDateDividerLabel(msg.sentAt);
          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
          const prevDateLabel = prevMsg ? getDateDividerLabel(prevMsg.sentAt) : null;
          const showDateDivider = index === 0 || currentDateLabel !== prevDateLabel;

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="chat-date-divider">
                  <span>{currentDateLabel}</span>
                </div>
              )}
            <div
              key={msg.id}
              className={`chat-bubble-row ${isOutbound ? 'outbound' : 'inbound'}`}
            >
              {!isOutbound && (
                <Avatar
                  src={conversation.customer.avatarUrl}
                  name={msg.senderName}
                  size={30}
                  className="msg-bubble-avatar"
                />
              )}

              <div className="msg-bubble-content-box">
                {/* Bỏ lặp tên người gửi trên từng bong bóng tin nhắn trong chat 1-1 */}

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
                                        {hasMultipleChannels && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 4px',
                          borderRadius: '4px',
                          background: ((msg.senderName || '').toLowerCase().includes('zalo') || (msg.conversationId || '').startsWith('ZALO')) ? '#e0f2fe' : '#dbeafe',
                          color: ((msg.senderName || '').toLowerCase().includes('zalo') || (msg.conversationId || '').startsWith('ZALO')) ? '#0369a1' : '#1d4ed8',
                          marginRight: '4px',
                        }}
                      >
                        {((msg.senderName || '').toLowerCase().includes('zalo') || (msg.conversationId || '').startsWith('ZALO')) ? 'Zalo' : 'Facebook'}
                      </span>
                    )}
                    <span className="bubble-time">{formatMessageTime(msg.sentAt)}</span>
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
          </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Thanh Mẫu Phản Hồi Nhanh (Quick Replies) */}
      <QuickReplyBar
        replies={quickReplies}
        onSelect={handleQuickReplySelect}
        onOpenSettings={onOpenQuickReplySettings}
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
                  name: 'chung_chi_polarisx.jpg',
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
