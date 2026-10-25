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
  LayoutGrid,
  Smartphone,
  X,
} from 'lucide-react';
import type { CustomerProfile, LeadStatus, LeadStage } from '../types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useTranslation } from '../../../i18n/index.js';
import { LogPersonalZaloModal } from './LogPersonalZaloModal.js';
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';

export interface CustomerProfileColumnProps {
  customer: CustomerProfile;
  onUpdateLeadStatus: (status: LeadStatus) => void;
  onUpdateLeadStage?: (stage: LeadStage) => void;
  onNavigateToKanban?: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const CustomerProfileColumn: React.FC<CustomerProfileColumnProps> = ({
  customer,
  onUpdateLeadStatus,
  onUpdateLeadStage,
  onNavigateToKanban,
  onAddTag,
  onRemoveTag,
  onAddNote,
  onRemoveNote,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useTranslation();
  const { config } = useWorkspaceConfig();
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLogZaloModalOpen, setIsLogZaloModalOpen] = useState(false);

  const currentStageKey =
    customer.leadStage ||
    (customer.leadStatus === 'CONVERTED'
      ? 'STAGE_ENROLLED'
      : customer.leadStatus === 'POTENTIAL'
      ? 'STAGE_QUALIFIED'
      : customer.leadStatus === 'UNQUALIFIED'
      ? 'STAGE_LOST'
      : 'STAGE_NEW');

  const handleStageSelect = (stageItem: { id: string; name: string; isWon?: boolean; isLost?: boolean }) => {
    let legacyStatus: LeadStatus = 'NEW';
    if (stageItem.isWon) legacyStatus = 'CONVERTED';
    else if (stageItem.isLost) legacyStatus = 'UNQUALIFIED';
    else legacyStatus = 'POTENTIAL';

    onUpdateLeadStatus(legacyStatus);
    if (onUpdateLeadStage) {
      onUpdateLeadStage(stageItem.id);
    }
    notify.success(`Đã cập nhật giai đoạn: "${stageItem.name}".`);
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    notify.success(`${t('common.copied')}: ${fieldName}`);
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
    <aside className={`pancake-col-right ${isMobileOpen ? 'mobile-visible' : ''}`}>
      {/* Nút đóng dành cho mobile view */}
      {onCloseMobile && isMobileOpen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="crm-btn crm-btn-secondary crm-btn-sm"
            onClick={onCloseMobile}
            title="Đóng hồ sơ"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} />
            <span>Đóng Hồ Sơ</span>
          </button>
        </div>
      )}
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
              title={t('inbox.profile.callNow')}
            >
              <Phone size={14} />
              <span>{t('inbox.profile.callNow')}</span>
            </a>
          )}
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="contact-action-btn email"
              title={t('inbox.profile.sendEmail')}
            >
              <Mail size={14} />
              <span>{t('inbox.profile.sendEmail')}</span>
            </a>
          )}
          <button
            type="button"
            className="contact-action-btn zalo-log"
            onClick={() => setIsLogZaloModalOpen(true)}
            title="Ghi nhận nhật ký tư vấn từ Zalo cá nhân của bạn"
            style={{
              background: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
              cursor: 'pointer',
            }}
          >
            <Smartphone size={14} />
            <span>Log Zalo</span>
          </button>
        </div>
      </div>

      <div className="profile-scroll-body">
        {/* 2. Phễu Khách Hàng (Workspace Pipeline Stages) */}
        <div className="profile-section-card">
          <div className="section-title-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} className="section-title-icon" />
              <h4 className="section-title">{config.terminology.pipelineName}</h4>
            </div>
            {onNavigateToKanban && (
              <button
                type="button"
                className="btn-link-kanban"
                onClick={onNavigateToKanban}
                title="Mở Bảng Phễu Chăm Sóc dạng Kanban"
              >
                <LayoutGrid size={12} />
                <span>Bảng Kanban</span>
              </button>
            )}
          </div>

          <div className="lead-pipeline-stepper">
            {config.pipelineStages.map((item) => {
              const isCurrent =
                currentStageKey === item.id ||
                `STAGE_${currentStageKey}` === item.id ||
                item.id.replace('STAGE_', '') === currentStageKey;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`pipeline-stage-pill ${isCurrent ? 'active' : ''}`}
                  style={{
                    backgroundColor: isCurrent ? item.bgColor : undefined,
                    color: isCurrent ? item.color : undefined,
                    borderColor: isCurrent ? item.color : undefined,
                  }}
                  onClick={() => handleStageSelect(item)}
                >
                  <span className="pipeline-dot" style={{ backgroundColor: item.color }} />
                  <span className="pipeline-label">{item.name}</span>
                  {isCurrent && <span className="pipeline-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Chi Tiết Thông Tin Liên Hệ */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <User size={15} className="section-title-icon" />
            <h4 className="section-title">{t('inbox.profile.contactInfoTitle')}</h4>
          </div>

          <div className="contact-info-list">
            <div className="contact-info-item">
              <span className="contact-label">{t('inbox.profile.phoneLabel')}:</span>
              <div className="contact-value-group">
                <span className="contact-value">{customer.phone || '—'}</span>
                {customer.phone && (
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(customer.phone, t('inbox.profile.phoneLabel'))}
                    title={t('common.copy')}
                  >
                    {copiedField === t('inbox.profile.phoneLabel') ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>

            <div className="contact-info-item">
              <span className="contact-label">{t('inbox.profile.emailLabel')}:</span>
              <div className="contact-value-group">
                <span className="contact-value">{customer.email || '—'}</span>
                {customer.email && (
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopy(customer.email, t('inbox.profile.emailLabel'))}
                    title={t('common.copy')}
                  >
                    {copiedField === t('inbox.profile.emailLabel') ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>

            <div className="contact-info-item">
              <span className="contact-label">{t('inbox.profile.connectedChannelLabel')}:</span>
              <span className="contact-value">{customer.channelAccountName}</span>
            </div>
          </div>
        </div>

        {/* 4. Nhãn Phân Loại (Tags) */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <Tag size={15} className="section-title-icon" />
            <h4 className="section-title">{t('inbox.profile.tagsTitle')} ({customer.tags.length})</h4>
          </div>

          <div className="profile-tags-container">
            {customer.tags.map((tag, idx) => (
              <span key={idx} className="profile-tag-pill">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() => onRemoveTag(tag)}
                  title={t('common.delete')}
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
                  placeholder={t('inbox.profile.tagPlaceholder')}
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="add-tag-submit-btn">
                  {t('inbox.profile.saveTagBtn')}
                </button>
                <button
                  type="button"
                  className="add-tag-cancel-btn"
                  onClick={() => setIsAddingTag(false)}
                >
                  {t('inbox.profile.cancelTagBtn')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="add-tag-trigger-btn"
                onClick={() => setIsAddingTag(true)}
              >
                <Plus size={12} />
                <span>{t('inbox.profile.addTagBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. Khóa Học / Đơn Hàng / Sản Phẩm Quan Tâm */}
        <div className="profile-section-card">
          <div className="section-title-row">
            <BookOpen size={15} className="section-title-icon" />
            <h4 className="section-title">{config.terminology.productLabel} ({customer.interestCourses.length})</h4>
          </div>

          {customer.interestCourses.length === 0 ? (
            <p className="empty-sub-text">{t('inbox.profile.noCourses')}</p>
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
            <h4 className="section-title">{t('inbox.profile.internalNotesTitle')} ({customer.notes.length})</h4>
          </div>

          {/* Form thêm ghi chú */}
          <form onSubmit={handleAddNoteSubmit} className="add-note-form">
            <textarea
              className="note-textarea"
              rows={2}
              placeholder={t('inbox.profile.notePlaceholder')}
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
              <span>{t('inbox.profile.saveNoteBtn')}</span>
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
                      title={t('common.delete')}
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

      <LogPersonalZaloModal
        isOpen={isLogZaloModalOpen}
        customer={customer}
        onClose={() => setIsLogZaloModalOpen(false)}
        onSaveNote={(note) => onAddNote(note)}
      />
    </aside>
  );
};
