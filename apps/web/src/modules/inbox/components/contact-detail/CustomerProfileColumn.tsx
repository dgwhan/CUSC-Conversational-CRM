import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  LEAD_STATUS,
  PIPELINE_STAGE_ID,
  type CustomerProfile,
  type LeadStatus,
  type LeadStage,
  type AssignedStaff,
} from '../../types.js';
import { AssignProductModal } from '../../../../components/common/AssignProductModal.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';
import { LogPersonalZaloModal } from '../modals/LogPersonalZaloModal.js';
import { useWorkspaceConfig } from '../../../workspace/WorkspaceConfigContext.js';
import { useUserRole } from '../../../auth/index.js';
import {
  ContactHeader,
  ChannelIdentitiesSection,
  ContactInfoSection,
  AssignedAgentSection,
  ContactActivitySection,
  ContactTagsSection,
  InterestedCoursesSection,
  InternalNotesSection,
} from './index.js';

export interface CustomerProfileColumnProps {
  customer: CustomerProfile;
  assignedStaff?: AssignedStaff | null;
  staffList?: AssignedStaff[];
  onAssignStaff?: (staffId: string) => void;
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
  assignedStaff,
  staffList,
  onAssignStaff,
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
  const { isOwner } = useUserRole();
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
            externalUserId: customer.socialId || '',
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
    <aside
      className={`w-[340px] min-w-[320px] max-w-[360px] border-l border-slate-200 bg-white flex flex-col h-full shrink-0 select-none overflow-hidden transition-all ${
        isMobileOpen
          ? 'fixed inset-y-0 right-0 z-50 shadow-2xl w-full max-w-sm'
          : 'hidden lg:flex'
      }`}
    >
      {/* 1. Header Cột: Customer Details */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h3 className="m-0 text-sm font-bold text-slate-800">
          Chi Tiết Khách Hàng
        </h3>
        {onCloseMobile && (
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={onCloseMobile}
            title="Đóng hồ sơ"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 2. Nội dung cuộn với visual hierarchy phân tầng rõ ràng */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
        {/* A. THÔNG TIN HỒ SƠ CHÍNH & TÁC VỤ (Contact Header) */}
        <ContactHeader
          customer={customer}
          copiedField={copiedField}
          onCopy={handleCopy}
          onStartEditPhone={() => setTriggerEditPhone(true)}
          onStartEditEmail={() => setTriggerEditEmail(true)}
          onOpenMenu={() => setIsLogZaloModalOpen(true)}
        />

        {/* B. THÔNG TIN LIÊN HỆ (Phone, Email, Contact ID) */}
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

        {/* C. NHÂN SỰ PHỤ TRÁCH (Assigned Agent) */}
        <AssignedAgentSection
          assignedStaff={assignedStaff}
          staffList={staffList}
          onAssignStaff={onAssignStaff}
          isOwner={isOwner}
        />

        {/* D. TRẠNG THÁI / GIAI ĐOẠN PHỄU TUYỂN SINH (Status List) */}
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

        {/* E. NHÃN PHÂN LOẠI (Tags - pastel rounded pills) */}
        <ContactTagsSection
          tags={customer.tags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />

        {/* F. KHÓA HỌC QUAN TÂM & HỌC PHÍ DỰ KIẾN */}
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

        {/* G. GHI CHÚ NỘI BỘ (Internal Notes) */}
        <InternalNotesSection
          notes={customer.notes}
          onAddNote={onAddNote}
          onRemoveNote={onRemoveNote}
        />

        {/* H. ĐỊNH DANH ĐA KÊNH (Chỉ hiển thị khi đã liên kết từ 2 kênh) */}
        {effectiveIdentities.length > 1 && (
          <ChannelIdentitiesSection
            identities={effectiveIdentities}
            copiedField={copiedField}
            onCopy={handleCopy}
            contactId={customer.contactId}
            onUnmergeSuccess={() => {
              window.location.reload();
            }}
          />
        )}
      </div>

      {/* MODAL GHI NHẬN TƯ VẤN ZALO CÁ NHÂN */}
      <LogPersonalZaloModal
        isOpen={isLogZaloModalOpen}
        customer={customer}
        onClose={() => setIsLogZaloModalOpen(false)}
        onSaveNote={(note) => {
          onAddNote(note);
          setIsLogZaloModalOpen(false);
        }}
      />

      {/* MODAL GÁN KHÓA HỌC & TÍNH HỌC PHÍ */}
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
