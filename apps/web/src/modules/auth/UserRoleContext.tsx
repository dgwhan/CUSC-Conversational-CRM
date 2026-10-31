import React, { createContext, useContext, useEffect, useState } from 'react';
import { notify } from '../../components/feedback/toastEmitter.js';
import type { LoginResponse } from '../../features/auth/types/auth.types.js';
import { apiClient } from '../../lib/api-client.js';
import { USER_ROLES } from './userRole.types.js';
import type { UserRole, UserRoleContextValue } from './userRole.types.js';

export { USER_ROLES };
export type { UserRole, UserRoleContextValue } from './userRole.types.js';

const SESSION_STORAGE_KEY = 'polarisx_crm_auth_session';

function clearAccountCache() {
  try {
    localStorage.removeItem('polarisx_crm_active_workspace_id');
    localStorage.removeItem('crm_inbox_conversations_v1');
    localStorage.removeItem('polarisx_crm_kanban_candidates');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('crm_inbox_conversations') ||
          k.startsWith('polarisx_crm_kanban_candidates') ||
          k.startsWith('polarisx_crm_workspace_config_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch { }
  apiClient.setActiveWorkspaceId('');
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lấy session đã lưu từ localStorage nếu có
  const [session, setSession] = useState<LoginResponse | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem('cusc_crm_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved) as LoginResponse;
        if (parsed?.accessToken) {
          apiClient.setAccessToken(parsed.accessToken);
        }
        return parsed;
      }
    } catch { }
    return null;
  });

  // Role được nạp từ truy vấn context Workspace (WorkspaceConfigContext), mặc định rỗng khi chưa vào workspace
  const [role, setRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('polarisx_crm_user_role') || '';
      if (saved === USER_ROLES.OWNER || saved === USER_ROLES.STAFF) return saved as UserRole;
    } catch { }
    return USER_ROLES.EMPTY;
  });

  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string>('');

  // Lắng nghe sự kiện token refresh và session expiration từ apiClient
  useEffect(() => {
    if (session?.accessToken) {
      apiClient.setAccessToken(session.accessToken);
    }

    const handleRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<{ accessToken: string; staff?: LoginResponse['staff'] }>;
      if (customEvent.detail?.accessToken) {
        apiClient.setAccessToken(customEvent.detail.accessToken);
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            accessToken: customEvent.detail.accessToken,
            staff: customEvent.detail.staff ?? prev.staff,
          };
        });
      }
    };

    const handleExpired = () => {
      clearAccountCache();
      apiClient.setAccessToken(null);
      setSession(null);
      setRoleState('');
      setWorkspaceOwnerId('');
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem('polarisx_crm_user_role');
      } catch { }
      notify.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Phiên làm việc');
    };

    window.addEventListener('crm:token-refreshed', handleRefreshed);
    window.addEventListener('crm:session-expired', handleExpired);

    return () => {
      window.removeEventListener('crm:token-refreshed', handleRefreshed);
      window.removeEventListener('crm:session-expired', handleExpired);
    };
  }, [session?.accessToken]);

  const isRoleLocked = true;
  const currentUser = session?.user || session?.staff;
  const userId = currentUser?.id || '';
  const userName = currentUser?.fullName || '';
  const userEmail = currentUser?.email || '';
  const staffId = userId;
  const staffName = userName;
  const staffEmail = userEmail;
  const isOwner = role === USER_ROLES.OWNER;
  const isStaff = role === USER_ROLES.STAFF;
  const isAgent = false;
  const ownerId = workspaceOwnerId || (isOwner ? userId : '');
  const isAuthenticated = session !== null;

  // Cập nhật role từ truy vấn context Workspace
  const setRole = (newRole: UserRole, newOwnerId?: string) => {
    setRoleState(newRole);
    if (newOwnerId !== undefined) {
      setWorkspaceOwnerId(newOwnerId);
    }
    try {
      if (newRole) {
        localStorage.setItem('polarisx_crm_user_role', newRole);
      } else {
        localStorage.removeItem('polarisx_crm_user_role');
      }
    } catch { }
  };

  const login = (newSession: LoginResponse) => {
    const newUser = newSession.user || newSession.staff;
    const currentActiveUser = session?.user || session?.staff;
    if (currentActiveUser && currentActiveUser.id !== newUser?.id) {
      clearAccountCache();
    }

    apiClient.setAccessToken(newSession.accessToken);
    setSession(newSession);

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch { }

    // Dọn sạch kiểm role khi đăng nhập: User không có role cố định, role sẽ được nạp từ truy vấn context Workspace
    setRoleState(USER_ROLES.EMPTY);
    setWorkspaceOwnerId('');
    try {
      localStorage.removeItem('polarisx_crm_user_role');
    } catch { }

    notify.success(
      `Chào mừng ${newUser?.fullName || 'bạn'}!`,
      'Đăng nhập thành công'
    );
  };

  const logout = () => {
    apiClient.clearAuth();
    clearAccountCache();
    setSession(null);
    setRoleState(USER_ROLES.EMPTY);
    setWorkspaceOwnerId('');
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('cusc_crm_auth_session');
      localStorage.removeItem('polarisx_crm_user_role');
      localStorage.removeItem('cusc_crm_user_role');
    } catch { }
    apiClient.post('/auth/logout').catch(() => { });
    notify.info('Đã đăng xuất khỏi hệ thống.', 'Phiên làm việc');
  };

  const toggleRole = () => {};

  return (
    <UserRoleContext.Provider
      value={{
        role,
        isOwner,
        isStaff,
        isAgent,
        isRoleLocked,
        userId,
        userName,
        userEmail,
        staffId,
        staffName,
        staffEmail,
        ownerId,
        session,
        isAuthenticated,
        login,
        logout,
        setRole,
        toggleRole,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = (): UserRoleContextValue => {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};
