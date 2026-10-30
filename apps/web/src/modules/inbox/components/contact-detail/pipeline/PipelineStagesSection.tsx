import React from 'react';
import { ExternalLink } from 'lucide-react';
import { STANDARD_7_STAGES, type StageDefinition } from '../types/index.js';
import { LEAD_STATUS, type LeadStatus } from '../../../types.js';

interface PipelineStagesSectionProps {
  pipelineName?: string;
  stages?: Array<{ id: string; name: string; color?: string; bgColor?: string; isWon?: boolean; isLost?: boolean }>;
  currentStageKey: string;
  onNavigateToKanban?: () => void;
  onSelectStage: (stage: StageDefinition) => void;
}

/**
 * Section: Phễu Tuyển Sinh & Chăm Sóc (Dạng danh sách đầy đủ)
 * Sử dụng Tailwind CSS chuẩn hệ thống
 */
export const PipelineStagesSection: React.FC<PipelineStagesSectionProps> = ({
  pipelineName = 'Phễu Chăm Sóc Khách Hàng',
  stages,
  currentStageKey,
  onNavigateToKanban,
  onSelectStage,
}) => {
  const stageList: StageDefinition[] =
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
          };
        })
      : STANDARD_7_STAGES;

  return (
    <section className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          {pipelineName}
        </h3>
        {onNavigateToKanban && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            onClick={onNavigateToKanban}
            title="Mở Bảng Phễu Chăm Sóc dạng Kanban"
          >
            <span>Bảng Kanban</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1" role="listbox" aria-label="Giai đoạn phễu chăm sóc">
        {stageList.map((stage) => {
          const isSelected =
            currentStageKey === stage.id ||
            currentStageKey.toLowerCase() === stage.id.toLowerCase() ||
            currentStageKey === stage.id.replace('STAGE_', '') ||
            `STAGE_${currentStageKey}` === stage.id ||
            (currentStageKey === LEAD_STATUS.CONVERTED && stage.isWon) ||
            (currentStageKey === LEAD_STATUS.UNQUALIFIED && stage.isLost);

          return (
            <button
              key={stage.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer text-[12.5px] border-0 ${
                isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-transparent text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => onSelectStage(stage)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isSelected ? 'bg-blue-600' : 'bg-slate-400'
                  }`}
                />
                <span className="truncate">{stage.name}</span>
              </div>
              {isSelected && <span className="text-[12px] font-bold text-blue-600">✓</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};
