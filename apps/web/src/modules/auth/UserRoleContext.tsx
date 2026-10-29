import React, { createContext, useContext, useEffect, useState } from 'react';
import { notify } from '../../components/feedback/toastEmitter.js';
import type { LoginResponse } from '../../features/auth/types/auth.types.js';
import { apiClient } from '../../lib/api-client.js';
import type { UserRoleContextValue } from './userRole.types.js';

export type UserRole = 'OWNER' | 'STAFF';
export type { UserRoleContextValue } from './userRole.types.js';

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

  const [roleState, setRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('polarisx_crm_user_role') || localStorage.getItem('cusc_crm_user_role');
      if (saved === 'OWNER' || saved === 'STAFF') return saved as UserRole;
    } catch { }
    return 'OWNER';
  });

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
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
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

  // KHÓA VAI TRÒ: Nếu đã có phiên đăng nhập, vai trò được xác định cố định theo tài khoản DB (OWNER hoặc STAFF)
  const role: UserRole = session
    ? session.staff.role === 'OWNER'
      ? 'OWNER'
      : 'STAFF'
    : roleState;

  const isRoleLocked = true; // Khóa chuyển đổi vai trò tùy tiện để đảm bảo an toàn phân quyền RBAC
  const staffId = session?.staff.id || '';
  const staffName = session?.staff.fullName || '';
  const staffEmail = session?.staff.email || '';
  const ownerId = (session?.staff as any)?.ownerId || (role === 'OWNER' ? staffId : '');
  const isAuthenticated = session !== null;

  const login = (newSession: LoginResponse) => {
    if (session && session.staff.id !== newSession.staff.id) {
      clearAccountCache();
    }

    apiClient.setAccessToken(newSession.accessToken);
    setSession(newSession);

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch { }

    // Map role từ backend sang role RBAC của CRM giao diện
    const mappedRole: UserRole = newSession.staff.role === 'OWNER' ? 'OWNER' : 'STAFF';
    setRoleState(mappedRole);
    try {
      localStorage.setItem('polarisx_crm_user_role', mappedRole);
    } catch { }

    notify.success(
      `Chào mừng ${newSession.staff.fullName} (${newSession.staff.role})!`,
      'Đăng nhập thành công'
    );
  };

  const logout = () => {
    clearAccountCache();
    apiClient.setAccessToken(null);
    apiClient.post('/auth/logout').catch(() => { });
    setSession(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch { }
    notify.info('Đã đăng xuất khỏi hệ thống.', 'Phiên làm việc');
  };

  const setRole = (newRole: UserRole) => {
    if (session) {
      notify.warning(
        'Vai trò đã được khóa cố định theo tài khoản đăng nhập (Bảo mật RBAC).',
        'Không thể chuyển đổi vai trò'
      );
      return;
    }

    setRoleState(newRole);
    try {
      localStorage.setItem('polarisx_crm_user_role', newRole);
    } catch { }

    if (newRole === 'OWNER') {
      notify.success(
        'Đã chuyển sang vai trò: Chủ doanh nghiệp (Toàn quyền quản lý kênh FB/Zalo, phân công và xem doanh số toàn trường).',
        'Phân quyền RBAC'
      );
    } else {
      notify.info(
        'Đã chuyển sang vai trò: Nhân viên tư vấn (Chỉ xem tin nhắn của mình/chưa gán; ẩn cấu hình kênh và doanh số trường).',
        'Phân quyền RBAC'
      );
    }
  };

  const toggleRole = () => {
    if (session) {
      notify.warning(
        'Vai trò đã được khóa cố định theo tài khoản đăng nhập (Bảo mật RBAC).',
        'Không thể chuyển đổi vai trò'
      );
      return;
    }
    setRole(role === 'OWNER' ? 'STAFF' : 'OWNER');
  };

  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';
  const isAgent = false;

  return (
    <UserRoleContext.Provider
      value={{
        role,
        isOwner,
        isStaff,
        isAgent,
        isRoleLocked,
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
