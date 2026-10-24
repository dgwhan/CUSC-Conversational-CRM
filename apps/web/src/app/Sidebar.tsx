import React from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Layers,
  GraduationCap,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Tin nhắn Tư vấn', icon: <MessageSquare size={18} />, active: true, tag: 'MSG-06' },
    { label: 'Quản lý Tuyển sinh', icon: <UserCheck size={18} />, active: false },
    { label: 'Hồ sơ Thí sinh', icon: <Users size={18} />, active: false },
    { label: 'Báo cáo & Thống kê', icon: <BarChart3 size={18} />, active: false },
    { label: 'Cấu hình Kênh', icon: <Layers size={18} />, active: false },
    { label: 'Cài đặt Hệ thống', icon: <Settings size={18} />, active: false },
  ];

  return (
    <aside className="crm-sidebar">
      <div className="crm-sidebar-brand">
        <div className="crm-brand-icon">
          <GraduationCap size={22} />
        </div>
        <div className="crm-brand-text">
          <span className="crm-brand-name">CUSC CRM</span>
          <span className="crm-brand-sub">Recruitment Portal</span>
        </div>
      </div>

      <div className="crm-sidebar-menu">
        <div className="crm-menu-section-label">CHỨC NĂNG HỆ THỐNG</div>
        <nav className="crm-nav-list">
          {navItems.map((item, idx) => (
            <a
              key={idx}
              href="#"
              className={`crm-nav-item ${item.active ? 'active' : ''}`}
              onClick={(e) => e.preventDefault()}
            >
              <span className="crm-nav-icon">{item.icon}</span>
              <span className="crm-nav-label">{item.label}</span>
              {item.tag && <span className="crm-nav-tag">{item.tag}</span>}
            </a>
          ))}
        </nav>
      </div>

      <div className="crm-sidebar-footer">
        <div className="crm-user-profile">
          <div className="crm-user-avatar">AD</div>
          <div className="crm-user-info">
            <span className="crm-user-name">Ban Tuyển Sinh</span>
            <span className="crm-user-role">Quản trị viên CRM</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
