import { useState, useCallback, useEffect } from 'react';
import type { ManagedStaffItem } from '../workspaceConfig.types.js';
import { USER_ROLES } from '../../auth/userRole.types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { apiClient } from '../../../lib/api-client/index.js';

export interface UseWorkspaceStaffManagementProps {
  effectiveOwnerId: string;
  staffId?: string;
  isCurrentWorkspaceOwner: boolean;
  activeWorkspaceId: string;
  configWorkspaceId: string;
  onStaffChange?: () => Promise<any> | void;
}

export const useWorkspaceStaffManagement = ({
  effectiveOwnerId,
  staffId,
  isCurrentWorkspaceOwner,
  activeWorkspaceId,
  configWorkspaceId,
  onStaffChange,
}: UseWorkspaceStaffManagementProps) => {
  const [staffMembers, setStaffMembers] = useState<ManagedStaffItem[]>([]);

  const fetchStaffList = useCallback(
    async (targetWsId?: string): Promise<ManagedStaffItem[]> => {
      const wsToFetch = targetWsId || activeWorkspaceId || configWorkspaceId || '';
      try {
        const data = await apiClient.get<ManagedStaffItem[]>('/workspaces/current/staff', {
          headers: {
            'x-owner-id': effectiveOwnerId,
            'x-staff-id': staffId || '',
            'x-user-role': isCurrentWorkspaceOwner ? USER_ROLES.OWNER : USER_ROLES.STAFF,
            'x-workspace-id': wsToFetch,
          },
        });
        if (Array.isArray(data)) {
          setStaffMembers(data);
          return data;
        }
      } catch (err) {
        console.warn('Could not fetch staff from backend:', err);
      }
      return [];
    },
    [effectiveOwnerId, staffId, isCurrentWorkspaceOwner, activeWorkspaceId, configWorkspaceId]
  );

  useEffect(() => {
    if (isCurrentWorkspaceOwner) {
      fetchStaffList();
    }
  }, [isCurrentWorkspaceOwner, fetchStaffList]);

  const createStaffMember = async (
    data: { email: string; fullName: string; phoneNumber?: string; password?: string; role?: typeof USER_ROLES.STAFF | typeof USER_ROLES.OWNER },
    targetWsId?: string
  ) => {
    const wsId = targetWsId || activeWorkspaceId || configWorkspaceId || '';
    try {
      const created = await apiClient.post<ManagedStaffItem>('/workspaces/current/staff', data, {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': USER_ROLES.OWNER,
          'x-workspace-id': wsId,
        },
      });

      setStaffMembers((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      notify.success(`Đã thêm nhân viên "${created.fullName}" (${created.email}) vào Workspace!`);
    } catch (err) {
      notify.error((err as Error).message, 'Mời Nhân Viên Thất Bại');
      throw err;
    }
  };

  const updateStaffMember = async (
    targetId: string,
    data: { fullName?: string; password?: string; role?: typeof USER_ROLES.STAFF | typeof USER_ROLES.OWNER },
    targetWsId?: string
  ) => {
    const wsId = targetWsId || activeWorkspaceId || configWorkspaceId || '';
    try {
      const updated = await apiClient.put<ManagedStaffItem>(`/workspaces/current/staff/${targetId}`, data, {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': USER_ROLES.OWNER,
          'x-workspace-id': wsId,
        },
      });

      setStaffMembers((prev) => prev.map((s) => (s.id === targetId ? updated : s)));
      notify.success(`Đã cập nhật thông tin nhân viên "${updated.fullName}"!`);
    } catch (err) {
      notify.error((err as Error).message, 'Cập Nhật Thất Bại');
      throw err;
    }
  };

  const toggleLockStaffMember = async (targetId: string, lock: boolean) => {
    try {
      const updated = await apiClient.patch<ManagedStaffItem>(`/workspaces/current/staff/${targetId}/lock`, { lock }, {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': USER_ROLES.OWNER,
          'x-workspace-id': activeWorkspaceId || configWorkspaceId || '',
        },
      });

      setStaffMembers((prev) => prev.map((s) => (s.id === targetId ? updated : s)));
      notify.info(
        lock ? `Đã khóa tài khoản "${updated.fullName}".` : `Đã mở khóa tài khoản "${updated.fullName}".`,
        'Trạng Thái Nhân Viên'
      );
    } catch (err) {
      notify.error((err as Error).message, 'Thao Tác Thất Bại');
      throw err;
    }
  };

  const deleteStaffMember = async (targetId: string, targetWsId?: string) => {
    const wsId = targetWsId || activeWorkspaceId || configWorkspaceId || '';
    try {
      await apiClient.delete(`/workspaces/current/staff/${targetId}`, {
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isCurrentWorkspaceOwner ? USER_ROLES.OWNER : USER_ROLES.STAFF,
          'x-workspace-id': wsId,
        },
      });

      setStaffMembers((prev) => prev.filter((s) => s.id !== targetId));
      if (onStaffChange) {
        await onStaffChange();
      }
      notify.success('Thao tác thành công!');
    } catch (err) {
      notify.error((err as Error).message, 'Thao Tác Thất Bại');
      throw err;
    }
  };

  return {
    staffMembers,
    setStaffMembers,
    fetchStaffList,
    createStaffMember,
    updateStaffMember,
    toggleLockStaffMember,
    deleteStaffMember,
  };
};
