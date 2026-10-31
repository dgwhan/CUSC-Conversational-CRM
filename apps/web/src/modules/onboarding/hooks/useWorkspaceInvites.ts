import { useEffect } from 'react';
import type { StaffInvite, OnboardingState } from '../types.js';
import { StaffRole } from '../../../features/auth/constants/auth.constants.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import type { ManagedStaffItem } from '../../workspace/WorkspaceConfigContext.js';

export interface UseWorkspaceInvitesOptions {
  workspaceId: string;
  staffId: string;
  effectiveOwnerId: string;
  isOwner: boolean;
  isEnabled: boolean;
  staffMembers: ManagedStaffItem[];
  fetchStaffList: (targetWsId?: string) => Promise<ManagedStaffItem[]>;
  createStaffMember: (
    data: { email: string; fullName: string; phoneNumber?: string; password?: string; role?: 'STAFF' | 'OWNER' },
    targetWsId?: string,
  ) => Promise<void>;
  deleteStaffMember: (staffId: string, targetWsId?: string) => Promise<void>;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
}

/**
 * Hook chuyên biệt quản lý danh sách và lời mời nhân sự vào Không gian làm việc.
 * Sử dụng đúng 2 vai trò chính thức trong hệ thống: StaffRole.OWNER và StaffRole.STAFF.
 */
export const useWorkspaceInvites = ({
  workspaceId,
  staffId,
  effectiveOwnerId,
  isOwner,
  isEnabled,
  staffMembers,
  fetchStaffList,
  createStaffMember,
  deleteStaffMember,
  setState,
}: UseWorkspaceInvitesOptions) => {
  // Tự động tải danh sách nhân viên thực tế đã có trong Workspace
  useEffect(() => {
    if (isOwner && isEnabled && workspaceId) {
      fetchStaffList(workspaceId);
    }
  }, [isOwner, fetchStaffList, isEnabled, workspaceId]);

  // Đồng bộ danh sách nhân viên thuộc Workspace vào Bước 3 Onboarding (sử dụng 2 vai trò chuẩn: OWNER & STAFF)
  useEffect(() => {
    if (staffMembers && staffMembers.length > 0) {
      const activeInvites: StaffInvite[] = staffMembers
        .filter((s) => s.id !== staffId && s.id !== effectiveOwnerId)
        .map((s) => ({
          id: s.id,
          email: s.email,
          role: s.role === StaffRole.OWNER ? StaffRole.OWNER : StaffRole.STAFF,
          fullName: s.fullName,
          status: s.status,
        }));

      setState((prev) => ({
        ...prev,
        invites: activeInvites,
      }));
    }
  }, [staffMembers, staffId, effectiveOwnerId, setState]);

  /**
   * Mời nhân viên mới vào Workspace theo vai trò chuẩn (OWNER hoặc STAFF)
   */
  const handleAddInvite = async (email: string, role: StaffRole) => {
    const defaultName = email.split('@')[0];
    await createStaffMember({
      email,
      fullName: defaultName,
      role: role === StaffRole.OWNER ? StaffRole.OWNER : StaffRole.STAFF,
    });
    await fetchStaffList(workspaceId);
  };

  /**
   * Gỡ nhân viên khỏi Workspace
   */
  const handleRemoveInvite = async (id: string) => {
    try {
      await deleteStaffMember(id);
      await fetchStaffList(workspaceId);
      notify.success('Đã loại nhân viên khỏi Workspace.');
    } catch {
      // Thông báo lỗi đã được xử lý trong deleteStaffMember
    }
  };

  return {
    handleAddInvite,
    handleRemoveInvite,
  };
};
