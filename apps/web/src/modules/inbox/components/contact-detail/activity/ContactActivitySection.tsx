import React from 'react';
import { ExternalLink } from 'lucide-react';
import { type CustomerProfile, type LeadStatus, type LeadStage, LEAD_STATUS } from '../../../types.js';
import { type StageDefinition, STANDARD_7_STAGES } from '../types/index.js';
import { LeadStatusToggle } from './LeadStatusToggle.js';
import { LeadStageSelector } from './LeadStageSelector.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';

export interface ContactActivitySectionProps {
  customer: CustomerProfile;
  currentStageKey: string;
  stages?: Array<{ id: string; name: string; color?: string; bgColor?: string; isWon?: boolean; isLost?: boolean }>;
  onUpdateLeadStatus: (status: LeadStatus) => void;
  onUpdateLeadStage?: (stage: LeadStage) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  onNavigateToKanban?: () => void;
}

/**
 * Section: Hoạt động (Activity)
 * Quản lý trạng thái tiềm năng & giai đoạn phễu chăm sóc khách hàng
 */
export const ContactActivitySection: React.FC<ContactActivitySectionProps> = ({
  customer,
  currentStageKey,
  stages,
  onUpdateLeadStatus,
  onUpdateLeadStage,
  onAddTag,
  onNavigateToKanban,
}) => {
  // Kiểm tra khách hàng hiện tại đã được đánh dấu là tiềm năng chưa
  const hasLeadTag = Array.isArray(customer.tags) && customer.tags.some(
    (t) => t.trim().toLowerCase() === 'lead' || t.trim().toLowerCase() === 'facebook lead'
  );
  const isPotentialStatus =
    customer.leadStatus === LEAD_STATUS.POTENTIAL ||
    customer.leadStatus === LEAD_STATUS.CONVERTED ||
    customer.leadStatus === LEAD_STATUS.UNQUALIFIED;
  const isLead = hasLeadTag || isPotentialStatus;

  // Danh sách các giai đoạn phễu chuẩn
  const availableStages: Array<StageDefinition & { color?: string }> =
    stages && stages.length > 0
      ? stages.map((s, idx) => {
        let status: LeadStatus = LEAD_STATUS.POTENTIAL;
        if (s.isWon) status = LEAD_STATUS.CONVERTED;
        else if (s.isLost) status = LEAD_STATUS.UNQUALIFIED;
        else if (idx === 0 || s.id === 'STAGE_NEW' || s.id === 'NEW') status = LEAD_STATUS.NEW;

        return {
          id: s.id,
          name: s.name,
          status,
          isWon: s.isWon,
          isLost: s.isLost,
          color: s.color,
        };
      })
      : STANDARD_7_STAGES;

  // Giai đoạn hiện tại
  const currentStage =
    availableStages.find(
      (s) =>
        s.id === currentStageKey ||
        s.id.toLowerCase() === currentStageKey.toLowerCase() ||
        s.id.replace('STAGE_', '') === currentStageKey ||
        `STAGE_${currentStageKey}` === s.id
    ) || availableStages[0];

  // Hành động: Đánh dấu là khách hàng tiềm năng
  const handleMarkAsLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.POTENTIAL);
    notify.success(`Đã đánh dấu "${customer.fullName}" là khách hàng tiềm năng.`);
  };

  // Hành động: Hủy đánh dấu tiềm năng
  const handleUnmarkLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.NEW);
    notify.info('Đã bỏ đánh dấu khách hàng tiềm năng. Giai đoạn đã bị khóa.');
  };

  // Hành động: Chọn giai đoạn
  const handleSelectStage = (stageItem: StageDefinition) => {
    if (!isLead) {
      notify.warning('Vui lòng bấm "Đánh dấu là khách hàng tiềm năng" trước để chọn giai đoạn.');
      return;
    }
    if (onUpdateLeadStage) {
      onUpdateLeadStage(stageItem.id);
    } else {
      onUpdateLeadStatus(stageItem.status);
    }
    if (stageItem.status === LEAD_STATUS.POTENTIAL || stageItem.status === LEAD_STATUS.CONVERTED) {
      if (!hasLeadTag) onAddTag('Lead');
    }
    notify.success(`Đã chuyển giai đoạn: "${stageItem.name}".`);
  };

  return (
    <section className="p-4 border-b border-slate-200">
      {/* 1. Header Section */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          Hoạt động
        </h3>
        {onNavigateToKanban && (
          <button
            type="button"
            onClick={onNavigateToKanban}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            title="Xem trên bảng Kanban"
          >
            <span>Bảng Kanban</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      <p className="text-[12px] text-slate-500 m-0 mb-3 leading-snug">
        Theo dõi những lượt tương tác quan trọng của khách hàng.
      </p>

      {/* 2. Sub-component: Đánh dấu khách hàng tiềm năng */}
      <LeadStatusToggle
        isLead={isLead}
        onMarkAsLead={handleMarkAsLead}
        onUnmarkLead={handleUnmarkLead}
      />

      {/* 3. Sub-component: Chọn giai đoạn phễu chăm sóc */}
      <LeadStageSelector
        isLead={isLead}
        currentStage={currentStage}
        availableStages={availableStages}
        onSelectStage={handleSelectStage}
      />
    </section>
  );
};
