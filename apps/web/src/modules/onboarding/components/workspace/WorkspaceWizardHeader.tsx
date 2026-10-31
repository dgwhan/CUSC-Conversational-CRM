import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../../../i18n/index.js';

export interface WorkspaceWizardHeaderProps {
  isCreatingNewWorkspace: boolean;
  activeWorkspaceName?: string;
  onBackToList: () => void;
  onSkipToInbox?: () => void;
}

/**
 * Header banner và nút quay lại cho giao diện Wizard thiết lập Không gian làm việc
 */
export const WorkspaceWizardHeader: React.FC<WorkspaceWizardHeaderProps> = ({
  isCreatingNewWorkspace,
  activeWorkspaceName,
  onBackToList,
  onSkipToInbox,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Nút Quay lại danh sách không gian làm việc (phẳng, nằm góc trái) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors bg-transparent border-0 p-0 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Quay lại danh sách không gian làm việc</span>
        </button>
      </div>

      {/* Top Banner Tiêu đề Wizard */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 m-0">
            {isCreatingNewWorkspace
              ? 'Tạo Không gian làm việc & Kết nối Kênh'
              : `Cấu hình Không gian làm việc: ${activeWorkspaceName || 'CUSC CRM'}`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
            {t('onboarding.welcomeDesc')}
          </p>
        </div>

        {onSkipToInbox && (
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors rounded-none cursor-pointer"
            onClick={onSkipToInbox}
          >
            {t('onboarding.skipToInbox')}
          </button>
        )}
      </div>
    </>
  );
};
