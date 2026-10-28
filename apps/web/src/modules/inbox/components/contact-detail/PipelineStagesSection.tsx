import React from 'react';
import { ExternalLink } from 'lucide-react';
import { STANDARD_7_STAGES, type StageDefinition } from './contactDetail.types.js';
import { LEAD_STATUS, type LeadStatus } from '../../types.js';

interface PipelineStagesSectionProps {
  pipelineName?: string;
  stages?: Array<{ id: string; name: string; color?: string; bgColor?: string; isWon?: boolean; isLost?: boolean }>;
  currentStageKey: string;
  onNavigateToKanban?: () => void;
  onSelectStage: (stage: StageDefinition) => void;
}

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
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">{pipelineName}</h3>
        {onNavigateToKanban && (
          <button
            type="button"
            className="flat-link-action"
            onClick={onNavigateToKanban}
            title="Mở Bảng Phễu Chăm Sóc dạng Kanban"
          >
            <span>Bảng Kanban</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      <div className="flat-pipeline-list" role="listbox" aria-label="Giai đoạn phễu chăm sóc">
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
              className={`flat-pipeline-item stage-${stage.id} ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectStage(stage)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <span className="flat-pipeline-dot" />
                <span className="flat-pipeline-name">{stage.name}</span>
              </div>
              {isSelected && <span className="flat-pipeline-indicator">✓</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};
