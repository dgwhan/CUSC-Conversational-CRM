import React from 'react';
import type { OnboardingState } from '../types.js';
import { WorkspaceListPage } from './WorkspaceListPage.js';
import { WorkspaceDetailPage } from './WorkspaceDetailPage.js';
import { WorkspaceWizardView } from '../components/workspace/WorkspaceWizardView.js';
import { useOnboardingWizard } from '../hooks/useOnboardingWizard.js';

export interface OnboardingWizardPageProps {
  onComplete: (data: OnboardingState) => void;
  onSkipToInbox?: () => void;
}

/**
 * Trang điều phối Onboarding và Quản lý Không gian làm việc
 * Điều hướng giữa 3 chế độ xem:
 * 1. 'list': Danh sách Workspace
 * 2. 'detail': Chi tiết Workspace & cấu hình kênh / thành viên
 * 3. 'wizard': 3 bước tạo mới / cấu hình Workspace
 */
export const OnboardingWizardPage: React.FC<OnboardingWizardPageProps> = ({
  onComplete,
  onSkipToInbox,
}) => {
  const wizard = useOnboardingWizard({
    onComplete,
    onSkipToInbox,
  });

  // =========================================================================
  // GIAO DIỆN 1: TRANG DANH SÁCH WORKSPACE (WorkspaceListPage)
  // =========================================================================
  if (wizard.viewMode === 'list') {
    return (
      <div className="onboarding-page-container">
        <WorkspaceListPage
        workspaces={wizard.myWorkspaces}
        activeWorkspaceId={wizard.activeWorkspaceId}
        isLoading={wizard.isConfigLoading}
        onSelectWorkspace={wizard.switchWorkspace}
        onViewDetail={wizard.handleViewDetail}
        onConfigureWorkspace={wizard.handleConfigureWorkspace}
        onCreateNewWorkspace={wizard.handleCreateNewWorkspace}
        />
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN 2: TRANG CHI TIẾT WORKSPACE & CÁC KÊNH (WorkspaceDetailPage)
  // =========================================================================
  if (wizard.viewMode === 'detail' && wizard.selectedDetailWorkspace) {
    return (
      <div className="onboarding-page-container">
        <WorkspaceDetailPage
          workspace={wizard.selectedDetailWorkspace}
          isActive={wizard.selectedDetailWorkspace.id === wizard.activeWorkspaceId}
          onBack={wizard.handleBackToList}
          onSelectWorkspace={wizard.handleSelectWorkspaceInDetail}
          onGoToInbox={wizard.handleGoToInboxFromDetail}
        />
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN 3: 3 BƯỚC THIẾT LẬP TẠO MỚI (WIZARD)
  // =========================================================================
  return (
    <WorkspaceWizardView
      state={wizard.state}
      isCreatingNewWorkspace={wizard.isCreatingNewWorkspace}
      activeConfiguringWs={wizard.activeConfiguringWs}
      isCheckingChannels={wizard.isCheckingChannels}
      onBackToList={wizard.handleBackToList}
      onSkipToInbox={onSkipToInbox}
      onStepClick={wizard.handleStepClick}
      onStep1Next={wizard.handleStep1Next}
      onConnectChannel={wizard.handleConnectChannel}
      onTogglePage={wizard.handleTogglePage}
      onDisconnectPage={wizard.handleDisconnectPage}
      onNextToStep3={() => wizard.setState((prev) => ({ ...prev, step: 3 }))}
      onBackToStep1={() => wizard.setState((prev) => ({ ...prev, step: 1 }))}
      onBackToStep2={() => wizard.setState((prev) => ({ ...prev, step: 2 }))}
      onAddInvite={wizard.handleAddInvite}
      onRemoveInvite={wizard.handleRemoveInvite}
      onFinish={wizard.handleComplete}
    />
  );
};
