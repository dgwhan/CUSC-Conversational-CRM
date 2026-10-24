import React from 'react';
import { useUserRole } from './UserRoleContext.js';
import { Headphones, Crown } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { setRole, isOwner } = useUserRole();

  return (
    <div className="role-switcher-container" title="Chuyển đổi vai trò để kiểm tra phân quyền (RBAC)">
      <button
        type="button"
        className={`role-switcher-btn ${isOwner ? 'active-owner' : ''}`}
        onClick={() => setRole('OWNER')}
      >
        <Crown size={13} className="role-btn-icon" />
        <span>Chủ DN (Owner)</span>
      </button>

      <button
        type="button"
        className={`role-switcher-btn ${!isOwner ? 'active-agent' : ''}`}
        onClick={() => setRole('AGENT')}
      >
        <Headphones size={13} className="role-btn-icon" />
        <span>Tư vấn viên (Agent)</span>
      </button>
    </div>
  );
};
