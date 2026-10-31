import React from 'react';
import { useUserRole } from './UserRoleContext.js';
import { Headphones, Crown, Lock } from 'lucide-react';

/**
 * Hiển thị huy hiệu vai trò RBAC của tài khoản hiện tại.
 * Đã khóa chuyển đổi vai trò tùy tiện để đảm bảo tuân thủ phân quyền và bảo mật hệ thống.
 */
export const RoleSwitcher: React.FC = () => {
  const { isOwner, role } = useUserRole();

  return (
    <div
      className="role-switcher-container role-switcher-locked"
      title={`Vai trò bảo mật RBAC: ${isOwner ? 'Chủ sở hữu (Owner)' : 'Tư vấn viên (Staff)'} - Xác định theo Workspace hiện tại`}
    >
      <div className={`role-switcher-badge ${isOwner ? 'active-owner' : 'active-agent'}`}>
        {isOwner ? (
          <>
            <Crown size={13} className="role-btn-icon" />
            <span className="role-text">Chủ DN (Owner)</span>
          </>
        ) : (
          <>
            <Headphones size={13} className="role-btn-icon" />
            <span className="role-text">Tư vấn viên ({role})</span>
          </>
        )}
        <span title="Vai trò đã khóa bảo mật"><Lock size={11} className="role-lock-icon" /></span>
      </div>
    </div>
  );
};
