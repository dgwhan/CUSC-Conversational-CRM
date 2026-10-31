import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import type { StageDefinition } from '../types/index.js';
import { PIPELINE_STAGE_ID, type PipelineStageId } from '../../../types.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';


export const STAGE_ROOT_COLOR_MAP: Record<PipelineStageId, string> = {
  [PIPELINE_STAGE_ID.STAGE_NEW]: 'var(--stage-new-color, #0284c7)',
  [PIPELINE_STAGE_ID.STAGE_CONTACTED]: 'var(--stage-contacted-color, var(--color-brand-primary, #2563eb))',
  [PIPELINE_STAGE_ID.STAGE_QUALIFIED]: 'var(--stage-qualified-color, var(--color-state-warning, #d97706))',
  [PIPELINE_STAGE_ID.STAGE_APPOINTMENT]: 'var(--stage-appointment-color, #ea580c)',
  [PIPELINE_STAGE_ID.STAGE_SUBMITTED]: 'var(--stage-submitted-color, #7c3aed)',
  [PIPELINE_STAGE_ID.STAGE_ENROLLED]: 'var(--stage-enrolled-color, var(--color-state-success, #16a34a))',
  [PIPELINE_STAGE_ID.STAGE_LOST]: 'var(--stage-lost-color, var(--color-state-error, #dc2626))',
};

const DEFAULT_STAGE_COLOR = STAGE_ROOT_COLOR_MAP[PIPELINE_STAGE_ID.STAGE_NEW];

const STAGE_SELECTOR_TEXT = {
  SECTION_TITLE: 'Giai đoạn khách hàng tiềm năng',
  STATUS_LOCKED: 'Chưa mở',
  STATUS_ACTIVE: 'Đang hoạt động',
  LOCKED_TRIGGER_LABEL: 'Cần đánh dấu tiềm năng để mở giai đoạn',
  LOCKED_TRIGGER_TOOLTIP: 'Cần đánh dấu tiềm năng để mở giai đoạn',
  LOCKED_WARNING_NOTIFICATION: 'Vui lòng bấm "Đánh dấu là khách hàng tiềm năng" ở trên để mở giai đoạn.',
} as const;

export interface LeadStageSelectorProps {
  isLead: boolean;
  currentStage: StageDefinition & { color?: string };
  availableStages: Array<StageDefinition & { color?: string }>;
  onSelectStage: (stage: StageDefinition) => void;
}


export const resolveStageColor = (
  stage: StageDefinition & { color?: string }
): { dot: string; text: string } => {
  if (stage.color) {
    return { dot: stage.color, text: stage.color };
  }
  if (stage.isWon) {
    const wonColor = STAGE_ROOT_COLOR_MAP[PIPELINE_STAGE_ID.STAGE_ENROLLED];
    return { dot: wonColor, text: wonColor };
  }
  if (stage.isLost) {
    const lostColor = STAGE_ROOT_COLOR_MAP[PIPELINE_STAGE_ID.STAGE_LOST];
    return { dot: lostColor, text: lostColor };
  }

  const rawId = stage.id || '';
  const normalizedId: PipelineStageId = rawId.startsWith('STAGE_')
    ? (rawId as PipelineStageId)
    : (`STAGE_${rawId}` as PipelineStageId);

  const resolvedColor = STAGE_ROOT_COLOR_MAP[normalizedId] || DEFAULT_STAGE_COLOR;
  return { dot: resolvedColor, text: resolvedColor };
};


export const LeadStageSelector: React.FC<LeadStageSelectorProps> = ({
  isLead,
  currentStage,
  availableStages,
  onSelectStage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentColors = resolveStageColor(currentStage);

  // Đóng dropdown khi click ngoài vùng
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleItemClick = (stage: StageDefinition) => {
    setIsOpen(false);
    onSelectStage(stage);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header trạng thái của giai đoạn */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[12px] font-semibold ${isLead ? 'text-slate-700' : 'text-slate-400'
            }`}
        >
          {STAGE_SELECTOR_TEXT.SECTION_TITLE}
        </span>
        {!isLead ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Lock size={10} />
            {STAGE_SELECTOR_TEXT.STATUS_LOCKED}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-blue-600">
            {STAGE_SELECTOR_TEXT.STATUS_ACTIVE}
          </span>
        )}
      </div>

      {/* Dropdown trigger */}
      <div className="relative" ref={dropdownRef}>
        {isLead ? (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-left transition-colors cursor-pointer hover:border-slate-400"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: currentColors.dot }}
              />
              <span
                className="text-[12.5px] font-semibold truncate"
                style={{ color: currentColors.text }}
              >
                {currentStage.name}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-500 shrink-0 ml-1.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''
                }`}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              notify.warning(STAGE_SELECTOR_TEXT.LOCKED_WARNING_NOTIFICATION);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-md text-left opacity-80 cursor-not-allowed"
            title={STAGE_SELECTOR_TEXT.LOCKED_TRIGGER_TOOLTIP}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Lock size={12} className="text-slate-400 shrink-0" />
              <span className="text-[12px] text-slate-500 italic">
                {STAGE_SELECTOR_TEXT.LOCKED_TRIGGER_LABEL}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          </button>
        )}

        {/* Dropdown menu popover */}
        {isLead && isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-md shadow-lg p-1 max-h-56 overflow-y-auto">
            {availableStages.map((stage) => {
              const isSelected = stage.id === currentStage.id;
              const colors = resolveStageColor(stage);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleItemClick(stage)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer text-[12.5px] ${isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: colors.dot }}
                    />
                    <span
                      className={`truncate ${isSelected ? 'font-semibold' : 'text-slate-800'
                        }`}
                      style={isSelected ? { color: colors.text } : undefined}
                    >
                      {stage.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[12px] font-bold" style={{ color: colors.text }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
