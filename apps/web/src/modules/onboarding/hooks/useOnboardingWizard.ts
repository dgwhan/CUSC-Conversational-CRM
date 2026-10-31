import { useState } from 'react';
import type {
  OnboardingState,
  BusinessSetupData,
} from '../types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useWorkspaceConfig, type WorkspaceItem } from '../../workspace/WorkspaceConfigContext.js';
import { useUserRole } from '../../auth/index.js';
import { useWorkspaceChannels } from './useWorkspaceChannels.js';
import { useWorkspaceInvites } from './useWorkspaceInvites.js';

export interface UseOnboardingWizardOptions {
  onComplete: (data: OnboardingState) => void;
  onSkipToInbox?: () => void;
}

export type OnboardingViewMode = 'list' | 'detail' | 'wizard';

/**
 * Hook điều phối trung tâm cho toàn bộ luồng Onboarding và Thiết lập Không gian làm việc
 */
export const useOnboardingWizard = ({ onComplete }: UseOnboardingWizardOptions) => {
  const {
    config: workspaceConfig,
    staffMembers,
    fetchStaffList,
    createStaffMember,
    deleteStaffMember,
    myWorkspaces,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    updateWorkspaceInfo,
    updateConfig,
    isLoading: isConfigLoading,
  } = useWorkspaceConfig();

  const { staffId, ownerId, isOwner } = useUserRole();
  const effectiveOwnerId = ownerId || (isOwner ? staffId : '');
  const effectiveWorkspaceId = activeWorkspaceId || workspaceConfig.workspaceId;

  // Chế độ xem: 'list' (Danh sách Workspace), 'detail' (Chi tiết & kênh), 'wizard' (3 bước thiết lập)
  const [viewMode, setViewMode] = useState<OnboardingViewMode>('list');
  const [selectedDetailWorkspace, setSelectedDetailWorkspace] = useState<WorkspaceItem | null>(null);
  const [isCreatingNewWorkspace, setIsCreatingNewWorkspace] = useState(false);
  const [activeConfiguringWs, setActiveConfiguringWs] = useState<WorkspaceItem | null>(null);

  // Trạng thái biểu mẫu 3 bước Wizard
  const [state, setState] = useState<OnboardingState>(() => ({
    step: 1,
    business: {
      companyName: workspaceConfig.workspaceName || '',
      industry: workspaceConfig.domain || 'Giáo dục & Tuyển sinh',
    },
    connectedChannels: [],
    pages: [],
    invites: [],
  }));

  // 1. Quản lý trạng thái và thao tác kết nối Kênh MXH
  const {
    isCheckingChannels,
    handleConnectChannel,
    handleTogglePage: togglePageInternal,
    handleDisconnectPage: disconnectPageInternal,
  } = useWorkspaceChannels({
    workspaceId: effectiveWorkspaceId,
    ownerId: effectiveOwnerId,
    isEnabled: viewMode === 'wizard',
    setState,
  });

  const handleTogglePage = (pageId: string) => togglePageInternal(pageId, state.pages);
  const handleDisconnectPage = (pageId: string) => disconnectPageInternal(pageId, state.pages);

  // 2. Quản lý danh sách và lời mời Nhân viên (chỉ dùng 2 role chuẩn: OWNER & STAFF)
  const {
    handleAddInvite,
    handleRemoveInvite,
  } = useWorkspaceInvites({
    workspaceId: effectiveWorkspaceId,
    staffId,
    effectiveOwnerId,
    isOwner,
    isEnabled: viewMode === 'wizard',
    staffMembers,
    fetchStaffList,
    createStaffMember,
    deleteStaffMember,
    setState,
  });

  /**
   * Tạo Không gian làm việc mới từ danh sách
   */
  const handleCreateNewWorkspace = () => {
    setIsCreatingNewWorkspace(true);
    setActiveConfiguringWs(null);
    setState({
      step: 1,
      business: {
        companyName: '',
        industry: 'Giáo dục & Tuyển sinh',
      },
      connectedChannels: [],
      pages: [],
      invites: [],
    });
    setViewMode('wizard');
  };

  /**
   * Xem chi tiết 1 Workspace
   */
  const handleViewDetail = (ws: WorkspaceItem) => {
    setSelectedDetailWorkspace(ws);
    setViewMode('detail');
  };

  /**
   * Cấu hình 1 Workspace cụ thể
   */
  const handleConfigureWorkspace = async (ws: WorkspaceItem) => {
    setIsCreatingNewWorkspace(false);
    setActiveConfiguringWs(ws);
    await switchWorkspace(ws.id);

    setState((prev) => ({
      ...prev,
      step: 1,
      business: {
        companyName: ws.name || '',
        industry: ws.domain || 'Giáo dục & Tuyển sinh',
      },
    }));
    setViewMode('wizard');
  };

  /**
   * Bước 1: Lưu thông tin doanh nghiệp vào PostgreSQL
   */
  const handleStep1Next = async (businessData: BusinessSetupData) => {
    if (isCreatingNewWorkspace) {
      try {
        const created = await createWorkspace({
          name: businessData.companyName,
          domain: businessData.industry,
        });

        if (created) {
          setActiveConfiguringWs(created);
          setIsCreatingNewWorkspace(false);
          notify.success(`Đã tạo và lưu Không gian làm việc "${created.name}" vào cơ sở dữ liệu!`);
        }
      } catch (err) {
        notify.warning(`Đã lưu cấu hình cục bộ (${(err as Error).message})`);
      }
    } else {
      try {
        await updateConfig({
          workspaceName: businessData.companyName,
          domain: businessData.industry as any,
        });
        if (activeConfiguringWs?.id) {
          await updateWorkspaceInfo(activeConfiguringWs.id, {
            name: businessData.companyName,
            domain: businessData.industry,
          });
        }
        notify.success(`Đã cập nhật thông tin doanh nghiệp vào cơ sở dữ liệu!`);
      } catch (err) {
        notify.info(`Đã lưu cục bộ (${(err as Error).message})`);
      }
    }

    setState((prev) => ({ ...prev, business: businessData, step: 2 }));
  };

  /**
   * Hoàn tất Wizard và điều hướng vào Inbox
   */
  const handleComplete = async () => {
    notify.success(
      `Khởi tạo Workspace "${state.business.companyName || activeConfiguringWs?.name || 'CUSC Conversational CRM'}" hoàn tất! Đang chuyển hướng vào Hộp thư Trực tuyến...`,
      'Onboarding Thành công',
    );
    onComplete(state);
  };

  const handleBackToList = () => {
    setSelectedDetailWorkspace(null);
    setViewMode('list');
  };

  const handleSelectWorkspaceInDetail = async (wsId: string) => {
    await switchWorkspace(wsId);
    const updated = myWorkspaces.find((w) => w.id === wsId);
    if (updated) setSelectedDetailWorkspace(updated);
  };

  const handleGoToInboxFromDetail = async (wsId: string) => {
    await switchWorkspace(wsId);
    onComplete(state);
  };

  const handleStepClick = (num: number) => {
    setState((prev) => ({ ...prev, step: num as 1 | 2 | 3 }));
  };

  return {
    // Trạng thái view
    viewMode,
    setViewMode,
    selectedDetailWorkspace,
    isCreatingNewWorkspace,
    activeConfiguringWs,
    isCheckingChannels,
    state,
    setState,
    // Context State
    myWorkspaces,
    activeWorkspaceId,
    isConfigLoading,
    switchWorkspace,
    // Hành động
    handleCreateNewWorkspace,
    handleViewDetail,
    handleConfigureWorkspace,
    handleStep1Next,
    handleConnectChannel,
    handleTogglePage,
    handleDisconnectPage,
    handleAddInvite,
    handleRemoveInvite,
    handleComplete,
    handleBackToList,
    handleSelectWorkspaceInDetail,
    handleGoToInboxFromDetail,
    handleStepClick,
  };
};
