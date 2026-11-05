import React, { useState } from 'react';
import { ExternalLink, Star, AlertTriangle, AlertCircle } from 'lucide-react';
import { type CustomerProfile, type LeadStatus, type LeadStage, LEAD_STATUS } from '../../../types.js';
import { type StageDefinition, STANDARD_7_STAGES } from '../types/index.js';
import { LeadStageSelector } from './LeadStageSelector.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import { Modal } from '../../../../../components/ui/Modal.js';

export interface ContactActivitySectionProps {
  customer: CustomerProfile;
  currentStageKey?: string | null;
  stages?: Array<{ id: string; name: string; color?: string; bgColor?: string; isWon?: boolean; isLost?: boolean }>;
  onUpdateLeadStatus: (status: LeadStatus) => void;
  onUpdateLeadStage?: (stage: LeadStage) => void;
  onAddTag: (tag: string) => void;
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
  const [isUnmarkModalOpen, setIsUnmarkModalOpen] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  const isExplicitlyNew = customer.leadStatus === LEAD_STATUS.NEW;
  const isPotentialStatus =
    customer.leadStatus === LEAD_STATUS.POTENTIAL ||
    customer.leadStatus === LEAD_STATUS.CONVERTED ||
    customer.leadStatus === LEAD_STATUS.UNQUALIFIED;
  const hasLeadTag = Array.isArray(customer.tags) && customer.tags.some(
    (t) => t.trim().toLowerCase() === 'lead' || t.trim().toLowerCase() === 'facebook lead'
  );
  // Nếu rõ ràng là NEW thì không bao giờ là Lead (null giai đoạn)
  const isLead = !isExplicitlyNew && (isPotentialStatus || Boolean(customer.leadStage) || hasLeadTag);

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

  const currentStage = (isLead && currentStageKey)
    ? (availableStages.find(
        (s) =>
          s.id === currentStageKey ||
          s.id.toLowerCase() === currentStageKey.toLowerCase() ||
          s.id.replace('STAGE_', '') === currentStageKey ||
          `STAGE_${currentStageKey}` === s.id
      ) || availableStages[0])
    : null;

  const handleMarkAsLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.POTENTIAL);
    if (!hasLeadTag) onAddTag('Lead');
    notify.success(`Đã đánh dấu "${customer.fullName}" là tiềm năng.`);
  };

  const handleConfirmUnmarkLead = () => {
    onUpdateLeadStatus(LEAD_STATUS.NEW);
    setIsUnmarkModalOpen(false);
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
    <div className="p-4 bg-white space-y-2.5">
      {/* 1. Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Khách Hàng Tiềm Năng
          </h4>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem giải thích khách hàng tiềm năng & tiến trình phễu"
            aria-label="Giải thích khách hàng tiềm năng"
          >
            <AlertCircle size={13} />
          </button>
        </div>

        {onNavigateToKanban && (
          <button
            type="button"
            onClick={onNavigateToKanban}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            title="Xem trên Bảng Kanban"
          >
            <span>Kanban</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      {/* 2. Banner Trạng thái Khách hàng tiềm năng (Lead) */}
      <div
        className={`flex items-center justify-between p-2 rounded-md border text-xs ${
          isLead
            ? 'bg-slate-50 border-slate-200/80 text-slate-800'
            : 'bg-slate-50/60 border-slate-200/60 text-slate-500'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Star
            size={13}
            className={`shrink-0 ${
              isLead ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
            }`}
          />
          <span className="font-medium truncate">
            {isLead ? 'Khách hàng tiềm năng' : 'Chưa gắn tiềm năng'}
          </span>
        </div>

        {isLead ? (
          <button
            type="button"
            onClick={() => setIsUnmarkModalOpen(true)}
            className="text-[11px] font-normal text-slate-400 hover:text-rose-600 cursor-pointer bg-transparent border-0 p-0 transition-colors ml-2 shrink-0"
            title="Bỏ đánh dấu tiềm năng"
          >
            Hủy
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMarkAsLead}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors ml-2 shrink-0"
          >
            + Đánh dấu
          </button>
        )}
      </div>

      {/* 3. Dropdown Chọn Giai đoạn */}
      {isLead && currentStage && (
        <LeadStageSelector
          isLead={isLead}
          currentStage={currentStage}
          availableStages={availableStages}
          onSelectStage={handleSelectStage}
        />
      )}

      {/* 4. Modal cảnh báo khi hủy khách hàng tiềm năng */}
      <Modal
        isOpen={isUnmarkModalOpen}
        onClose={() => setIsUnmarkModalOpen(false)}
        title="Hủy Khách Hàng Tiềm Năng"
        size="sm"
        showCloseButton={true}
        primaryAction={{
          label: 'Xác nhận hủy',
          onClick: handleConfirmUnmarkLead,
          variant: 'danger',
        }}
        secondaryAction={{
          label: 'Giữ lại',
          onClick: () => setIsUnmarkModalOpen(false),
          variant: 'secondary',
        }}
      >
        <div className="space-y-3 py-1 text-xs text-slate-600 leading-relaxed">
          <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200/80 rounded-lg text-rose-900">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-950 m-0">
                Cảnh báo dữ liệu sẽ bị xóa!
              </p>
              <p className="m-0 text-rose-800 text-[11px] leading-relaxed">
                Khách hàng <span className="font-bold">{customer.fullName}</span> sẽ bị xóa khỏi danh sách tiềm năng (Lead). Thẻ theo dõi trên bảng Kanban và dữ liệu tiến trình phễu hiện tại sẽ bị xóa hoàn toàn.
              </p>
            </div>
          </div>
          <p className="m-0 text-slate-500 text-[11px]">
            Hệ thống sẽ đồng thời gỡ nhãn Tiềm năng và đưa khách hàng về trạng thái hội thoại thông thường. Bạn có chắc chắn muốn thực hiện?
          </p>
        </div>
      </Modal>

      {/* 5. Modal Giải thích Khách hàng tiềm năng & Giai đoạn */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Khách Hàng Tiềm Năng & Tiến Trình Phễu"
        size="md"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplainModalOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              1. Khách hàng tiềm năng (Lead)
            </h5>
            <p className="m-0 text-slate-600">
              Đánh dấu khách hàng đang có nhu cầu thực tế và quan tâm sâu đến sản phẩm/dịch vụ để đưa vào phễu chăm sóc hoặc quy trình bán hàng chuyên sâu.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Tiến trình theo giai đoạn phễu
            </h5>
            <p className="m-0 text-slate-600">
              Theo dõi từng bước tiếp cận khách hàng từ khi tiếp nhận ban đầu, tư vấn giải pháp, gửi báo giá đến khi hoàn tất hợp đồng hoặc đơn hàng.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Đồng bộ hai chiều với Bảng Kanban CRM
            </h5>
            <p className="m-0 text-slate-600">
              Mỗi khi thay đổi giai đoạn tại đây, thẻ khách hàng trên bảng Kanban sẽ tự động di chuyển sang cột tương ứng theo thời gian thực mà không cần tải lại trang.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              4. Hủy trạng thái tiềm năng
            </h5>
            <p className="m-0 text-slate-600">
              Khi khách hàng không còn nhu cầu hoặc chưa phù hợp, thao tác hủy sẽ đưa hồ sơ về trạng thái mới thông thường, đồng thời xóa giai đoạn phễu (null) và gỡ thẻ khỏi Kanban.
            </p>
          </div>
        </div>
      </Modal>

      {/* 5. Modal Giải thích Khách hàng tiềm năng & Giai đoạn */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Khách Hàng Tiềm Năng & Tiến Trình Phễu"
        size="md"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplainModalOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              1. Khách hàng tiềm năng (Lead)
            </h5>
            <p className="m-0 text-slate-600">
              Đánh dấu khách hàng đang có nhu cầu thực tế và quan tâm sâu đến sản phẩm/dịch vụ để đưa vào phễu chăm sóc hoặc quy trình bán hàng chuyên sâu.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Tiến trình theo giai đoạn phễu
            </h5>
            <p className="m-0 text-slate-600">
              Theo dõi từng bước tiếp cận khách hàng từ khi tiếp nhận ban đầu, tư vấn giải pháp, gửi báo giá đến khi hoàn tất hợp đồng hoặc đơn hàng.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Đồng bộ hai chiều với Bảng Kanban CRM
            </h5>
            <p className="m-0 text-slate-600">
              Mỗi khi thay đổi giai đoạn tại đây, thẻ khách hàng trên bảng Kanban sẽ tự động di chuyển sang cột tương ứng theo thời gian thực mà không cần tải lại trang.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              4. Hủy trạng thái tiềm năng
            </h5>
            <p className="m-0 text-slate-600">
              Khi khách hàng không còn nhu cầu hoặc chưa phù hợp, thao tác hủy sẽ đưa hồ sơ về trạng thái mới thông thường, đồng thời xóa giai đoạn phễu (null) và gỡ thẻ khỏi Kanban.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
