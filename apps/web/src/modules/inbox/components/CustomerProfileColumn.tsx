import React, { useState } from 'react';
import {
  Phone,
  Mail,
  User,
  Tag,
  Plus,
  BookOpen,
  StickyNote,
  Trash2,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';
import type { CustomerProfile, LeadStatus } from '../types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

export interface CustomerProfileColumnProps {
  customer: CustomerProfile;
  onUpdateLeadStatus: (status: LeadStatus) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
}

export const CustomerProfileColumn: React.FC<CustomerProfileColumnProps> = ({
  customer,
  onUpdateLeadStatus,
  onAddTag,
  onRemoveTag,
  onAddNote,
  onRemoveNote,
}) => {
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const leadStatusConfig: { key: LeadStatus; label: string; color: string; bg: string }[] = [
    { key: 'NEW', label: 'Mới', color: '#0284c7', bg: '#f0f9ff' },
    { key: 'POTENTIAL', label: 'Tiềm năng', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'CONVERTED', label: 'Đã chốt', color: '#10b981', bg: '#ecfdf5' },
    { key: 'UNQUALIFIED', label: 'Không nhu cầu', color: '#64748b', bg: '#f8fafc' },
  ];

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    notify.success(`Đã sao chép ${fieldName} vào bộ nhớ tạm.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (!tag) return;
    onAddTag(tag);
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const note = newNoteInput.trim();
    if (!note) return;
    onAddNote(note);
    setNewNoteInput('');
  };

  return (
    <aside className="pancake-col-right">
      {/* 1. Header Hồ Sơ Khách Hàng */}
      <div className="profile-header-card">
        <div className="profile-avatar-large-wrapper">
          <img
            src={customer.avatarUrl}
            alt={customer.fullName}
            className="profile-avatar-large"
          />
          <span className={`channel-profile-tag ${customer.channel.toLowerCase()}`}>
            {customer.channel}
          </span>
        </div>

        <h3 className="profile-fullname">{customer.fullName}</h3>
        <span className="profile-social-id">{customer.socialId}</span>

        {/* Nút hành động nhanh */}
        <div className="profile-contact-actions">
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
              className="contact-action-btn phone"
              title="Gọi điện tư vấn"
            >
              <Phone size={14} />
              <span>Gọi ngay</span>
            </a>
          )}
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="contact-action-btn email"
              title="Gửi email"
            >
              <Mail size={14} />
              <span>Gửi Mail</span>
            </a>
          )}
        </div>
      </div>

      <div className="profile-scroll-body">
        {/* 2. Phễu Khách Hàng (Lead Funnel) */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <TrendingUp size={15} className="section-title-icon" />
            <h4 className="section-title">Phễu Khách Hàng (Lead Status)</h4>
          </div>

          <div className="lead-funnel-selector">
            {leadStatusConfig.map((item) => {
              const isCurrent = customer.leadStatus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`funnel-stage-btn ${isCurrent ? 'active' : ''}`}
                  style={{
                    backgroundColor: isCurrent ? item.bg : undefined,
                    color: isCurrent ? item.color : undefined,
                    borderColor: isCurrent ? item.color : undefined,
                  }}
                  onClick={() => onUpdateLeadStatus(item.key)}
                >
                  <span className="funnel-dot" style={{ backgroundColor: item.color }} />
                  <span className="funnel-text">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Chi Tiết Thông Tin Liên Hệ */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <User size={15} className="section-title-icon" />
            <h4 className="section-title">Thông Tin Liên Hệ</h4>
          </div>

          <div className="contact-info-list">
            <div className="contact-info-item">
              <span className="contact-label">Số điện thoại:</span>
              <div className="contact-value-group">
                <span className="contact-value">{customer.phone || 'Chưa cung cấp'}</span>
                {customer.phone && (
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(customer.phone, 'Số điện thoại')}
                    title="Sao chép SĐT"
                  >
                    {copiedField === 'Số điện thoại' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>

            <div className="contact-info-item">
              <span className="contact-label">Email:</span>
              <div className="contact-value-group">
                <span className="contact-value">{customer.email || 'Chưa cung cấp'}</span>
                {customer.email && (
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(customer.email, 'Email')}
                    title="Sao chép Email"
                  >
                    {copiedField === 'Email' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>

            <div className="contact-info-item">
              <span className="contact-label">Kênh kết nối:</span>
              <span className="contact-value">{customer.channelAccountName}</span>
            </div>
          </div>
        </div>

        {/* 4. Nhãn Phân Loại (Tags) */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <Tag size={15} className="section-title-icon" />
            <h4 className="section-title">Nhãn Phân Loại ({customer.tags.length})</h4>
          </div>

          <div className="profile-tags-container">
            {customer.tags.map((tag, idx) => (
              <span key={idx} className="profile-tag-pill">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() => onRemoveTag(tag)}
                  title="Xóa nhãn này"
                >
                  &times;
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <form onSubmit={handleAddTagSubmit} className="add-tag-form">
                <input
                  type="text"
                  className="add-tag-input"
                  placeholder="Nhập tên tag mới..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="add-tag-submit-btn">
                  Lưu
                </button>
                <button
                  type="button"
                  className="add-tag-cancel-btn"
                  onClick={() => setIsAddingTag(false)}
                >
                  Hủy
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="add-tag-trigger-btn"
                onClick={() => setIsAddingTag(true)}
              >
                <Plus size={12} />
                <span>Thêm nhãn</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. Khóa Học / Đơn Hàng Quan Tâm */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <BookOpen size={15} className="section-title-icon" />
            <h4 className="section-title">Khóa Học & Ngành Nghề Quan Tâm</h4>
          </div>

          {customer.interestCourses.length === 0 ? (
            <p className="empty-sub-text">Chưa ghi nhận khóa học quan tâm.</p>
          ) : (
            <div className="courses-list">
              {customer.interestCourses.map((course, idx) => (
                <div key={idx} className="course-item-card">
                  <div className="course-dot" />
                  <span className="course-name">{course}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Ghi Chú Nội Bộ (Internal Notes) */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <StickyNote size={15} className="section-title-icon" />
            <h4 className="section-title">Ghi Chú Nội Bộ ({customer.notes.length})</h4>
          </div>

          {/* Form thêm ghi chú */}
          <form onSubmit={handleAddNoteSubmit} className="add-note-form">
            <textarea
              className="note-textarea"
              rows={2}
              placeholder="Ghi chú riêng cho nhân viên tư vấn (khách không nhìn thấy)..."
              value={newNoteInput}
              onChange={(e) => setNewNoteInput(e.target.value)}
            />
            <button
              type="submit"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              style={{ width: '100%', marginTop: '6px' }}
              disabled={!newNoteInput.trim()}
            >
              <Plus size={14} />
              <span>Lưu ghi chú nội bộ</span>
            </button>
          </form>

          {/* Danh sách ghi chú */}
          <div className="notes-list">
            {customer.notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <span className="note-author">{note.author}</span>
                  <div className="note-actions">
                    <span className="note-time">{note.createdAt}</span>
                    <button
                      type="button"
                      className="note-delete-btn"
                      onClick={() => onRemoveNote(note.id)}
                      title="Xóa ghi chú"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="note-content">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
