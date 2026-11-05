import type { BaseApiClient } from './core.js';
import type { NotificationItem, NotificationListResponse } from './types.js';

export function createWorkspaceApi(client: BaseApiClient) {
  return {
    getMyWorkspaces(staffId?: string, ownerId?: string) {
      return client.get<Array<{
        id: string;
        name: string;
        slug: string;
        role: 'OWNER' | 'STAFF';
        isOwner: boolean;
        domain: string;
        ownerId?: string;
        ownerName?: string;
        createdAt?: string;
      }>>('/workspaces/my-workspaces', {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        },
      });
    },

    createWorkspace(
      data: { name: string; domain?: string },
      staffId?: string,
      ownerId?: string,
    ) {
      return client.post<{
        id: string;
        name: string;
        slug: string;
        role: 'OWNER' | 'STAFF';
        isOwner: boolean;
        domain: string;
        ownerId?: string;
        ownerName?: string;
        createdAt?: string;
      }>('/workspaces', data, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    updateWorkspace(
      workspaceId: string,
      data: { name?: string; domain?: string },
      staffId?: string,
      ownerId?: string,
    ) {
      return client.patch<{
        id: string;
        name: string;
        slug: string;
        role: 'OWNER' | 'STAFF';
        isOwner: boolean;
        domain: string;
        ownerId?: string;
        ownerName?: string;
        createdAt?: string;
      }>(`/workspaces/${workspaceId}`, data, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    deleteWorkspace(workspaceId: string, staffId?: string, ownerId?: string) {
      return client.delete<{ success: boolean; message: string }>(`/workspaces/${workspaceId}`, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    getWorkspaceHotlines(workspaceId: string) {
      return client.get<Array<{
        id: string;
        workspaceId: string;
        phoneNumber: string;
        label: string;
        department: string;
        assignedStaffId?: string;
        assignedStaffName?: string;
        status: 'ACTIVE' | 'INACTIVE';
        workingHours?: string;
        isDefault?: boolean;
        notes?: string;
        createdAt: string;
        updatedAt: string;
      }>>(`/workspaces/${workspaceId}/hotlines`);
    },

    createWorkspaceHotline(
      workspaceId: string,
      data: {
        phoneNumber: string;
        label: string;
        department?: string;
        assignedStaffId?: string;
        assignedStaffName?: string;
        status?: 'ACTIVE' | 'INACTIVE';
        workingHours?: string;
        isDefault?: boolean;
        notes?: string;
      },
      staffId?: string,
      ownerId?: string,
    ) {
      return client.post<{
        id: string;
        workspaceId: string;
        phoneNumber: string;
        label: string;
        department: string;
        assignedStaffId?: string;
        assignedStaffName?: string;
        status: 'ACTIVE' | 'INACTIVE';
        workingHours?: string;
        isDefault?: boolean;
        notes?: string;
        createdAt: string;
        updatedAt: string;
      }>(`/workspaces/${workspaceId}/hotlines`, data, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    updateWorkspaceHotline(
      workspaceId: string,
      hotlineId: string,
      data: Record<string, unknown>,
      staffId?: string,
      ownerId?: string,
    ) {
      return client.patch<{
        id: string;
        workspaceId: string;
        phoneNumber: string;
        label: string;
        department: string;
        assignedStaffId?: string;
        assignedStaffName?: string;
        status: 'ACTIVE' | 'INACTIVE';
        workingHours?: string;
        isDefault?: boolean;
        notes?: string;
        createdAt: string;
        updatedAt: string;
      }>(`/workspaces/${workspaceId}/hotlines/${hotlineId}`, data, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    deleteWorkspaceHotline(workspaceId: string, hotlineId: string, staffId?: string, ownerId?: string) {
      return client.delete<{ success: boolean; message: string }>(`/workspaces/${workspaceId}/hotlines/${hotlineId}`, {
        headers: {
          ...(staffId ? { 'x-staff-id': staffId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
          'x-user-role': 'OWNER',
        },
      });
    },

    getNotifications(
      workspaceId: string,
      params?: { isRead?: boolean; page?: number; limit?: number; type?: string; severity?: string },
    ) {
      return client.get<NotificationListResponse>(`/v1/workspaces/${workspaceId}/notifications`, {
        params: params as Record<string, string | number | boolean | undefined>,
      });
    },

    markNotificationRead(workspaceId: string, id: string) {
      return client.patch<NotificationItem>(`/v1/workspaces/${workspaceId}/notifications/${id}/read`);
    },

    markAllNotificationsRead(workspaceId: string) {
      return client.post<{ count: number }>(`/v1/workspaces/${workspaceId}/notifications/read-all`);
    },

    deleteNotification(workspaceId: string, id: string) {
      return client.delete<{ success: boolean }>(`/v1/workspaces/${workspaceId}/notifications/${id}`);
    },
  };
}

