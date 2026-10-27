import React from 'react';
import { ExternalLink } from 'lucide-react';
import { STANDARD_7_STAGES, type StageDefinition } from './contactDetail.types.js';
import { LEAD_STATUS, PIPELINE_STAGE_ID } from '../../types.js';

interface PipelineStagesSectionProps {
  pipelineName?: string;
  currentStageKey: string;
  onNavigateToKanban?: () => void;
  onSelectStage: (stage: StageDefinition) => void;
}

export const PipelineStagesSection: React.FC<PipelineStagesSectionProps> = ({
  pipelineName = 'Phễu Tuyển Sinh & Đào Tạo',
  currentStageKey,
  onNavigateToKanban,
  onSelectStage,
}) => {
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

      <div className="flat-pipeline-list" role="listbox" aria-label="Giai đoạn phễu tuyển sinh">
        {STANDARD_7_STAGES.map((stage) => {
          const isSelected =
            currentStageKey === stage.id ||
            currentStageKey === stage.id.replace('STAGE_', '') ||
            (currentStageKey === PIPELINE_STAGE_ID.STAGE_CONTACTED && stage.id === PIPELINE_STAGE_ID.STAGE_CONTACTED) ||
            (currentStageKey === LEAD_STATUS.POTENTIAL && stage.id === PIPELINE_STAGE_ID.STAGE_CONTACTED);

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
