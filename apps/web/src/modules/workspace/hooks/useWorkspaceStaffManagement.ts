import { useState, useCallback, useEffect } from 'react';
import type { ManagedStaffItem } from '../workspaceConfig.types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

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
        const res = await fetch('/api/workspaces/current/staff', {
          headers: {
            'x-owner-id': effectiveOwnerId,
            'x-staff-id': staffId || '',
            'x-user-role': isCurrentWorkspaceOwner ? 'OWNER' : 'STAFF',
            'x-workspace-id': wsToFetch,
          },
        });
        if (res.ok) {
          const data = await res.json();
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
    data: { email: string; fullName: string; phoneNumber?: string; password?: string; role?: 'STAFF' | 'OWNER' },
    targetWsId?: string
  ) => {
    const wsId = targetWsId || activeWorkspaceId || configWorkspaceId || '';
    try {
      const res = await fetch('/api/workspaces/current/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
          'x-workspace-id': wsId,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi mời nhân viên');
      }

      const created = await res.json();
      setStaffMembers((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      notify.success(`Đã thêm nhân viên "${created.fullName}" (${created.email}) vào Workspace!`);
    } catch (err) {
      notify.error((err as Error).message, 'Mời Nhân Viên Thất Bại');
      throw err;
    }
  };

  const updateStaffMember = async (
    targetId: string,
    data: { fullName?: string; password?: string; role?: 'STAFF' | 'OWNER' },
    targetWsId?: string
  ) => {
    const wsId = targetWsId || activeWorkspaceId || configWorkspaceId || '';
    try {
      const res = await fetch(`/api/workspaces/current/staff/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
          'x-workspace-id': wsId,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi cập nhật tài khoản');
      }

      const updated = await res.json();
      setStaffMembers((prev) => prev.map((s) => (s.id === targetId ? updated : s)));
      notify.success(`Đã cập nhật thông tin nhân viên "${updated.fullName}"!`);
    } catch (err) {
      notify.error((err as Error).message, 'Cập Nhật Thất Bại');
      throw err;
    }
  };

  const toggleLockStaffMember = async (targetId: string, lock: boolean) => {
    try {
      const res = await fetch(`/api/workspaces/current/staff/${targetId}/lock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': 'OWNER',
          'x-workspace-id': activeWorkspaceId || configWorkspaceId || '',
        },
        body: JSON.stringify({ lock }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi thay đổi trạng thái khóa');
      }

      const updated = await res.json();
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
      const res = await fetch(`/api/workspaces/current/staff/${targetId}`, {
        method: 'DELETE',
        headers: {
          'x-owner-id': effectiveOwnerId,
          'x-staff-id': staffId || '',
          'x-user-role': isCurrentWorkspaceOwner ? 'OWNER' : 'STAFF',
          'x-workspace-id': wsId,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi xóa hoặc rời thành viên');
      }

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
