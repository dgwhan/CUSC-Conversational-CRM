import React from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { type CustomerProfile, type LeadStatus, type LeadStage, LEAD_STATUS } from '../../../types.js';
import { type StageDefinition, STANDARD_7_STAGES } from '../types/index.js';
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

export const ContactActivitySection: React.FC<ContactActivitySectionProps> = ({
  customer,
  currentStageKey,
  stages,
  onUpdateLeadStatus,
  onUpdateLeadStage,
  onAddTag,
  onNavigateToKanban,
}) => {
  const hasLeadTag = Array.isArray(customer.tags) && customer.tags.some(
    (t) => t.trim().toLowerCase() === 'lead' || t.trim().toLowerCase() === 'facebook lead'
  );
  const isPotentialStatus =
    customer.leadStatus === LEAD_STATUS.POTENTIAL ||
    customer.leadStatus === LEAD_STATUS.CONVERTED ||
    customer.leadStatus === LEAD_STATUS.UNQUALIFIED;
  const isLead = hasLeadTag || isPotentialStatus;

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

  const currentStage =
    availableStages.find(
      (s) =>
        s.id === currentStageKey ||
        s.id.toLowerCase() === currentStageKey.toLowerCase() ||
        s.id.replace('STAGE_', '') === currentStageKey ||
        `STAGE_${currentStageKey}` === s.id
    ) || availableStages[0];

  const handleMarkAsLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.POTENTIAL);
    if (!hasLeadTag) onAddTag('Lead');
    notify.success(`Đã đánh dấu "${customer.fullName}" là khách hàng tiềm năng.`);
  };

  const handleUnmarkLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.NEW);
    notify.info('Đã bỏ đánh dấu khách hàng tiềm năng.');
  };

  const handleSelectStage = (stageItem: StageDefinition) => {
    if (!isLead) {
      onUpdateLeadStatus(LEAD_STATUS.POTENTIAL);
      if (!hasLeadTag) onAddTag('Lead');
    }
    if (onUpdateLeadStage) {
      onUpdateLeadStage(stageItem.id);
    } else {
      onUpdateLeadStatus(stageItem.status);
    }
    notify.success(`Đã chuyển giai đoạn: "${stageItem.name}".`);
  };

  return (
    <div className="p-4 bg-white space-y-3 border-b border-slate-100">
      {/* 1. Header Section */}
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
          Hoạt Động Tuyển Sinh
        </h4>
        {onNavigateToKanban && (
          <button
            type="button"
            onClick={onNavigateToKanban}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            title="Xem trên Bảng Kanban"
          >
            <span>Bảng Kanban</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      {/* 2. Banner Trạng thái Khách hàng tiềm năng (Lead) */}
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
          isLead
            ? 'bg-amber-50/80 border-amber-200/90 text-amber-900'
            : 'bg-slate-50/80 border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Star
            size={14}
            className={`shrink-0 ${
              isLead ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
            }`}
          />
          <span className="font-semibold truncate">
            {isLead ? 'Đã đánh dấu là khách hàng tiềm năng' : 'Chưa đánh dấu tiềm năng'}
          </span>
        </div>

        {isLead ? (
          <button
            type="button"
            onClick={handleUnmarkLead}
            className="text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer bg-transparent border-0 p-0 transition-colors ml-2 shrink-0"
            title="Bỏ đánh dấu tiềm năng"
          >
            Hủy
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMarkAsLead}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors ml-2 shrink-0"
          >
            + Đánh dấu
          </button>
        )}
      </div>

      {/* 3. Dropdown Chọn Giai đoạn (Chỉ hiển thị khi đã đánh dấu tiềm năng) */}
      {isLead && (
        <LeadStageSelector
          isLead={isLead}
          currentStage={currentStage}
          availableStages={availableStages}
          onSelectStage={handleSelectStage}
        />
      )}
    </div>
  );
};
