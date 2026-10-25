import React, { createContext, useContext, useState } from 'react';
import { notify } from '../../components/feedback/toastEmitter.js';
import type { LoginResponse } from '../../features/auth/types/auth.types.js';

export type UserRole = 'OWNER' | 'STAFF' | 'AGENT';

const SESSION_STORAGE_KEY = 'cusc_crm_auth_session';

export interface UserRoleContextValue {
  role: UserRole;
  isOwner: boolean;
  isStaff: boolean;
  isAgent: boolean;
  isRoleLocked: boolean;
  staffId: string;
  staffName: string;
  staffEmail: string;
  ownerId: string;
  session: LoginResponse | null;
  isAuthenticated: boolean;
  login: (newSession: LoginResponse) => void;
  logout: () => void;
  setRole: (newRole: UserRole) => void;
  toggleRole: () => void;
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lấy session đã lưu từ localStorage nếu có
  const [session, setSession] = useState<LoginResponse | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as LoginResponse;
    } catch {}
    return null;
  });

  const [roleState, setRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('cusc_crm_user_role');
      if (saved === 'OWNER' || saved === 'STAFF' || saved === 'AGENT') return saved as UserRole;
    } catch {}
    return 'OWNER';
  });

  // KHÓA VAI TRÒ: Nếu đã có phiên đăng nhập, vai trò được xác định cố định theo tài khoản DB
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
    setSession(newSession);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch {}

    // Map role từ backend sang role RBAC của CRM giao diện
    const mappedRole: UserRole = newSession.staff.role === 'OWNER' ? 'OWNER' : 'STAFF';
    setRoleState(mappedRole);
    try {
      localStorage.setItem('cusc_crm_user_role', mappedRole);
    } catch {}

    notify.success(
      `Chào mừng ${newSession.staff.fullName} (${newSession.staff.role})!`,
      'Đăng nhập thành công'
    );
  };

  const logout = () => {
    setSession(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
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
      localStorage.setItem('cusc_crm_user_role', newRole);
    } catch {}

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
  const isStaff = role === 'STAFF' || role === 'AGENT';

  return (
    <UserRoleContext.Provider
      value={{
        role,
        isOwner,
        isStaff,
        isAgent: isStaff,
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
