import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  number: number;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface OnboardingStepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
  canNavigateToStep?: (stepNumber: number) => boolean;
  className?: string;
}

/**
 * Component thanh vòng đời / tiến trình các bước Onboarding chuẩn Flat Design
 * Tách độc lập, hiển thị rõ ràng nhãn bước và tên bước với phân cấp trực quan
 */
export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  canNavigateToStep,
  className = '',
}) => {
  return (
    <div className={`w-full bg-white border border-slate-200 rounded-none px-4 sm:px-6 py-4 mb-6 ${className}`}>
      <div className="flex items-center justify-between relative">
        {steps.map((s, idx) => {
          const isCompleted = currentStep > s.number;
          const isCurrent = currentStep === s.number;
          const isNavigable = canNavigateToStep ? canNavigateToStep(s.number) : isCompleted;
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={s.number}>
              {/* Step Item */}
              <div
                className={`flex items-center gap-3 select-none transition-opacity ${
                  isNavigable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                }`}
                onClick={() => {
                  if (isNavigable && onStepClick) {
                    onStepClick(s.number);
                  }
                }}
              >
                {/* Circle Icon Indicator */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border border-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={2.5} /> : s.icon}
                </div>

                {/* Step Text (Phân biệt rõ ràng thứ tự bước và tên tiêu đề) */}
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                          ? 'text-blue-600'
                          : 'text-slate-400'
                    }`}
                  >
                    BƯỚC {s.number}
                  </span>
                  <span
                    className={`text-xs sm:text-[13px] whitespace-nowrap ${
                      isCompleted
                        ? 'text-slate-800 font-semibold'
                        : isCurrent
                          ? 'text-blue-900 font-bold'
                          : 'text-slate-500 font-medium'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              </div>

              {/* Connecting Line Between Steps */}
              {!isLast && (
                <div
                  className={`flex-1 h-[1px] mx-3 sm:mx-6 transition-colors ${
                    currentStep > s.number ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
