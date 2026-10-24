import React, { useState } from 'react';
import {
  Search,
  CheckCheck,
  Tag,
  UserCheck,
} from 'lucide-react';
import type { ConversationItem, ChannelType } from '../types.js';

export interface ConversationListColumnProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ConversationListColumn: React.FC<ConversationListColumnProps> = ({
  conversations,
  selectedId,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | ChannelType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'ASSIGNED_TO_ME' | 'UNASSIGNED'>('ALL');

  // Lọc danh sách hội thoại
  const filteredConversations = conversations.filter((item) => {
    // Lọc theo kênh
    if (selectedChannel !== 'ALL' && item.channel !== selectedChannel) {
      return false;
    }

    // Lọc theo trạng thái
    if (statusFilter === 'UNREAD' && item.unreadCount === 0) {
      return false;
    }
    if (statusFilter === 'ASSIGNED_TO_ME' && item.assignedStaff?.id !== 'staff-1') {
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

  const totalUnread = conversations.reduce((acc, curr) => acc + curr.unreadCount, 0);

  // Helper render channel icon tag
  const renderChannelBadge = (channel: ChannelType) => {
    switch (channel) {
      case 'FACEBOOK':
        return <span className="channel-corner-icon fb">FB</span>;
      case 'ZALO':
        return <span className="channel-corner-icon zalo">OA</span>;
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
            <h2 className="inbox-title">Hội thoại</h2>
            {totalUnread > 0 && (
              <span className="unread-total-badge">{totalUnread} chưa đọc</span>
            )}
          </div>
          <span className="total-convs-label">{conversations.length} khách</span>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="inbox-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="inbox-search-input"
            placeholder="Tìm theo tên, SĐT, tag, nội dung..."
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
            Tất cả
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
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNREAD">Chỉ tin chưa đọc</option>
            <option value="ASSIGNED_TO_ME">Gán cho tôi</option>
            <option value="UNASSIGNED">Chưa có người gán</option>
          </select>
        </div>
      </div>

      {/* Danh sách các cuộc hội thoại */}
      <div className="conversation-items-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-inbox-state">
            <p>Không tìm thấy cuộc hội thoại nào phù hợp với bộ lọc.</p>
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
                  <img
                    src={item.customer.avatarUrl}
                    alt={item.customer.fullName}
                    className="conv-avatar-img"
                  />
                  {renderChannelBadge(item.channel)}
                </div>

                {/* Content Meta */}
                <div className="conv-card-body">
                  <div className="conv-card-header">
                    <span className="conv-customer-name">{item.customer.fullName}</span>
                    <span className="conv-time">{item.lastMessageAt}</span>
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

                      {item.assignedStaff && (
                        <span
                          className="conv-staff-badge"
                          title={`Phụ trách: ${item.assignedStaff.name}`}
                        >
                          <UserCheck size={12} />
                          {item.assignedStaff.avatar}
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
