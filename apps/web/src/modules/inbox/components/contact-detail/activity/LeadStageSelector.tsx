import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { StageDefinition } from '../types/index.js';
import { PIPELINE_STAGE_ID } from '../../../types.js';

export const STAGE_COLOR_PALETTE: Record<string, { dot: string; text: string; bg: string }> = {
  [PIPELINE_STAGE_ID.STAGE_NEW]: { dot: '#0284c7', text: '#0369a1', bg: '#f0f9ff' },
  [PIPELINE_STAGE_ID.STAGE_CONTACTED]: { dot: '#2563eb', text: '#1d4ed8', bg: '#eff6ff' },
  [PIPELINE_STAGE_ID.STAGE_QUALIFIED]: { dot: '#d97706', text: '#b45309', bg: '#fffbeb' },
  [PIPELINE_STAGE_ID.STAGE_APPOINTMENT]: { dot: '#ea580c', text: '#c2410c', bg: '#fff7ed' },
  [PIPELINE_STAGE_ID.STAGE_SUBMITTED]: { dot: '#7c3aed', text: '#6d28d9', bg: '#f5f3ff' },
  [PIPELINE_STAGE_ID.STAGE_ENROLLED]: { dot: '#16a34a', text: '#15803d', bg: '#f0fdf4' },
  [PIPELINE_STAGE_ID.STAGE_LOST]: { dot: '#dc2626', text: '#b91c1c', bg: '#fef2f2' },
};

const DEFAULT_PALETTE = { dot: '#2563eb', text: '#1d4ed8', bg: '#eff6ff' };

export interface LeadStageSelectorProps {
  isLead: boolean;
  currentStage: StageDefinition & { color?: string };
  availableStages: Array<StageDefinition & { color?: string }>;
  onSelectStage: (stage: StageDefinition) => void;
}

export const resolveStagePalette = (
  stage: StageDefinition & { color?: string }
): { dot: string; text: string; bg: string } => {
  if (stage.isWon) return STAGE_COLOR_PALETTE[PIPELINE_STAGE_ID.STAGE_ENROLLED];
  if (stage.isLost) return STAGE_COLOR_PALETTE[PIPELINE_STAGE_ID.STAGE_LOST];

  const rawId = stage.id || '';
  const normalizedId = rawId.startsWith('STAGE_') ? rawId : `STAGE_${rawId}`;
  return STAGE_COLOR_PALETTE[normalizedId] || (stage.color ? { dot: stage.color, text: stage.color, bg: '#f8fafc' } : DEFAULT_PALETTE);
};

export const LeadStageSelector: React.FC<LeadStageSelectorProps> = ({
  isLead,
  currentStage,
  availableStages,
  onSelectStage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentPalette = resolveStagePalette(currentStage);

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

  const handleSelect = (stage: StageDefinition) => {
    setIsOpen(false);
    onSelectStage(stage);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={dropdownRef}>
      {/* Header trạng thái */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500">
          Giai đoạn khách hàng tiềm năng
        </span>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            !isLead
              ? 'bg-slate-100 text-slate-500 border border-slate-200'
              : currentStage.isWon
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : currentStage.isLost
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {!isLead ? 'Chưa đánh dấu Lead' : currentStage.isWon ? 'Thành công' : currentStage.isLost ? 'Đã đóng' : 'Đang hoạt động'}
        </span>
      </div>

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentPalette.dot }}
            />
            <span className="text-xs font-semibold text-slate-800 truncate">
              {currentStage.name}
            </span>
          </div>

          <ChevronDown
            size={14}
            className={`text-slate-400 shrink-0 ml-1.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu Popover */}
        {isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
              Chọn giai đoạn phễu
            </div>

            {availableStages.map((stage) => {
              const isSelected = stage.id === currentStage.id;
              const palette = resolveStagePalette(stage);

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleSelect(stage)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : 'hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: palette.dot }}
                    />
                    <span className="truncate">{stage.name}</span>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-blue-600 shrink-0 ml-2" />
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
