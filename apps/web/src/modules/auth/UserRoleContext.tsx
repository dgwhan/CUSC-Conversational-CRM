import React, { createContext, useContext, useState } from 'react';
import { notify } from '../../components/feedback/toastEmitter.js';

export type UserRole = 'OWNER' | 'AGENT';

export interface UserRoleContextValue {
  role: UserRole;
  isOwner: boolean;
  isAgent: boolean;
  staffId: string;
  staffName: string;
  setRole: (newRole: UserRole) => void;
  toggleRole: () => void;
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('cusc_crm_user_role');
      if (saved === 'OWNER' || saved === 'AGENT') return saved;
    } catch {}
    return 'OWNER';
  });

  const staffId = 'staff-1';
  const staffName = 'Nguyễn Văn Minh';

  const setRole = (newRole: UserRole) => {
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
    setRole(role === 'OWNER' ? 'AGENT' : 'OWNER');
  };

  return (
    <UserRoleContext.Provider
      value={{
        role,
        isOwner: role === 'OWNER',
        isAgent: role === 'AGENT',
        staffId,
        staffName,
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
