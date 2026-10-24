import React, { useState } from 'react';
import { X, Check, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import type { ChannelKey, DiscoveredPageDto } from '../types.js';
import { apiClient } from '../../../lib/api-client.js';
import { useTranslation } from '../../../i18n/index.js';

export interface OAuthSimulationModalProps {
  channel: ChannelKey;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (channel: ChannelKey, pages?: DiscoveredPageDto[]) => void;
}

export const OAuthSimulationModal: React.FC<OAuthSimulationModalProps> = ({
  channel,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
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

  const handleAuthorize = async () => {
    setIsProcessing(true);
    try {
      // Gọi API Backend trao đổi token OAuth thực tế / mô phỏng
      const result = await apiClient.exchangeOAuthToken(
        channel,
        `auth_code_${Date.now()}`,
        `state_${Date.now()}`,
      );
      setIsProcessing(false);
      onSuccess(channel, result.pages as DiscoveredPageDto[]);
      onClose();
    } catch {
      // Fallback nếu server backend đang offline
      setTimeout(() => {
        setIsProcessing(false);
        onSuccess(channel);
        onClose();
      }, 700);
    }
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
          <button className="oauth-close-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="crm-oauth-body">
          <div className="oauth-user-badge">
            <div className="oauth-user-avatar">
              {channelConfig.accountName.charAt(0)}
            </div>
            <div className="oauth-user-meta">
              <span className="oauth-account-label">{t('onboarding.oauthModal.authorizingAccount')}:</span>
              <span className="oauth-account-name">{channelConfig.accountName}</span>
            </div>
            <span className="oauth-status-tag">{t('onboarding.oauthModal.verified')}</span>
          </div>

          <div className="oauth-permissions-box">
            <div className="oauth-box-title">
              {t('onboarding.oauthModal.permissionsTitle')}:
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
            {t('onboarding.oauthModal.termsNotice')}
          </div>
        </div>

        <div className="crm-oauth-footer">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            {t('onboarding.oauthModal.cancelBtn')}
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
                {t('onboarding.oauthModal.authorizingBtn')}
              </>
            ) : (
              <>
                <ExternalLink size={16} />
                {t('onboarding.oauthModal.authorizeBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
