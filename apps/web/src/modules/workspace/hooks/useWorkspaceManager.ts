import React, { useState, useCallback, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceConfig, BusinessDomain } from '../workspaceConfig.types.js';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

export const ACTIVE_WORKSPACE_KEY = 'polarisx_crm_active_workspace_id';

export interface UseWorkspaceManagerProps {
  staffId?: string;
  staffName?: string;
  effectiveOwnerId: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  syncFromBackend: (targetWsId?: string) => Promise<void>;
  fetchStaffList: (targetWsId?: string) => Promise<any>;
  setConfig: React.Dispatch<React.SetStateAction<WorkspaceConfig>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useWorkspaceManager = ({
  staffId,
  staffName,
  effectiveOwnerId,
  isAuthenticated,
  isOwner,
  syncFromBackend,
  fetchStaffList,
  setConfig,
  setIsLoading,
}: UseWorkspaceManagerProps) => {
  const [myWorkspaces, setMyWorkspaces] = useState<WorkspaceItem[]>([]);

  // Lấy workspace ID đang active từ localStorage hoặc khởi tạo
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_WORKSPACE_KEY) || '';
    }
    return '';
  });

  // Tìm workspace hiện tại trong danh sách
  const activeWorkspace = myWorkspaces.find((w) => w.id === activeWorkspaceId) || null;
  // Quyền OWNER trong workspace hiện tại
  const isCurrentWorkspaceOwner = activeWorkspace ? activeWorkspace.isOwner : isOwner;

  // Lấy danh sách Workspaces của user từ Backend
  const fetchMyWorkspaces = useCallback(async (): Promise<WorkspaceItem[]> => {
    if (!isAuthenticated) return [];
    try {
      const list = await apiClient.getMyWorkspaces(staffId, effectiveOwnerId);
      if (Array.isArray(list) && list.length > 0) {
        // Chuẩn hóa ownerName: Ưu tiên fullName thực tế, loại bỏ hoàn toàn 'Chính bạn'
        const normalized = list.map((ws) => ({
          ...ws,
          ownerName:
            ws.ownerName && ws.ownerName !== 'Chính bạn' && ws.ownerName !== 'Chủ sở hữu'
              ? ws.ownerName
              : (ws.isOwner && staffName ? staffName : (ws.ownerName && ws.ownerName !== 'Chính bạn' ? ws.ownerName : staffName || 'Chủ sở hữu')),
        }));
        setMyWorkspaces(normalized);

        // Nếu chưa chọn active workspace hoặc workspace hiện tại không nằm trong danh sách, chọn cái đầu tiên
        const currentActive = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const match = normalized.find((w) => w.id === currentActive);
        const selectedId = match ? match.id : normalized[0].id;

        setActiveWorkspaceId(selectedId);
        apiClient.setActiveWorkspaceId(selectedId);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, selectedId);
        return normalized;
      }
    } catch (err) {
      console.warn('Could not fetch workspaces:', err);
    }
    return [];
  }, [isAuthenticated, staffId, effectiveOwnerId, staffName]);

  useEffect(() => {
    fetchMyWorkspaces();
  }, [fetchMyWorkspaces]);

  // Chuyển đổi nhanh giữa các Workspace (Workspace Switcher)
  const switchWorkspace = async (targetWsId: string) => {
    if (targetWsId === activeWorkspaceId) return;

    const targetWs = myWorkspaces.find((w) => w.id === targetWsId);
    setActiveWorkspaceId(targetWsId);
    apiClient.setActiveWorkspaceId(targetWsId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, targetWsId);

    setIsLoading(true);
    try {
      await Promise.all([
        syncFromBackend(targetWsId),
        fetchStaffList(targetWsId),
      ]);
      notify.success(
        `Đã chuyển sang không gian làm việc "${targetWs?.name || 'Workspace'}" (${targetWs?.isOwner ? 'Chủ sở hữu' : 'Thành viên'})!`,
        'Đổi Workspace'
      );
    } catch (err) {
      console.error('Switch workspace failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Tạo một Không gian làm việc (Workspace) mới và chuyển sang workspace đó
   */
  const createWorkspace = async (data: {
    name: string;
    domain?: BusinessDomain | string;
  }): Promise<WorkspaceItem | null> => {
    setIsLoading(true);
    try {
      const res = await apiClient.createWorkspace(
        {
          name: data.name,
          domain: data.domain,
        },
        staffId,
        effectiveOwnerId,
      );

      if (res && res.id) {
        const updatedList = await fetchMyWorkspaces();
        setActiveWorkspaceId(res.id);
        apiClient.setActiveWorkspaceId(res.id);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, res.id);
        await Promise.all([
          syncFromBackend(res.id),
          fetchStaffList(res.id),
        ]);
        notify.success(`Đã tạo Không gian làm việc "${res.name}" thành công!`, 'Tạo Workspace');
        return (
          updatedList.find((w) => w.id === res.id) || {
            id: res.id,
            name: res.name,
            slug: res.slug,
            role: 'OWNER',
            isOwner: true,
            domain: res.domain || 'EDUCATION',
            ownerId: res.ownerId || effectiveOwnerId,
            ownerName: res.ownerName || staffName || 'Chủ sở hữu',
            createdAt: res.createdAt,
          }
        );
      }
    } catch (err) {
      notify.error(`Không thể tạo Không gian làm việc: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  /**
   * Cập nhật thông tin Không gian làm việc (Tên, Lĩnh vực)
   */
  const updateWorkspaceInfo = async (
    targetWsId: string,
    data: { name?: string; domain?: string },
  ): Promise<WorkspaceItem> => {
    setIsLoading(true);
    try {
      const updated = await apiClient.updateWorkspace(
        targetWsId,
        data,
        staffId,
        effectiveOwnerId,
      );

      setMyWorkspaces((prev) =>
        prev.map((w) => (w.id === targetWsId ? { ...w, ...updated } : w)),
      );

      if (activeWorkspaceId === targetWsId && updated.name) {
        setConfig((prev) => ({
          ...prev,
          workspaceName: updated.name,
          ...(data.domain ? { domain: data.domain as BusinessDomain } : {}),
        }));
      }

      notify.success(`Đã cập nhật thông tin không gian làm việc "${updated.name}"!`, 'Cập Nhật Workspace');
      return updated;
    } catch (err) {
      notify.error(`Không thể cập nhật Không gian làm việc: ${(err as Error).message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Xóa Không gian làm việc
   */
  const deleteWorkspace = async (targetWsId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await apiClient.deleteWorkspace(targetWsId, staffId, effectiveOwnerId);
      notify.success('Đã xóa Không gian làm việc thành công!', 'Xóa Workspace');

      const updatedList = await fetchMyWorkspaces();
      if (activeWorkspaceId === targetWsId && updatedList.length > 0) {
        await switchWorkspace(updatedList[0].id);
      }
    } catch (err) {
      notify.error(`Không thể xóa Không gian làm việc: ${(err as Error).message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    myWorkspaces,
    setMyWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    isCurrentWorkspaceOwner,
    fetchMyWorkspaces,
    switchWorkspace,
    createWorkspace,
    updateWorkspaceInfo,
    deleteWorkspace,
  };
};
