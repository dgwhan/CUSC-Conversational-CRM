import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  ExternalLink,
  Loader2,
  KeyRound,
  Globe,
  HelpCircle,
  Webhook,
  Info,
  CheckCircle2,
} from 'lucide-react';
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

  // Dữ liệu kết nối trực tiếp Token & Page ID
  const [pageIdInput, setPageIdInput] = useState('');
  const [pageNameInput, setPageNameInput] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');

  // Lấy URL ủy quyền OAuth thực tế từ Backend
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
          // Chưa cấu hình OAuth App ID
        });
    }
  }, [channel, isOpen]);

  // Lắng nghe phản hồi từ cửa sổ Popup OAuth (khi Meta / Zalo redirect về web app)
  useEffect(() => {
    const handleOAuthCallbackMessage = async (event: MessageEvent) => {
      if (typeof window !== 'undefined' && event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_CALLBACK' && event.data?.code) {
        setIsProcessing(true);
        notify.info('Đang trao đổi mã ủy quyền và kết nối Webhook...');
        try {
          const result = await apiClient.exchangeOAuthToken(
            channel,
            event.data.code,
            event.data.state,
          );
          setIsProcessing(false);
          if (result.pages && result.pages.length > 0) {
            notify.success(`Đã phát hiện và kết nối ${result.pages.length} trang thành công!`);
            onSuccess(channel, result.pages as DiscoveredPageDto[]);
            onClose();
          } else {
            notify.warning('Không tìm thấy trang nào thuộc tài khoản này. Vui lòng kiểm tra quyền quản trị Fanpage.');
          }
        } catch (err) {
          setIsProcessing(false);
          notify.error(`Xác thực OAuth thất bại: ${(err as Error).message}`);
        }
      }
    };

    window.addEventListener('message', handleOAuthCallbackMessage);
    return () => window.removeEventListener('message', handleOAuthCallbackMessage);
  }, [channel, onSuccess, onClose]);

  if (!isOpen) return null;

  const isRealOAuthConfigured =
    realAuthUrl &&
    realAuthUrl.includes('client_id=') &&
    !realAuthUrl.includes('dev_simulated');

  const channelConfig = {
    FACEBOOK: {
      title: 'Kết nối Facebook Fanpage & Webhook',
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
      webhookEndpoint: '/api/webhook/facebook',
      verifyToken: 'cusc_recruitment_crm_webhook_verify_secret',
      fields: 'messages, messaging_postbacks',
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
      webhookEndpoint: '/api/webhook/zalo',
      verifyToken: 'zalo_webhook_secret',
      fields: 'user_send_text, user_send_image',
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
      webhookEndpoint: '/api/webhook/tiktok',
      verifyToken: 'tiktok_verify_secret',
      fields: 'im.message.receive',
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
      webhookEndpoint: '/api/webhook/facebook',
      verifyToken: 'cusc_recruitment_crm_webhook_verify_secret',
      fields: 'messages, messaging_postbacks',
    },
  }[channel];

  // Mở cửa sổ OAuth chính thức
  const handleAuthorizeOAuth = () => {
    if (isRealOAuthConfigured && realAuthUrl) {
      const popup = window.open(realAuthUrl, 'oauth_popup', 'width=620,height=750,scrollbars=yes');
      if (popup) {
        notify.info('Đang mở cửa sổ đăng nhập OAuth chính thức từ Meta. Vui lòng cấp quyền...', 'Ủy quyền OAuth');
      } else {
        notify.warning('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép popup để tiếp tục.');
      }
    } else {
      notify.warning(
        'Máy chủ chưa cấu hình META_APP_ID trong file .env. Vui lòng chuyển sang tab "2. Nhập Page ID & Token" để kết nối trang thực tế của bạn ngay lập tức!',
      );
      setConnectTab('TOKEN');
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
      const pageName = pageNameInput.trim() || result.pages?.[0]?.name || pageIdInput.trim();
      notify.success(`Đã kết nối thành công tài khoản "${pageName}" và kích hoạt Webhook!`);
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
        style={{ maxWidth: '540px', width: '92%' }}
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
            <span>1. Đăng nhập OAuth</span>
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
        <div className="crm-oauth-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {connectTab === 'OAUTH' ? (
            <div>
              <div className="oauth-notice-card" style={{ marginBottom: '14px' }}>
                <p className="oauth-notice-text">{channelConfig.notice}</p>
              </div>

              {!isRealOAuthConfigured && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '12.5px',
                    color: '#92400e',
                    lineHeight: 1.45,
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                  <div>
                    <strong>Chưa cấu hình META_APP_ID trên máy chủ:</strong> Để đăng nhập trực tiếp qua OAuth Meta, vui lòng bổ sung <code>META_APP_ID</code> và <code>META_APP_SECRET</code> vào file <code>.env</code>.
                    <div style={{ marginTop: '6px' }}>
                      Hoặc chuyển sang tab <strong>&ldquo;2. Nhập Page ID & Token&rdquo;</strong> để kết nối Fanpage ngay lập tức mà không cần tạo Meta App!
                    </div>
                  </div>
                </div>
              )}

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

              {/* Thông tin Webhook Tích Hợp */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  <Webhook size={14} style={{ color: '#0284c7' }} />
                  <span>Cơ chế nhận tin nhắn tự động qua Webhook:</span>
                </div>
                <p style={{ margin: 0, color: '#64748b', lineHeight: 1.45 }}>
                  Khi kết nối thành công, CRM sẽ tự động đăng ký Page vào Webhook Meta (<code>subscribed_apps</code>). Mọi tin nhắn khách hàng gửi tới Fanpage sẽ được đẩy tự động theo thời gian thực về Hộp thư tuyển sinh.
                </p>
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
                  Tên hiển thị Fanpage / OA (Tùy chọn)
                </label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Hệ thống tự động phát hiện từ Graph API nếu để trống"
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

              {/* Box Hướng dẫn cấu hình Webhook */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '11.5px',
                  color: '#334155',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Webhook size={14} style={{ color: '#2563eb' }} />
                  <span>Thông tin Webhook Meta Developers:</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Webhook URL:</span>
                  <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px', fontSize: '11px', wordBreak: 'break-all' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}${channelConfig.webhookEndpoint}` : channelConfig.webhookEndpoint}
                  </code>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Verify Token:</span>
                  <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px', fontSize: '11px' }}>
                    {channelConfig.verifyToken}
                  </code>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px' }}>
                  <span style={{ color: '#64748b' }}>Sự kiện theo dõi:</span>
                  <span style={{ fontWeight: 500 }}>{channelConfig.fields}</span>
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
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={16} />
                  <span>{isRealOAuthConfigured ? 'Đăng nhập với Facebook' : 'Ủy quyền / Chuyển Tab'}</span>
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
                  <span>Đang xác thực & đăng ký Webhook...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Xác thực & Kết nối Webhook</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
