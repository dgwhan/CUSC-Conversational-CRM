import React, { useState } from 'react';
import {
  Search,
  CheckCheck,
  Tag,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import type { ConversationItem, ChannelType } from '../types.js';
import { useTranslation } from '../../../i18n/index.js';
import { useUserRole } from '../../auth/UserRoleContext.js';
import { Avatar } from '../../../components/common/Avatar.js';

export interface ConversationListColumnProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSyncFacebook?: () => void;
  isSyncingFacebook?: boolean;
  onSyncZalo?: () => void;
  isSyncingZalo?: boolean;
  /** Backward compatibility */
  isSyncing?: boolean;
}

const formatConversationTime = (timeStr?: string): string => {
  if (!timeStr || timeStr === 'Vừa xong') return 'Vừa xong';

  let date: Date | null = null;
  if (timeStr.includes('T') || timeStr.includes('-') || timeStr.includes('/')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      date = d;
    }
  }

  if (!date) return timeStr;

  const now = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(now, date)) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

export const ConversationListColumn: React.FC<ConversationListColumnProps> = ({
  conversations,
  selectedId,
  onSelect,
  onSyncFacebook,
  isSyncingFacebook,
  onSyncZalo,
  isSyncingZalo,
  isSyncing,
}) => {
  const syncingFb = isSyncingFacebook ?? isSyncing;
  const syncingZl = isSyncingZalo ?? false;
  const { t } = useTranslation();
  const { isAgent, staffId } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | ChannelType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'ASSIGNED_TO_ME' | 'UNASSIGNED'>('ALL');

  // Lọc danh sách hội thoại
  const filteredConversations = conversations.filter((item) => {
    // PHƯƠNG ÁN A: Phân quyền theo vai trò (RBAC)
    // Nếu là Nhân viên tư vấn (AGENT): Chỉ thấy tin nhắn gán cho mình hoặc tin nhắn chưa ai nhận (Unassigned)
    if (isAgent) {
      const isAssignedToMe = item.assignedStaff?.id === staffId;
      const isUnassigned = !item.assignedStaff;
      if (!isAssignedToMe && !isUnassigned) {
        return false;
      }
    }

    // Lọc theo kênh
    if (selectedChannel !== 'ALL' && item.channel !== selectedChannel) {
      return false;
    }

    // Lọc theo trạng thái
    if (statusFilter === 'UNREAD' && item.unreadCount === 0) {
      return false;
    }
    if (statusFilter === 'ASSIGNED_TO_ME' && item.assignedStaff?.id !== staffId) {
      return false;
    }
    if (statusFilter === 'UNASSIGNED' && item.assignedStaff) {
      return false;
    }

    // Tìm kiếm văn bản
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customer.fullName.toLowerCase().includes(q);
      const matchPhone = item.customer.phone.toLowerCase().includes(q);
      const matchSnippet = item.snippet.toLowerCase().includes(q);
      const matchTag = item.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchSnippet && !matchTag) {
        return false;
      }
    }

    return true;
  });

  const totalUnread = filteredConversations.reduce((acc, curr) => acc + curr.unreadCount, 0);

  // Helper render channel icon tag
  const renderChannelBadge = (channel: ChannelType) => {
    switch (channel) {
      case 'FACEBOOK':
        return <span className="channel-corner-icon fb">FB</span>;
      case 'ZALO':
        return <span className="channel-corner-icon zalo">OA</span>;
      case 'ZALO_PERSONAL':
        return <span className="channel-corner-icon zalo" style={{ background: '#ea580c' }} title="Zalo Cá nhân">ZL</span>;
      case 'TIKTOK':
        return <span className="channel-corner-icon tiktok">TT</span>;
      case 'INSTAGRAM':
        return <span className="channel-corner-icon ig">IG</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="pancake-col-left">
      {/* Top Header */}
      <div className="col-left-header">
        <div className="inbox-title-row">
          <div className="title-with-badge">
            <h2 className="inbox-title">{t('inbox.conversationsTitle')}</h2>
            {totalUnread > 0 && (
              <span className="unread-total-badge">{totalUnread} {t('inbox.unreadCount')}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {onSyncFacebook && (
              <button
                type="button"
                className="crm-btn crm-btn-secondary crm-btn-sm"
                style={{
                  padding: '3px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#1877f2',
                  borderColor: '#bfdbfe',
                  background: '#eff6ff',
                  cursor: syncingFb ? 'not-allowed' : 'pointer',
                  borderRadius: '6px',
                }}
                disabled={syncingFb}
                onClick={onSyncFacebook}
                title="Kéo các tin nhắn từ Fanpage Facebook về hộp thư"
              >
                <RefreshCw size={11} className={syncingFb ? 'animate-spin' : ''} />
                <span>{syncingFb ? 'Đang kéo...' : 'Kéo tin FB'}</span>
              </button>
            )}
            {onSyncZalo && (
              <button
                type="button"
                className="crm-btn crm-btn-secondary crm-btn-sm"
                style={{
                  padding: '3px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#0068ff',
                  borderColor: '#bae6fd',
                  background: '#f0f9ff',
                  cursor: syncingZl ? 'not-allowed' : 'pointer',
                  borderRadius: '6px',
                }}
                disabled={syncingZl}
                onClick={onSyncZalo}
                title="Kéo các tin nhắn từ Zalo OA & Zalo Cá nhân về hộp thư"
              >
                <RefreshCw size={11} className={syncingZl ? 'animate-spin' : ''} />
                <span>{syncingZl ? 'Đang kéo...' : 'Kéo tin Zalo'}</span>
              </button>
            )}
            <span className="total-convs-label">{conversations.length} {t('inbox.contactsCount')}</span>
          </div>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="inbox-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="inbox-search-input"
            placeholder={t('inbox.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Bộ lọc kênh dạng Pills */}
        <div className="channel-filter-pills">
          <button
            type="button"
            className={`channel-pill ${selectedChannel === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('ALL')}
          >
            {t('common.all')}
          </button>
          <button
            type="button"
            className={`channel-pill fb ${selectedChannel === 'FACEBOOK' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('FACEBOOK')}
          >
            Facebook
          </button>
          <button
            type="button"
            className={`channel-pill zalo ${selectedChannel === 'ZALO' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('ZALO')}
          >
            Zalo OA
          </button>
          <button
            type="button"
            className={`channel-pill tiktok ${selectedChannel === 'TIKTOK' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('TIKTOK')}
          >
            TikTok
          </button>
          <button
            type="button"
            className={`channel-pill ig ${selectedChannel === 'INSTAGRAM' ? 'active' : ''}`}
            onClick={() => setSelectedChannel('INSTAGRAM')}
          >
            Instagram
          </button>
        </div>

        {/* Bộ lọc trạng thái phụ */}
        <div className="sub-filter-row">
          <select
            className="inbox-sub-filter-select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'ALL' | 'UNREAD' | 'ASSIGNED_TO_ME' | 'UNASSIGNED'
              )
            }
          >
            <option value="ALL">{t('inbox.filterAll')}</option>
            <option value="UNREAD">{t('inbox.filterUnread')}</option>
            <option value="ASSIGNED_TO_ME">{t('inbox.filterAssignedToMe')}</option>
            <option value="UNASSIGNED">{t('inbox.filterUnassigned')}</option>
          </select>
        </div>
      </div>

      {/* Danh sách các cuộc hội thoại */}
      <div className="conversation-items-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-inbox-state">
            <p>{t('inbox.emptyList')}</p>
          </div>
        ) : (
          filteredConversations.map((item) => {
            const isSelected = item.id === selectedId;

            return (
              <div
                key={item.id}
                className={`conversation-card ${isSelected ? 'selected' : ''} ${item.unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {/* Avatar with Channel Icon */}
                <div className="conv-avatar-wrapper">
                  <Avatar
                    src={item.customer.avatarUrl}
                    name={item.customer.fullName}
                    size={44}
                    className="conv-avatar-img"
                    badge={renderChannelBadge(item.channel)}
                  />
                </div>

                {/* Content Meta */}
                <div className="conv-card-body">
                  <div className="conv-card-header">
                    <span className="conv-customer-name">{item.customer.fullName}</span>
                    <span className="conv-time">{formatConversationTime(item.lastMessageAt)}</span>
                  </div>

                  <p className="conv-snippet-text">{item.snippet}</p>

                  <div className="conv-card-footer">
                    {/* Tags */}
                    <div className="conv-tags-row">
                      {item.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="conv-tag-chip">
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="conv-tag-more">+{item.tags.length - 2}</span>
                      )}
                    </div>

                    {/* Unread or Staff indicator */}
                    <div className="conv-footer-right">
                      {item.unreadCount > 0 ? (
                        <span className="conv-unread-pill">{item.unreadCount}</span>
                      ) : (
                        <CheckCheck size={14} className="seen-check-icon" />
                      )}

                      {item.assignedStaff ? (
                        <span
                          className="conv-staff-badge"
                          title={`Phụ trách: ${item.assignedStaff.name}`}
                        >
                          <UserCheck size={12} />
                          {item.assignedStaff.avatar}
                        </span>
                      ) : (
                        <span
                          className="conv-staff-badge unassigned"
                          style={{
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            fontSize: '10px',
                            padding: '1px 5px',
                            fontWeight: 600,
                          }}
                          title="Hội thoại chưa gán - Bạn có thể bấm Nhận việc"
                        >
                          Chờ nhận việc
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
