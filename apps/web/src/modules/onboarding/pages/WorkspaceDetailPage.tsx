import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from '../../../components/ui/index.js';
import { useWorkspaceConfig, type WorkspaceItem } from '../../workspace/WorkspaceConfigContext.js';
import type { ChannelKey, DiscoveredPageDto } from '../types.js';
import { OAuthSimulationModal } from '../components/OAuthSimulationModal.js';
import {
  WorkspaceOverviewTab,
  WorkspaceChannelsTab,
  WorkspaceMembersTab,
  type ConnectedChannelItem,
} from '../components/workspace/tabs/index.js';
import { EditWorkspaceModal, DeleteWorkspaceModal } from '../components/workspace/tabs/modals/index.js';
import { WorkspaceDetailHeader } from '../components/workspace/WorkspaceDetailHeader.js';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { useUserRole } from '../../auth/index.js';
import { StaffRole } from '../../../features/auth/constants/auth.constants.js';

export interface WorkspaceDetailPageProps {
  workspace: WorkspaceItem;
  isActive: boolean;
  onBack: () => void;
  onSelectWorkspace: (workspaceId: string) => Promise<void> | void;
  onGoToInbox: (workspaceId: string) => void;
}

/**
 * Trang chi tiết Không gian làm việc (Workspace Detail Page)
 * Bao gồm Header điều hướng và 3 Tab: Tổng quan, Kênh kết nối, Thành viên
 */
export const WorkspaceDetailPage: React.FC<WorkspaceDetailPageProps> = ({
  workspace,
  isActive,
  onBack,
  onSelectWorkspace,
  onGoToInbox,
}) => {
  const { staffId, staffName, staffEmail, ownerId, isOwner } = useUserRole();
  const effectiveOwnerId = ownerId || (isOwner ? staffId : '');
  const {
    staffMembers,
    fetchStaffList,
    createStaffMember,
    deleteStaffMember,
    updateWorkspaceInfo,
    deleteWorkspace,
    myWorkspaces,
  } = useWorkspaceConfig();

  // Tab điều hướng dùng component Tabs hệ thống
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'members'>('overview');

  // Modal Sửa & Xóa Workspace
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Danh sách kênh kết nối
  const [channels, setChannels] = useState<ConnectedChannelItem[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(null);

  // Modal kết nối kênh mới
  const [modalChannel, setModalChannel] = useState<ChannelKey | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Thống kê số lượng khách hàng thực tế
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  // Tải danh sách kênh kết nối của Workspace
  const loadChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    try {
      const res = await apiClient.getChannels(workspace.id, effectiveOwnerId);
      if (Array.isArray(res)) {
        setChannels(res as unknown as ConnectedChannelItem[]);
      } else {
        setChannels([]);
      }
    } catch {
      setChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [workspace.id, effectiveOwnerId]);

  // Tải số lượng khách hàng liên hệ thực tế của Không gian làm việc
  const loadContactsCount = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const res = await apiClient.getCustomers({ workspaceId: workspace.id });
      if (res && typeof res.total === 'number') {
        setContactsCount(res.total);
      } else if (res && Array.isArray(res.items)) {
        setContactsCount(res.items.length);
      } else {
        setContactsCount(0);
      }
    } catch {
      setContactsCount(0);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    loadContactsCount();
  }, [loadContactsCount]);

  useEffect(() => {
    fetchStaffList(workspace.id);
  }, [fetchStaffList, workspace.id]);

  // Đồng bộ tin nhắn kênh
  const handleSyncChannel = async (channelId: string) => {
    setSyncingChannelId(channelId);
    try {
      const res = await apiClient.syncChannel(channelId, workspace.id);
      notify.success(
        `Đã đồng bộ ${res.syncedCount || 0} tin nhắn & ${res.conversationsCount || 0} cuộc hội thoại cho trang ${res.pageName || ''}!`,
        'Đồng bộ thành công',
      );
    } catch (err) {
      notify.error(`Lỗi đồng bộ: ${(err as Error).message}`);
    } finally {
      setSyncingChannelId(null);
    }
  };

  // Bật / tắt hoạt động của kênh
  const handleToggleChannel = async (channelId: string, currentActive: boolean) => {
    setTogglingChannelId(channelId);
    try {
      await apiClient.toggleChannel(channelId, !currentActive, workspace.id);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, isActive: !currentActive } : c)),
      );
      notify.info(`Đã ${!currentActive ? 'kích hoạt' : 'tạm dừng'} kênh kết nối.`);
    } catch (err) {
      notify.error(`Không thể thay đổi trạng thái kênh: ${(err as Error).message}`);
    } finally {
      setTogglingChannelId(null);
    }
  };

  // Ngắt kết nối kênh
  const handleDisconnectChannel = async (channelId: string, channelName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ngắt kết nối kênh "${channelName}" khỏi Không gian làm việc này?`)) {
      return;
    }

    try {
      await apiClient.disconnectChannel(channelId, workspace.id);
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      notify.success(`Đã ngắt kết nối kênh "${channelName}".`);
    } catch (err) {
      notify.error(`Không thể ngắt kết nối: ${(err as Error).message}`);
    }
  };

  // Xử lý khi kết nối kênh thành công từ modal OAuth
  const handleConnectSuccess = async (channelKey: ChannelKey, pages?: DiscoveredPageDto[]) => {
    if (!pages || pages.length === 0) return;

    const pagesToActivate = pages.map((dp) => ({
      channel: dp.channel || channelKey,
      externalAccountId: dp.externalAccountId || dp.id,
      displayName: dp.name,
      avatarUrl: dp.avatarUrl || '',
      category: dp.category || `Kênh ${channelKey}`,
      accessToken: dp.accessToken,
      metadata: (dp as any).metadata || {},
    }));

    try {
      await apiClient.activateChannels(pagesToActivate, workspace.id, effectiveOwnerId);
      notify.success(`Đã kích hoạt thành công kênh vào Không gian làm việc "${workspace.name}"!`);
      await loadChannels();
    } catch (err) {
      notify.error(`Lỗi kích hoạt kênh: ${(err as Error).message}`);
    } finally {
      setIsConnectModalOpen(false);
      setModalChannel(null);
    }
  };

  // Danh sách thành viên đầy đủ: không gán cứng, loại trừ trùng lặp
  const baseStaffList = [
    ...(staffMembers.some((s) => s.role === StaffRole.OWNER || (workspace.ownerId && s.id === workspace.ownerId))
      ? []
      : workspace.ownerId
      ? [
          {
            id: workspace.ownerId,
            fullName:
              (workspace.ownerName && workspace.ownerName !== 'Chính bạn')
                ? workspace.ownerName
                : (staffName || 'Chủ sở hữu'),
            email: (workspace.isOwner ? staffEmail : '') || '',
            role: StaffRole.OWNER,
            status: 'ACTIVE' as const,
            ownerId: null,
            lockedAt: null,
            createdAt: workspace.createdAt || new Date().toISOString(),
            updatedAt: workspace.createdAt || new Date().toISOString(),
          },
        ]
      : []),
    ...staffMembers,
  ];

  // Khử trùng lặp theo ID
  const effectiveStaffList = baseStaffList.filter(
    (item, index, self) => index === self.findIndex((m) => m.id === item.id),
  );

  // Tìm thông tin Owner thực tế từ danh sách nhân viên
  const ownerStaff = effectiveStaffList.find(
    (s) => (workspace.ownerId && s.id === workspace.ownerId) || s.role === StaffRole.OWNER,
  );
  const resolvedAdminName =
    ownerStaff?.fullName ||
    (workspace.ownerName && workspace.ownerName !== 'Chính bạn' ? workspace.ownerName : '') ||
    (workspace.isOwner ? staffName : '') ||
    staffName ||
    'Chủ sở hữu';

  // Quy tắc nghiệp vụ: 1 workspace ít nhất 1 owner, nếu có >= 2 owner cho phép rời workspace
  const totalOwners = effectiveStaffList.filter((m) => m.role === StaffRole.OWNER).length;
  const canOwnerLeave = totalOwners >= 2;

  // Xóa / Loại bỏ thành viên khỏi Không gian làm việc
  const handleRemoveMember = async (memberId: string, memberName: string, memberRole?: string) => {
    const isTargetOwner = memberRole === StaffRole.OWNER;
    if (isTargetOwner && !canOwnerLeave) {
      notify.error('Không thể loại bỏ Chủ sở hữu. Không gian làm việc phải có ít nhất 1 Chủ sở hữu.');
      return;
    }

    const confirmMsg = isTargetOwner
      ? `Bạn có chắc chắn muốn loại bỏ Chủ sở hữu "${memberName}" khỏi Không gian làm việc này?`
      : `Bạn có chắc chắn muốn xóa thành viên "${memberName}" khỏi Không gian làm việc này?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteStaffMember(memberId, workspace.id);
      notify.success(`Đã loại bỏ "${memberName}" khỏi Không gian làm việc.`);
      await fetchStaffList(workspace.id);
    } catch (err) {
      notify.error(`Lỗi thao tác: ${(err as Error).message}`);
    }
  };

  // Rời khỏi Không gian làm việc
  const handleLeaveWorkspace = async () => {
    if (workspace.isOwner && !canOwnerLeave) {
      notify.error('Không gian làm việc phải có ít nhất 1 Chủ sở hữu. Không thể rời.');
      return;
    }

    const confirmMsg = workspace.isOwner
      ? `Bạn có chắc chắn muốn rời khỏi Không gian làm việc "${workspace.name}"? Quyền quản trị chính sẽ được bàn giao cho Chủ sở hữu còn lại.`
      : `Bạn có chắc chắn muốn rời khỏi Không gian làm việc "${workspace.name}"?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const currentMember = effectiveStaffList.find(
        (m) =>
          (m.id && m.id === staffId) ||
          (m.email && staffEmail && m.email.toLowerCase() === staffEmail.toLowerCase()) ||
          (workspace.isOwner && m.id === (workspace.ownerId || 'primary-owner')),
      );
      const targetId = currentMember?.id || staffId;
      await deleteStaffMember(targetId, workspace.id);
      notify.success(`Bạn đã rời khỏi Không gian làm việc "${workspace.name}".`);
      onBack();
    } catch (err) {
      notify.error(`Lỗi khi rời không gian làm việc: ${(err as Error).message}`);
    }
  };

  // Mời thành viên mới
  const handleInviteMember = async (email: string, fullName: string, role: StaffRole, phoneNumber?: string) => {
    try {
      await createStaffMember(
        {
          email,
          fullName: fullName || email.split('@')[0],
          phoneNumber,
          role,
        },
        workspace.id,
      );
      notify.success(`Đã mời thành viên ${email} vào Không gian làm việc!`);
      await fetchStaffList(workspace.id);
    } catch (err) {
      notify.error(`Lỗi mời thành viên: ${(err as Error).message}`);
      throw err;
    }
  };

  const handleSaveWorkspaceInfo = async (wsId: string, data: { name: string; domain: string }) => {
    await updateWorkspaceInfo(wsId, data);
  };

  const handleDeleteWorkspace = async (wsId: string) => {
    await deleteWorkspace(wsId);
    onBack();
  };

  const getDomainLabel = (domain?: string) => {
    const d = (domain || '').toUpperCase();
    if (d.includes('EDUCATION') || d.includes('GIÁO DỤC')) {
      return 'Giáo dục & Tuyển sinh';
    }
    if (d.includes('RETAIL') || d.includes('BÁN LẺ')) {
      return 'Bán lẻ & Thương mại';
    }
    return domain || 'Dịch vụ & Doanh nghiệp';
  };

  const domainLabel = getDomainLabel(workspace.domain);

  return (
    <div className="workspace-flat-detail w-full max-w-[1140px] mx-auto px-4 sm:px-6 md:px-8 py-2 pb-16 bg-white">
      {/* 1. Header chi tiết Workspace & Dãy nút thao tác (Tách component) */}
      <div className="pb-6 border-b border-slate-200">
        <WorkspaceDetailHeader
          workspace={workspace}
          isActive={isActive}
          domainLabel={domainLabel}
          canOwnerLeave={canOwnerLeave}
          onBack={onBack}
          onSelectWorkspace={onSelectWorkspace}
          onGoToInbox={onGoToInbox}
          onLeaveWorkspace={handleLeaveWorkspace}
          onEditWorkspace={() => setIsEditModalOpen(true)}
          onSaveWorkspaceName={async (newName) => {
            await handleSaveWorkspaceInfo(workspace.id, {
              name: newName,
              domain: workspace.domain,
            });
          }}
          onDeleteWorkspace={myWorkspaces.length > 1 ? () => setIsDeleteModalOpen(true) : undefined}
        />

        {/* 2. Thanh Tabs hệ thống chuẩn */}
        <Tabs<'overview' | 'channels' | 'members'>
          className="mt-6 -mb-6"
          items={[
            { id: 'overview', label: 'Tổng quan' },
            { id: 'channels', label: 'Kênh kết nối', count: channels.length },
            { id: 'members', label: 'Thành viên', count: effectiveStaffList.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* 3. Tab 1: Tổng quan */}
      {activeTab === 'overview' && (
        <WorkspaceOverviewTab
          workspace={workspace}
          domainLabel={domainLabel}
          membersCount={effectiveStaffList.length}
          channelsCount={channels.length}
          contactsCount={contactsCount}
          isLoadingContacts={isLoadingContacts}
          adminName={resolvedAdminName}
          onEditWorkspace={() => setIsEditModalOpen(true)}
          onSaveWorkspaceName={async (newName) => {
            await handleSaveWorkspaceInfo(workspace.id, {
              name: newName,
              domain: workspace.domain,
            });
          }}
          onDeleteWorkspace={myWorkspaces.length > 1 ? () => setIsDeleteModalOpen(true) : undefined}
        />
      )}

      {/* 4. Tab 2: Kênh kết nối */}
      {activeTab === 'channels' && (
        <WorkspaceChannelsTab
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          isOwner={Boolean(workspace.isOwner)}
          channels={channels}
          isLoading={isLoadingChannels}
          syncingChannelId={syncingChannelId}
          togglingChannelId={togglingChannelId}
          onSyncChannel={handleSyncChannel}
          onToggleChannel={handleToggleChannel}
          onDisconnectChannel={handleDisconnectChannel}
          onOpenConnectModal={(chKey) => {
            setModalChannel(chKey);
            setIsConnectModalOpen(true);
          }}
        />
      )}

      {/* 5. Tab 3: Thành viên */}
      {activeTab === 'members' && (
        <WorkspaceMembersTab
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          isOwner={Boolean(workspace.isOwner)}
          currentStaffId={staffId}
          currentStaffEmail={staffEmail}
          staffMembers={effectiveStaffList}
          onRemoveMember={handleRemoveMember}
          onLeaveWorkspace={handleLeaveWorkspace}
          onInviteMember={handleInviteMember}
        />
      )}

      {/* Modal kết nối kênh OAuth */}
      {modalChannel && (
        <OAuthSimulationModal
          channel={modalChannel}
          isOpen={isConnectModalOpen}
          onClose={() => {
            setIsConnectModalOpen(false);
            setModalChannel(null);
          }}
          onSuccess={handleConnectSuccess}
        />
      )}

      {/* Modal chỉnh sửa thông tin Không gian làm việc */}
      <EditWorkspaceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        workspace={workspace}
        onSave={handleSaveWorkspaceInfo}
      />

      {/* Modal xóa Không gian làm việc */}
      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        workspace={workspace}
        onConfirm={handleDeleteWorkspace}
      />
    </div>
  );
};

// Alias for backwards compatibility
export const WorkspaceDetailView = WorkspaceDetailPage;
export type { WorkspaceDetailPageProps as WorkspaceDetailViewProps };
