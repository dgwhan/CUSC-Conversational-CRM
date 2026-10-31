import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  LEAD_STATUS,
  PIPELINE_STAGE_ID,
  type CustomerProfile,
  type LeadStatus,
  type LeadStage,
} from '../types.js';
import { AssignProductModal } from '../../../components/common/AssignProductModal.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { LogPersonalZaloModal } from './LogPersonalZaloModal.js';
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';
import {
  ContactHeader,
  ChannelIdentitiesSection,
  ContactInfoSection,
  ContactActivitySection,
  ContactTagsSection,
  InterestedCoursesSection,
  InternalNotesSection,
} from './contact-detail/index.js';
import '../../../styles/contact-sidebar-flat.css';

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
  onUpdateContactInfo?: (info: { phone?: string; email?: string; fullName?: string }) => void;
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
  onUpdateContactInfo,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { config } = useWorkspaceConfig();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLogZaloModalOpen, setIsLogZaloModalOpen] = useState(false);
  const [isAssignProductModalOpen, setIsAssignProductModalOpen] = useState(false);

  // Trigger sửa nhanh từ Header ("Gọi ngay" / "Gửi Mail")
  const [triggerEditPhone, setTriggerEditPhone] = useState(false);
  const [triggerEditEmail, setTriggerEditEmail] = useState(false);

  // Xác định giai đoạn hiện tại (Mặc định linh hoạt theo cấu hình Workspace)
  const currentStageKey =
    customer.leadStage ||
    (customer.leadStatus === LEAD_STATUS.CONVERTED
      ? (config.pipelineStages.find((s) => s.isWon)?.id || PIPELINE_STAGE_ID.STAGE_ENROLLED)
      : customer.leadStatus === LEAD_STATUS.UNQUALIFIED
      ? (config.pipelineStages.find((s) => s.isLost)?.id || PIPELINE_STAGE_ID.STAGE_LOST)
      : (config.pipelineStages[0]?.id || PIPELINE_STAGE_ID.STAGE_NEW));

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    notify.success(`Đã sao chép: ${fieldName}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const effectiveIdentities =
    customer.channelIdentities && customer.channelIdentities.length > 0
      ? customer.channelIdentities
      : [
          {
            channel: customer.channel || 'FACEBOOK',
            externalUserId: customer.socialId || '1344305088771625',
          },
        ];

  const effectiveCourses =
    customer.interestCourses && customer.interestCourses.length > 0
      ? customer.interestCourses
      : [];

  const effectiveEstimatedTuition =
    customer.estimatedValue && customer.estimatedValue > 0
      ? customer.estimatedValue
      : 0;

  return (
    <aside className={`contact-detail-sidebar pancake-col-right ${isMobileOpen ? 'mobile-visible' : ''}`}>
      {/* Nút đóng dành cho mobile view */}
      {onCloseMobile && isMobileOpen && (
        <div className="flat-mobile-close-bar">
          <button
            type="button"
            className="flat-btn flat-btn-secondary"
            onClick={onCloseMobile}
            title="Đóng hồ sơ"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <X size={14} />
            <span>Đóng Hồ Sơ</span>
          </button>
        </div>
      )}

      {/* A. CONTACT HEADER */}
      <ContactHeader
        customer={customer}
        copiedField={copiedField}
        onCopy={handleCopy}
        onStartEditPhone={() => setTriggerEditPhone(true)}
        onStartEditEmail={() => setTriggerEditEmail(true)}
        onOpenMenu={() => setIsLogZaloModalOpen(true)}
      />

      <div className="flat-sidebar-body">

        {/* B. ĐỊNH DANH KÊNH HỘI THOẠI */}
        <ChannelIdentitiesSection
          identities={effectiveIdentities}
          copiedField={copiedField}
          onCopy={handleCopy}
        />

        {/* D. THÔNG TIN LIÊN HỆ */}
        <ContactInfoSection
          phone={customer.phone}
          email={customer.email}
          channelAccountName={customer.channelAccountName}
          contactId={customer.contactId}
          copiedField={copiedField}
          onCopy={handleCopy}
          onUpdateContactInfo={onUpdateContactInfo}
          isEditingPhoneExternal={triggerEditPhone}
          onResetEditingPhoneExternal={() => setTriggerEditPhone(false)}
          isEditingEmailExternal={triggerEditEmail}
          onResetEditingEmailExternal={() => setTriggerEditEmail(false)}
        />

        {/* E. HOẠT ĐỘNG (Giai đoạn khách hàng tiềm năng & Đánh dấu Lead chuẩn Meta Business Suite) */}
        <ContactActivitySection
          customer={customer}
          currentStageKey={currentStageKey}
          stages={config.pipelineStages}
          onUpdateLeadStatus={onUpdateLeadStatus}
          onUpdateLeadStage={onUpdateLeadStage}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onNavigateToKanban={onNavigateToKanban}
        />

        {/* F. NHÃN PHÂN LOẠI */}
        <ContactTagsSection
          tags={customer.tags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />

        {/* F. KHÓA HỌC / CHƯƠNG TRÌNH ĐÀO TẠO */}
        <InterestedCoursesSection
          productLabel={config.terminology.productLabel}
          courses={customer.interestCourses}
          estimatedValue={customer.estimatedValue}
          catalog={config.productCatalog}
          onOpenAssignModal={() => setIsAssignProductModalOpen(true)}
          onRemoveCourse={(course) => {
            const next = effectiveCourses.filter((c) => c !== course);
            const nextVal = next.reduce((sum, name) => {
              const f = config.productCatalog.find((p) => p.name === name || p.id === name);
              return sum + (f?.defaultPrice || 0);
            }, 0);
            if (onUpdateProducts) onUpdateProducts(next, nextVal);
          }}
        />

        {/* G. GHI CHÚ NỘI BỘ */}
        <InternalNotesSection
          notes={customer.notes}
          onAddNote={onAddNote}
          onRemoveNote={onRemoveNote}
        />
      </div>

      {/* Modal Zalo Log cá nhân */}
      <LogPersonalZaloModal
        isOpen={isLogZaloModalOpen}
        customer={customer}
        onClose={() => setIsLogZaloModalOpen(false)}
        onSaveNote={(note) => onAddNote(note)}
      />

      {/* Modal Gán Khóa học */}
      <AssignProductModal
        isOpen={isAssignProductModalOpen}
        onClose={() => setIsAssignProductModalOpen(false)}
        customerName={customer.fullName}
        productLabel={config.terminology.productLabel}
        valueLabel={config.terminology.valueLabel}
        catalog={config.productCatalog}
        initialSelected={effectiveCourses}
        initialValue={effectiveEstimatedTuition}
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
