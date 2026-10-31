import React from 'react';
import {
  Building2,
  Share2,
  Users2,
  Loader2,
} from 'lucide-react';
import type {
  OnboardingState,
  BusinessSetupData,
  ChannelKey,
  DiscoveredPageDto,
} from '../../types.js';
import type { StaffRole } from '../../../../features/auth/constants/auth.constants.js';
import type { WorkspaceItem } from '../../../workspace/WorkspaceConfigContext.js';
import { OnboardingStepper } from '../OnboardingStepper.js';
import {
  BusinessSetupStep,
  ChannelConnectStep,
  TeamInviteStep,
} from '../steps/index.js';
import { WorkspaceWizardHeader } from './WorkspaceWizardHeader.js';
import { useTranslation } from '../../../../i18n/index.js';

export interface WorkspaceWizardViewProps {
  state: OnboardingState;
  isCreatingNewWorkspace: boolean;
  activeConfiguringWs: WorkspaceItem | null;
  isCheckingChannels: boolean;
  onBackToList: () => void;
  onSkipToInbox?: () => void;
  onStepClick: (step: number) => void;
  onStep1Next: (data: BusinessSetupData) => Promise<void>;
  onConnectChannel: (channel: ChannelKey, discoveredPages?: DiscoveredPageDto[]) => Promise<void>;
  onTogglePage: (pageId: string) => Promise<void>;
  onDisconnectPage: (pageId: string) => Promise<void>;
  onNextToStep3: () => void;
  onBackToStep1: () => void;
  onBackToStep2: () => void;
  onAddInvite: (email: string, role: StaffRole) => Promise<void>;
  onRemoveInvite: (id: string) => Promise<void>;
  onFinish: () => Promise<void>;
}

/**
 * Giao diện 3 bước thiết lập (Wizard Flow) tạo mới hoặc cấu hình Không gian làm việc
 */
export const WorkspaceWizardView: React.FC<WorkspaceWizardViewProps> = ({
  state,
  isCreatingNewWorkspace,
  activeConfiguringWs,
  isCheckingChannels,
  onBackToList,
  onSkipToInbox,
  onStepClick,
  onStep1Next,
  onConnectChannel,
  onTogglePage,
  onDisconnectPage,
  onNextToStep3,
  onBackToStep1,
  onBackToStep2,
  onAddInvite,
  onRemoveInvite,
  onFinish,
}) => {
  const { t } = useTranslation();

  const stepsMeta = [
    { number: 1, title: t('onboarding.steps.step1'), icon: <Building2 size={16} /> },
    { number: 2, title: t('onboarding.steps.step2'), icon: <Share2 size={16} /> },
    { number: 3, title: t('onboarding.steps.step3'), icon: <Users2 size={16} /> },
  ];

  if (isCheckingChannels) {
    return (
      <div
        className="onboarding-page-container"
        style={{ display: 'flex', minHeight: '360px', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#64748b' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: '#0284c7' }} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Đang kiểm tra trạng thái kết nối mạng xã hội...</span>
        </div>
      </div>
    );
  }

  const activeWorkspaceName =
    activeConfiguringWs?.name || state.business.companyName || 'CUSC CRM';

  return (
    <div className="onboarding-page-container">
      {/* Header Banner & Nút quay lại */}
      <WorkspaceWizardHeader
        isCreatingNewWorkspace={isCreatingNewWorkspace}
        activeWorkspaceName={activeWorkspaceName}
        onBackToList={onBackToList}
        onSkipToInbox={onSkipToInbox}
      />

      {/* Thanh vòng đời các bước Onboarding (OnboardingStepper Component) */}
      <OnboardingStepper
        steps={stepsMeta}
        currentStep={state.step}
        canNavigateToStep={(num) => {
          const hasExistingChannels = state.pages.length > 0;
          return num < state.step || (num === 1 && hasExistingChannels && !isCreatingNewWorkspace);
        }}
        onStepClick={onStepClick}
      />

      {/* Step Contents */}
      <div className="bg-white border border-slate-200 rounded-none p-6 sm:p-8">
        {state.step === 1 && (
          <BusinessSetupStep
            initialData={state.business}
            onNext={onStep1Next}
          />
        )}

        {state.step === 2 && (
          <ChannelConnectStep
            connectedChannels={state.connectedChannels}
            pages={state.pages}
            onConnectChannel={onConnectChannel}
            onTogglePage={onTogglePage}
            onDisconnectPage={onDisconnectPage}
            onNext={onNextToStep3}
            onBack={onBackToStep1}
          />
        )}

        {state.step === 3 && (
          <TeamInviteStep
            business={state.business}
            pages={state.pages}
            invites={state.invites}
            onAddInvite={onAddInvite}
            onRemoveInvite={onRemoveInvite}
            onFinish={onFinish}
            onBack={onBackToStep2}
          />
        )}
      </div>
    </div>
  );
};
