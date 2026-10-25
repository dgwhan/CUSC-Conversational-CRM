import React, { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, ExternalLink, Loader2, KeyRound, Globe, HelpCircle } from 'lucide-react';
import type { ChannelKey, DiscoveredPageDto } from '../types.js';
import { apiClient } from '../../../lib/api-client.js';
import { useTranslation } from '../../../i18n/index.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

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
  const [connectTab, setConnectTab] = useState<'OAUTH' | 'TOKEN'>('OAUTH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [realAuthUrl, setRealAuthUrl] = useState<string | null>(null);

  // Dữ liệu nhập trực tiếp Token & Page ID (Không dùng dữ liệu cứng)
  const [pageIdInput, setPageIdInput] = useState('');
  const [pageNameInput, setPageNameInput] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');

  // Tự động lấy URL ủy quyền OAuth thực tế từ Backend nếu có cấu hình
  useEffect(() => {
    if (isOpen) {
      apiClient
        .getAuthorizeUrl(channel)
        .then((res) => {
          if (res?.authorizeUrl) {
            setRealAuthUrl(res.authorizeUrl);
          }
        })
        .catch(() => {
          // Chưa cấu hình OAuth App ID trên server
        });
    }
  }, [channel, isOpen]);

  if (!isOpen) return null;

  const channelConfig = {
    FACEBOOK: {
      title: 'Kết nối Facebook Fanpage',
      bg: '#1877F2',
      permissions: [
        'Quản lý tin nhắn trang (pages_messaging)',
        'Đọc danh sách và siêu dữ liệu trang (pages_manage_metadata)',
        'Đọc thông tin tương tác của khách hàng (pages_read_engagement)',
        'Hiển thị danh sách trang bạn quản trị (pages_show_list)',
      ],
      notice: 'Ủy quyền cho phép CRM đồng bộ tin nhắn khách hàng gửi đến Fanpage vào Hộp thư tập trung.',
      pageIdLabel: 'ID Trang Fanpage (Page ID hoặc Username)',
      pageIdPlaceholder: 'Ví dụ: 100293848192841 hoặc cusc.ctu',
      tokenLabel: 'Page Access Token (Dài hạn)',
      tokenPlaceholder: 'EAA...',
      tokenHint: 'Lấy từ Meta Business Suite hoặc Trình khám phá Graph API (Graph API Explorer) với quyền pages_messaging.',
    },
    ZALO: {
      title: 'Kết nối Zalo Official Account (OA)',
      bg: '#0068FF',
      permissions: [
        'Truy cập thông tin Official Account',
        'Nhận tin nhắn người quan tâm gửi đến OA qua Webhook',
        'Gửi tin nhắn phản hồi trực tiếp cho người dùng',
        'Đọc danh sách người dùng đang tương tác với OA',
      ],
      notice: 'Tài khoản Zalo OA cần được xác thực Doanh nghiệp để cấp quyền Webhook tin nhắn.',
      pageIdLabel: 'OA ID (Mã định danh Official Account)',
      pageIdPlaceholder: 'Ví dụ: 384729182947192841',
      tokenLabel: 'OA Secret Key / Access Token',
      tokenPlaceholder: 'Chuỗi Access Token từ Zalo Open Platform',
      tokenHint: 'Lấy từ Cài đặt Ứng dụng trên Zalo for Developers (developers.zalo.me).',
    },
    TIKTOK: {
      title: 'Kết nối TikTok for Business / Shop',
      bg: '#000000',
      permissions: [
        'Đọc tin nhắn trực tiếp từ khách hàng TikTok',
        'Đồng bộ bình luận trên video và livestream',
        'Quản lý thông tin tương tác khách hàng tiềm năng',
      ],
      notice: 'Ủy quyền cho phép CRM đồng bộ tin nhắn từ tài khoản TikTok Creator / Business của bạn.',
      pageIdLabel: 'TikTok Business Account ID / Username',
      pageIdPlaceholder: 'Ví dụ: @tuyensinh_official',
      tokenLabel: 'TikTok Client Access Token',
      tokenPlaceholder: 'act.example_tiktok_access_token...',
      tokenHint: 'Tạo từ Cổng phát triển TikTok for Developers.',
    },
    INSTAGRAM: {
      title: 'Kết nối Instagram Professional Direct',
      bg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
      permissions: [
        'Truy cập hộp thư Instagram Direct Message',
        'Đọc thông tin người gửi tin nhắn',
        'Gửi tin nhắn phản hồi trực tiếp từ CRM',
      ],
      notice: 'Tài khoản Instagram cần được chuyển sang tài khoản Chuyên nghiệp (Business) và liên kết với Trang Facebook.',
      pageIdLabel: 'Instagram Account ID / Username',
      pageIdPlaceholder: 'Ví dụ: @tuyensinh.it',
      tokenLabel: 'User / Page Access Token',
      tokenPlaceholder: 'EAA...',
      tokenHint: 'Lấy từ Meta Graph API Explorer liên kết với Instagram Business Account.',
    },
  }[channel];

  // Xử lý kết nối qua OAuth chuẩn hoặc Simulation
  const handleAuthorizeOAuth = async () => {
    setIsProcessing(true);
    try {
      // Nếu có URL OAuth thật từ Meta/Zalo và người dùng bấm mở
      if (realAuthUrl && realAuthUrl.includes('client_id=') && !realAuthUrl.includes('dev_simulated')) {
        const popup = window.open(realAuthUrl, '_blank', 'width=600,height=700');
        if (popup) {
          notify.info('Đang mở cửa sổ đăng nhập OAuth chính thức. Vui lòng cấp quyền...', 'Ủy quyền OAuth');
        }
      }

      // Trao đổi token với Backend
      const result = await apiClient.exchangeOAuthToken(
        channel,
        `auth_code_${Date.now()}`,
        `state_${Date.now()}`,
      );
      setIsProcessing(false);
      onSuccess(channel, result.pages as DiscoveredPageDto[]);
      onClose();
    } catch (err) {
      setIsProcessing(false);
      notify.error(`Xác thực kết nối thất bại: ${(err as Error).message}`);
    }
  };

  // Xử lý kết nối trực tiếp bằng Page ID & Access Token thực tế
  const handleConnectByToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageIdInput.trim() && !accessTokenInput.trim()) {
      notify.warning('Vui lòng nhập ID Trang / OA ID hoặc Access Token để kết nối.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await apiClient.exchangeOAuthToken(channel, {
        pageId: pageIdInput.trim(),
        pageName: pageNameInput.trim() || undefined,
        accessToken: accessTokenInput.trim() || undefined,
      });

      setIsProcessing(false);
      notify.success(`Đã kết nối thành công tài khoản ${pageNameInput.trim() || pageIdInput.trim()}!`);
      onSuccess(channel, result.pages as DiscoveredPageDto[]);
      onClose();
    } catch (err) {
      setIsProcessing(false);
      notify.error(`Không thể xác thực token tài khoản: ${(err as Error).message}`);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div
        className="crm-oauth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '92%' }}
      >
        {/* Header Modal */}
        <div className="crm-oauth-header" style={{ background: channelConfig.bg }}>
          <div className="oauth-header-content">
            <ShieldCheck size={24} className="oauth-shield-icon" />
            <span className="oauth-header-title">{channelConfig.title}</span>
          </div>
          <button className="oauth-close-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Tab chuyển đổi phương thức kết nối chuẩn */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '4px 16px 0 16px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setConnectTab('OAUTH')}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: connectTab === 'OAUTH' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: connectTab === 'OAUTH' ? '#2563eb' : '#64748b',
              fontWeight: connectTab === 'OAUTH' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Globe size={14} />
            <span>1. Ủy quyền OAuth</span>
          </button>

          <button
            type="button"
            onClick={() => setConnectTab('TOKEN')}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: connectTab === 'TOKEN' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: connectTab === 'TOKEN' ? '#2563eb' : '#64748b',
              fontWeight: connectTab === 'TOKEN' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <KeyRound size={14} />
            <span>2. Nhập Page ID & Token</span>
          </button>
        </div>

        {/* Body Modal */}
        <div className="crm-oauth-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {connectTab === 'OAUTH' ? (
            <div>
              <div className="oauth-notice-card" style={{ marginBottom: '16px' }}>
                <p className="oauth-notice-text">{channelConfig.notice}</p>
              </div>

              <div className="oauth-permissions-box">
                <div className="oauth-box-title">
                  {t('onboarding.oauthModal.permissionsTitle')} ({channel}):
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

              <div className="oauth-terms" style={{ marginTop: '14px' }}>
                {t('onboarding.oauthModal.termsNotice')}
              </div>
            </div>
          ) : (
            <form id="token-connect-form" onSubmit={handleConnectByToken}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  {channelConfig.pageIdLabel} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder={channelConfig.pageIdPlaceholder}
                  value={pageIdInput}
                  onChange={(e) => setPageIdInput(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Tên hiển thị Trang (Page Display Name)
                </label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Ví dụ: Fanpage Tuyển Sinh Đại Học"
                  value={pageNameInput}
                  onChange={(e) => setPageNameInput(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  {channelConfig.tokenLabel}
                </label>
                <textarea
                  className="form-input"
                  style={{
                    width: '100%',
                    minHeight: '75px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    boxSizing: 'border-box',
                  }}
                  placeholder={channelConfig.tokenPlaceholder}
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '4px',
                    marginTop: '5px',
                    fontSize: '11px',
                    color: '#64748b',
                    lineHeight: 1.4,
                  }}
                >
                  <HelpCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{channelConfig.tokenHint}</span>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer Modal */}
        <div className="crm-oauth-footer">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            {t('onboarding.oauthModal.cancelBtn')}
          </button>

          {connectTab === 'OAUTH' ? (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{
                background: channelConfig.bg,
                minWidth: '180px',
              }}
              onClick={handleAuthorizeOAuth}
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
                  <span>Cấp quyền & Khám phá Trang</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              form="token-connect-form"
              className="crm-btn crm-btn-primary"
              style={{
                background: channelConfig.bg,
                minWidth: '180px',
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="crm-btn-spinner" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Xác thực & Kết nối Trang</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
