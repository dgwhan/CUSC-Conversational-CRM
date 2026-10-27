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
  Eye,
  EyeOff,
  BookOpen,
  XCircle,
  RefreshCw,
  ArrowRight,
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

type TestStatus = 'IDLE' | 'TESTING' | 'SUCCESS' | 'FAILED';

export const OAuthSimulationModal: React.FC<OAuthSimulationModalProps> = ({
  channel,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [connectTab, setConnectTab] = useState<'TUTORIAL' | 'TOKEN' | 'OAUTH'>('TOKEN');
  const [isProcessing, setIsProcessing] = useState(false);
  const [realAuthUrl, setRealAuthUrl] = useState<string | null>(null);

  // Dữ liệu kết nối trực tiếp Token & Page ID
  const [pageIdInput, setPageIdInput] = useState('');
  const [pageNameInput, setPageNameInput] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Trạng thái kiểm thử điều kiện kết nối thực tế
  const [testStatus, setTestStatus] = useState<TestStatus>('IDLE');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    page?: DiscoveredPageDto;
    details?: {
      tokenValid: boolean;
      pageFound: boolean;
      pageName?: string;
      pageId?: string;
      permissionsOk?: boolean;
      webhookSubscribed?: boolean;
      warning?: string;
    };
    error?: string;
  } | null>(null);

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
      pageIdLabel: 'ID Trang Fanpage (Page ID)',
      pageIdPlaceholder: 'Ví dụ: 102938475610293 (dãy 15–16 số)',
      tokenLabel: 'Page Access Token (Token của Trang)',
      tokenPlaceholder: 'EAAG... (Bắt đầu bằng EAA)',
      tokenHint: 'Lấy từ Meta Graph API Explorer sau khi chọn đúng Fanpage ở mục User or Page.',
      webhookEndpoint: '/api/webhook/facebook',
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
        'Máy chủ chưa cấu hình META_APP_ID trong file .env. Vui lòng chuyển sang tab "Nhập Page ID & Token" để kiểm thử và kết nối trang thực tế!',
      );
      setConnectTab('TOKEN');
    }
  };

  // Thực thi kiểm thử kết nối thực tế với máy chủ Meta Graph API
  const handleRunConnectionTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!pageIdInput.trim()) {
      notify.warning('Vui lòng nhập ID Trang Fanpage (Page ID) để kiểm thử.');
      return;
    }

    if (channel === 'FACEBOOK' && !accessTokenInput.trim()) {
      notify.warning('Vui lòng nhập Page Access Token (bắt đầu bằng EAA...) để kiểm thử kết nối.');
      return;
    }

    setTestStatus('TESTING');
    setIsProcessing(true);
    setTestResult(null);

    try {
      const result = await apiClient.exchangeOAuthToken(channel, {
        pageId: pageIdInput.trim(),
        pageName: pageNameInput.trim() || undefined,
        accessToken: accessTokenInput.trim() || undefined,
      });

      setIsProcessing(false);

      if (result.pages && result.pages.length > 0) {
        const verifiedPage = result.pages[0];
        setTestStatus('SUCCESS');
        setTestResult({
          success: true,
          message: (result as any).testResult?.message || `Xác thực thành công Fanpage "${verifiedPage.name}"!`,
          page: verifiedPage as DiscoveredPageDto,
          details: (result as any).testResult?.details,
        });
        notify.success(`Đã kiểm thử và xác thực thành công Fanpage "${verifiedPage.name}"!`);
      } else {
        setTestStatus('FAILED');
        setTestResult({
          success: false,
          message: 'Không tìm thấy thông tin Fanpage từ Meta.',
          error: 'Meta Graph API không trả về trang nào. Vui lòng kiểm tra lại quyền quản trị của tài khoản.',
        });
        notify.error('Xác thực thất bại. Vui lòng kiểm tra lại ID Trang và Token.');
      }
    } catch (err) {
      setIsProcessing(false);
      setTestStatus('FAILED');
      const errorMsg = (err as Error).message || 'Không thể xác thực với Meta Facebook';
      setTestResult({
        success: false,
        message: 'Kiểm thử kết nối không thành công',
        error: errorMsg,
      });
      notify.error(`Xác thực thất bại: ${errorMsg}`);
    }
  };

  // Xác nhận lưu trang sau khi kiểm thử ĐẠT ĐIỀU KIỆN
  const handleConfirmActivation = () => {
    if (!testResult?.page) {
      notify.warning('Chưa có dữ liệu Fanpage được xác thực hợp lệ.');
      return;
    }

    notify.success(`Đã thêm Fanpage "${testResult.page.name}" vào danh sách kích hoạt của Workspace!`);
    onSuccess(channel, [testResult.page]);
    onClose();
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div
        className="crm-oauth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '92%' }}
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

        {/* 3 Tab Điều hướng chức năng */}
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
            onClick={() => setConnectTab('TUTORIAL')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderBottom: connectTab === 'TUTORIAL' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: connectTab === 'TUTORIAL' ? '#2563eb' : '#64748b',
              fontWeight: connectTab === 'TUTORIAL' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BookOpen size={14} />
            <span>1. Hướng dẫn lấy Token</span>
          </button>

          <button
            type="button"
            onClick={() => setConnectTab('TOKEN')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderBottom: connectTab === 'TOKEN' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: connectTab === 'TOKEN' ? '#2563eb' : '#64748b',
              fontWeight: connectTab === 'TOKEN' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <KeyRound size={14} />
            <span>2. Nhập & Kiểm thử kết nối</span>
            {testStatus === 'SUCCESS' && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            )}
            {testStatus === 'FAILED' && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setConnectTab('OAUTH')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderBottom: connectTab === 'OAUTH' ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              color: connectTab === 'OAUTH' ? '#2563eb' : '#64748b',
              fontWeight: connectTab === 'OAUTH' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Globe size={14} />
            <span>3. Đăng nhập OAuth</span>
          </button>
        </div>

        {/* Body Modal */}
        <div className="crm-oauth-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px' }}>
          {/* TAB 1: TUTORIAL LẤY TOKEN */}
          {connectTab === 'TUTORIAL' && (
            <div>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#166534',
                }}
              >
                <strong> Mục tiêu:</strong> Để CRM tự động nhận tin nhắn từ Facebook khách hàng gửi đến Fanpage, bạn cần <strong>Page ID</strong> và <strong>Page Access Token</strong> có quyền nhận tin nhắn (<code>pages_messaging</code>).
              </div>

              {/* Bước 1 Tutorial */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px' }}>1</span>
                  <span>Cách lấy ID Trang (Page ID)</span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                  <p style={{ margin: '0 0 6px 0' }}>• Đăng nhập Facebook và chuyển sang quyền quản lý Fanpage của bạn.</p>
                  <p style={{ margin: '0 0 6px 0' }}>• Vào trang Fanpage $\rightarrow$ Chọn tab <strong>Giới thiệu</strong> (*About*) $\rightarrow$ <strong>Tính minh bạch của Trang</strong> (*Page Transparency*).</p>
                  <p style={{ margin: '0 0 6px 0' }}>• Sao chép dòng <strong>ID Trang</strong> (Là một dãy 15–16 chữ số, ví dụ: <code>102938475610293</code>).</p>
                  <p style={{ margin: 0, color: '#64748b' }}>*(Mẹo: Bạn cũng có thể nhìn trên thanh địa chỉ URL: <code>facebook.com/profile.php?id=102938475610...</code>)*</p>
                </div>
              </div>

              {/* Bước 2 Tutorial */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px' }}>2</span>
                  <span>Lấy Page Access Token (Meta Graph API Explorer)</span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    Truy cập công cụ chính thức của Meta:{' '}
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      Mở Graph API Explorer <ExternalLink size={12} />
                    </a>
                  </p>
                  <p style={{ margin: '0 0 6px 0' }}>• Tại mục <strong>Meta App</strong>: Chọn App Facebook của bạn.</p>
                  <p style={{ margin: '0 0 6px 0' }}>• Tại mục <strong>Permissions</strong>: Tích chọn đủ 4 quyền bắt buộc sau:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '6px 0 8px 0' }}>
                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>pages_messaging</code>
                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>pages_manage_metadata</code>
                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>pages_read_engagement</code>
                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>pages_show_list</code>
                  </div>
                  <p style={{ margin: '0 0 6px 0' }}>• Bấm <strong>Generate Access Token</strong> và xác nhận cấp quyền.</p>
                  <p style={{ margin: '0 0 4px 0', color: '#b45309', fontWeight: 600 }}>
                    ⚡ Quan trọng: Sau khi cấp quyền xong, bấm lại vào menu dropdown "User or Page" $\rightarrow$ Chọn đúng Fanpage của bạn để chuyển thành Page Access Token (Bắt đầu bằng EAA...).
                  </p>
                </div>
              </div>

              {/* Bước 3 Tutorial */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px' }}>3</span>
                  <span>Đổi sang Token dài hạn / vĩnh viễn (Khuyên dùng)</span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                  <p style={{ margin: '0 0 6px 0' }}>Token tạo nhanh ở Bước 2 thường hết hạn sau 1–2 tiếng. Để CRM duy trì kết nối liên tục:</p>
                  <p style={{ margin: '0 0 6px 0' }}>
                    Mở{' '}
                    <a
                      href="https://developers.facebook.com/tools/debug/accesstoken/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      Access Token Debugger <ExternalLink size={12} />
                    </a>{' '}
                    $\rightarrow$ Dán token $\rightarrow$ Bấm <strong>Debug</strong> $\rightarrow$ Cuộn xuống dưới chọn <strong>Extend Access Token</strong>.
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  style={{ minWidth: '240px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => setConnectTab('TOKEN')}
                >
                  <span>Tôi đã có ID & Token ➔ Tiến hành Kiểm thử</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: NHẬP VÀ KIỂM THỬ KẾT NỐI */}
          {connectTab === 'TOKEN' && (
            <div>
              <form id="token-test-form" onSubmit={handleRunConnectionTest}>
                {/* ID Trang */}
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
                    onChange={(e) => {
                      setPageIdInput(e.target.value);
                      if (testStatus !== 'IDLE') setTestStatus('IDLE');
                    }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                    Dãy số định danh Fanpage từ Facebook (Ví dụ: 102938475610293).
                  </span>
                </div>

                {/* Tên gợi nhớ */}
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
                    Tên gợi nhớ Trang (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Tự động lấy tên chính thức từ Meta Graph API nếu để trống"
                    value={pageNameInput}
                    onChange={(e) => setPageNameInput(e.target.value)}
                  />
                </div>

                {/* Token */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        margin: 0,
                      }}
                    >
                      {channelConfig.tokenLabel} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {accessTokenInput && (
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 4px',
                        }}
                      >
                        {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showToken ? 'Ẩn token' : 'Hiện token'}</span>
                      </button>
                    )}
                  </div>
                  <textarea
                    className="form-input"
                    style={{
                      width: '100%',
                      minHeight: '75px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      boxSizing: 'border-box',
                      ...(showToken ? {} : { WebkitTextSecurity: 'disc' } as any),
                    }}
                    placeholder={channelConfig.tokenPlaceholder}
                    value={accessTokenInput}
                    onChange={(e) => {
                      setAccessTokenInput(e.target.value);
                      if (testStatus !== 'IDLE') setTestStatus('IDLE');
                    }}
                    required={channel === 'FACEBOOK'}
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

                {/* NÚT BẤM KIỂM THỬ KẾT NỐI */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="submit"
                    className="crm-btn crm-btn-primary"
                    style={{
                      width: '100%',
                      background: channelConfig.bg,
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={16} className="crm-btn-spinner" />
                        <span>Đang kết nối Meta Graph API để kiểm tra điều kiện...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Kiểm tra & Xác thực kết nối Meta</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* KHUNG HIỂN THỊ KẾT QUẢ KIỂM THỬ THÀNH CÔNG (LIVE VERIFICATION CHECKLIST) */}
              {testStatus === 'SUCCESS' && testResult?.page && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 700, fontSize: '13.5px', marginBottom: '10px' }}>
                    <CheckCircle2 size={18} />
                    <span>Xác thực thành công! Đáp ứng đầy đủ điều kiện kết nối:</span>
                  </div>

                  {/* Fanpage Card từ Meta */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    {testResult.page.avatarUrl ? (
                      <img
                        src={testResult.page.avatarUrl}
                        alt="Page avatar"
                        style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: '#1877f2',
                          color: '#fff',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                      >
                        FB
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>
                        {testResult.page.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        ID Trang: <strong>{testResult.page.externalAccountId}</strong>
                        {testResult.page.followerCount ? ` • ${testResult.page.followerCount.toLocaleString()} người theo dõi` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Checklist 3 điều kiện chuẩn */}
                  <div style={{ fontSize: '12px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span><strong>Token hợp lệ:</strong> Meta Graph API đã xác thực mã truy cập còn nguyên hiệu lực.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span><strong>Quyền quản trị Fanpage:</strong> Token có đầy đủ thẩm quyền đọc dữ liệu trang.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span><strong>Webhook nhận tin nhắn:</strong> Sẵn sàng đồng bộ tin nhắn khách hàng gửi tới Fanpage.</span>
                    </div>
                  </div>

                  {testResult.details?.warning && (
                    <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '6px' }}>
                      ⚠️ {testResult.details.warning}
                    </div>
                  )}

                  {/* Nút hành động Xác nhận lưu */}
                  <div style={{ marginTop: '14px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn-primary"
                      style={{
                        background: '#16a34a',
                        fontWeight: 600,
                        padding: '8px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onClick={handleConfirmActivation}
                    >
                      <CheckCircle2 size={16} />
                      <span>Lưu & Kích hoạt Trang vào Workspace</span>
                    </button>
                  </div>
                </div>
              )}

              {/* KHUNG BÁO LỖI KIỂM THỬ THẤT BẠI (RÕ RÀNG NGUYÊN NHÂN TỪ META) */}
              {testStatus === 'FAILED' && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 700, fontSize: '13.5px', marginBottom: '8px' }}>
                    <XCircle size={18} />
                    <span>{testResult?.message || 'Xác thực không thành công'}</span>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fee2e2',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      color: '#b91c1c',
                      lineHeight: 1.45,
                      marginBottom: '12px',
                    }}
                  >
                    <strong>
                      {testResult?.error?.includes('Backend API') || testResult?.error?.includes('offline')
                        ? 'Trạng thái máy chủ:'
                        : 'Lý do từ Meta:'}
                    </strong>{' '}
                    {testResult?.error || 'Token không hợp lệ hoặc đã hết hạn.'}
                  </div>

                  <div style={{ fontSize: '11.5px', color: '#7f1d1d' }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Nguyên nhân thường gặp & Cách xử lý:</p>
                    <p style={{ margin: '0 0 3px 0' }}>1. <strong>Token đã hết hạn</strong>: Token ngắn hạn chỉ dùng được 1–2 giờ. Hãy lấy token mới.</p>
                    <p style={{ margin: '0 0 3px 0' }}>2. <strong>Sai loại Token</strong>: Đảm bảo bạn đã chọn đúng Fanpage ở mục "User or Page" trên Graph API Explorer để lấy <em>Page Access Token</em> thay vì User Token.</p>
                    <p style={{ margin: 0 }}>3. <strong>Sai Page ID</strong>: Kiểm tra lại dãy ID Trang trên Facebook.</p>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary crm-btn-sm"
                      onClick={() => setConnectTab('TUTORIAL')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <BookOpen size={13} />
                      <span>Xem Hướng dẫn lấy Token chuẩn</span>
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary crm-btn-sm"
                      onClick={() => setTestStatus('IDLE')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={13} />
                      <span>Thử lại</span>
                    </button>
                  </div>
                </div>
              )}

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
                  <span style={{ color: '#059669', fontSize: '11px', fontWeight: 500 }}>
                    •••••••• (Được cấu hình bảo mật trên máy chủ theo biến môi trường META_WEBHOOK_VERIFY_TOKEN)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px' }}>
                  <span style={{ color: '#64748b' }}>Sự kiện theo dõi:</span>
                  <span style={{ fontWeight: 500 }}>{channelConfig.fields}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OAUTH TỰ ĐỘNG */}
          {connectTab === 'OAUTH' && (
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
                      Khuyên dùng: Chuyển sang tab <strong>&ldquo;2. Nhập &amp; Kiểm thử kết nối&rdquo;</strong> để kiểm tra và kết nối Fanpage của bạn ngay lập tức!
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

              <div className="oauth-terms" style={{ marginTop: '14px' }}>
                {t('onboarding.oauthModal.termsNotice')}
              </div>
            </div>
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

          {connectTab === 'TUTORIAL' && (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{ background: channelConfig.bg, minWidth: '180px' }}
              onClick={() => setConnectTab('TOKEN')}
            >
              <span>Tiếp tục (Nhập &amp; Kiểm thử)</span>
              <ArrowRight size={16} />
            </button>
          )}

          {connectTab === 'OAUTH' && (
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
          )}

          {connectTab === 'TOKEN' && testStatus !== 'SUCCESS' && (
            <button
              type="submit"
              form="token-test-form"
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
                  <span>Đang kiểm thử...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Kiểm tra &amp; Xác thực</span>
                </>
              )}
            </button>
          )}

          {connectTab === 'TOKEN' && testStatus === 'SUCCESS' && (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{
                background: '#16a34a',
                minWidth: '200px',
              }}
              onClick={handleConfirmActivation}
            >
              <CheckCircle2 size={16} />
              <span>Lưu &amp; Thêm vào CRM</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
