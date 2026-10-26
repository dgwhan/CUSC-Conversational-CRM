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
  Edit2,
  DollarSign,
} from 'lucide-react';
import type { CustomerProfile, LeadStatus, LeadStage } from '../types.js';
import { Avatar } from '../../../components/common/Avatar.js';
import { AssignProductModal } from '../../../components/common/AssignProductModal.js';
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
  onUpdateProducts?: (courses: string[], estimatedValue: number) => void;
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
  onUpdateProducts,
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
  const [isAssignProductModalOpen, setIsAssignProductModalOpen] = useState(false);

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
          <Avatar
            src={customer.avatarUrl}
            name={customer.fullName}
            size={72}
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
          <div className="section-title-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={15} className="section-title-icon" />
              <h4 className="section-title">
                {config.terminology.productLabel} ({customer.interestCourses?.length || 0})
              </h4>
            </div>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={() => setIsAssignProductModalOpen(true)}
              title={`Gán hoặc thay đổi ${config.terminology.productLabel.toLowerCase()}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                padding: '3px 8px',
                color: '#0284c7',
                background: '#f0f9ff',
                borderColor: '#bae6fd',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>Gán</span>
            </button>
          </div>

          {!customer.interestCourses || customer.interestCourses.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 12px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                marginTop: '6px',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b' }}>
                Chưa gán {config.terminology.productLabel.toLowerCase()}
              </p>
              <button
                type="button"
                onClick={() => setIsAssignProductModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: '#0284c7',
                  background: '#ffffff',
                  border: '1px solid #0284c7',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <Plus size={13} />
                <span>Chọn từ danh mục cấu hình</span>
              </button>
            </div>
          ) : (
            <div className="courses-list" style={{ marginTop: '8px' }}>
              {customer.interestCourses.map((course, idx) => {
                const prod = config.productCatalog.find((p) => p.name === course || p.id === course);
                return (
                  <div
                    key={idx}
                    className="course-item-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <div className="course-dot" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="course-name"
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={course}
                        >
                          {course}
                        </div>
                        {prod && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px',
                              marginTop: '2px',
                            }}
                          >
                            {prod.category && (
                              <span
                                style={{
                                  background: '#e2e8f0',
                                  color: '#475569',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 500,
                                }}
                              >
                                {prod.category}
                              </span>
                            )}
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(prod.defaultPrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = customer.interestCourses.filter((c) => c !== course);
                        const nextVal = next.reduce((sum, name) => {
                          const f = config.productCatalog.find((p) => p.name === name || p.id === name);
                          return sum + (f?.defaultPrice || 0);
                        }, 0);
                        if (onUpdateProducts) onUpdateProducts(next, nextVal);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Gỡ bỏ"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}

              {/* Dòng tổng giá trị dự kiến */}
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  {config.terminology.valueLabel}:
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#059669' }}>
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    customer.estimatedValue || 0
                  )}
                </span>
              </div>
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

      {/* Modal Gán Khóa học / Dự án BĐS / Gói liệu trình dịch vụ theo Catalog cấu hình */}
      <AssignProductModal
        isOpen={isAssignProductModalOpen}
        onClose={() => setIsAssignProductModalOpen(false)}
        customerName={customer.fullName}
        productLabel={config.terminology.productLabel}
        valueLabel={config.terminology.valueLabel}
        catalog={config.productCatalog}
        initialSelected={customer.interestCourses || []}
        initialValue={customer.estimatedValue || 0}
        onSave={(courses, estimatedVal) => {
          if (onUpdateProducts) {
            onUpdateProducts(courses, estimatedVal);
          }
          notify.success(`Đã cập nhật ${config.terminology.productLabel.toLowerCase()} cho ${customer.fullName}.`);
        }}
      />
    </aside>
  );
};
