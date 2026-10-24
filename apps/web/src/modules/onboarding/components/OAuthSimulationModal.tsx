import React, { useState } from 'react';
import { X, Check, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import type { ChannelKey } from '../types.js';

export interface OAuthSimulationModalProps {
  channel: ChannelKey;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (channel: ChannelKey) => void;
}

export const OAuthSimulationModal: React.FC<OAuthSimulationModalProps> = ({
  channel,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const channelConfig = {
    FACEBOOK: {
      title: 'Đăng nhập & Cấp quyền qua Meta (Facebook)',
      bg: '#1877F2',
      accountName: 'Nguyễn Quản Trị (Admin Page)',
      permissions: [
        'Quản lý tin nhắn trang (pages_messaging)',
        'Đọc danh sách và siêu dữ liệu trang (pages_manage_metadata)',
        'Đọc thông tin tương tác của khách hàng (pages_read_engagement)',
        'Hiển thị danh sách trang bạn quản trị (pages_show_list)',
      ],
      notice: 'Ứng dụng CUSC Recruitment CRM sẽ yêu cầu quyền quản lý hội thoại để gom tin nhắn về hệ thống tập trung.',
    },
    ZALO: {
      title: 'Ủy quyền Ứng dụng Zalo Official Account',
      bg: '#0068FF',
      accountName: 'Zalo Doanh Nghiệp CUSC',
      permissions: [
        'Truy cập thông tin Official Account',
        'Nhận tin nhắn người quan tâm gửi đến OA qua Webhook',
        'Gửi tin nhắn phản hồi trực tiếp cho người dùng',
        'Đọc danh sách người dùng đang tương tác với OA',
      ],
      notice: 'Zalo Open Platform yêu cầu tài khoản OA đã được xác minh Doanh nghiệp để cấp đầy đủ quyền.',
    },
    TIKTOK: {
      title: 'Ủy quyền TikTok for Business / Shop',
      bg: '#000000',
      accountName: 'CUSC Education Official',
      permissions: [
        'Đọc tin nhắn trực tiếp từ khách hàng TikTok',
        'Đồng bộ bình luận trên video và livestream',
        'Quản lý thông tin tương tác khách hàng tiềm năng',
      ],
      notice: 'Ủy quyền cho phép CRM đồng bộ tin nhắn từ tài khoản TikTok Creator / Business của bạn.',
    },
    INSTAGRAM: {
      title: 'Ủy quyền Instagram Professional Direct',
      bg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
      accountName: '@cusc.education',
      permissions: [
        'Truy cập hộp thư Instagram Direct Message',
        'Đọc thông tin người gửi tin nhắn',
        'Gửi tin nhắn phản hồi trực tiếp từ CRM',
      ],
      notice: 'Tài khoản Instagram cần được chuyển sang tài khoản Chuyên nghiệp (Business/Creator) và liên kết với Trang Facebook.',
    },
  }[channel];

  const handleAuthorize = () => {
    setIsProcessing(true);
    // Giả lập thời gian handshake OAuth và trao đổi token (Long-lived Token exchange)
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess(channel);
      onClose();
    }, 1200);
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div
        className="crm-oauth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '90%' }}
      >
        <div className="crm-oauth-header" style={{ background: channelConfig.bg }}>
          <div className="oauth-header-content">
            <ShieldCheck size={24} className="oauth-shield-icon" />
            <span className="oauth-header-title">{channelConfig.title}</span>
          </div>
          <button className="oauth-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="crm-oauth-body">
          <div className="oauth-user-badge">
            <div className="oauth-user-avatar">
              {channelConfig.accountName.charAt(0)}
            </div>
            <div className="oauth-user-meta">
              <span className="oauth-account-label">Tài khoản ủy quyền:</span>
              <span className="oauth-account-name">{channelConfig.accountName}</span>
            </div>
            <span className="oauth-status-tag">Đã xác minh</span>
          </div>

          <div className="oauth-permissions-box">
            <div className="oauth-box-title">
              Các quyền sẽ cấp cho <strong>CUSC Recruitment CRM</strong>:
            </div>
            <ul className="oauth-permissions-list">
              {channelConfig.permissions.map((perm, idx) => (
                <li key={idx} className="oauth-perm-item">
                  <Check size={16} className="perm-check-icon" />
                  <span>{perm}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="oauth-notice-card">
            <p className="oauth-notice-text">{channelConfig.notice}</p>
          </div>

          <div className="oauth-terms">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của bên cung cấp nền tảng.
          </div>
        </div>

        <div className="crm-oauth-footer">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            style={{
              background: channelConfig.bg,
              minWidth: '180px',
            }}
            onClick={handleAuthorize}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="crm-btn-spinner" />
                Đang cấp quyền...
              </>
            ) : (
              <>
                <ExternalLink size={16} />
                Tiếp tục & Cấp quyền
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
