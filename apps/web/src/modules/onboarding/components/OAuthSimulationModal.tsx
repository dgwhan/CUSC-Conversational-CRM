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
  QrCode,
  ShieldAlert,
  Smartphone,
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

  // Trạng thái kiểm thử gửi tin nhắn Outbound (Test gửi tin qua Zalo / Facebook)
  const [testRecipientId, setTestRecipientId] = useState('');
  const [testMessageText, setTestMessageText] = useState(
    'Xin chào! Đây là tin nhắn thử nghiệm gửi từ hệ thống CRM qua Zalo Official Account API.',
  );
  const [isSendingTestMessage, setIsSendingTestMessage] = useState(false);
  const [testMessageResult, setTestMessageResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  // ZCA Personal QR Login state
  const [qrSession, setQrSession] = useState<{
    sessionId: string;
    qrCodeUrl: string;
    status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED';
    expiresAt: number;
    account?: {
      id: string;
      externalAccountId: string;
      displayName: string;
      avatarUrl: string;
      phone?: string;
      accessToken: string;
    };
  } | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(120);

  // Safety Rate Limiting config state (Chống khóa nick Zalo)
  const [safetyConfig] = useState({
    enabled: true,
    minIntervalMs: 2500, // 2.5s
    maxIntervalMs: 4500, // 4.5s
    maxMessagesPerMinute: 15, // Tối đa 15 tin / phút
    maxStrangerPerDay: 40, // Tối đa 40 người lạ / ngày
    autoCooldownMinutes: 15,
  });

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

  // Đếm ngược thời gian hiệu lực của mã QR zca-js
  useEffect(() => {
    if (!qrSession || qrSession.status === 'SUCCESS' || qrSession.status === 'EXPIRED') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((qrSession.expiresAt - Date.now()) / 1000));
      setQrCountdown(remaining);
      if (remaining === 0) {
        setQrSession((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null));
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [qrSession]);

  // Tự động Polling kiểm tra trạng thái quét mã QR thật từ Zalo Web theo thời gian thực (mỗi 2s)
  useEffect(() => {
    if (!qrSession || qrSession.status === 'SUCCESS' || qrSession.status === 'EXPIRED') return;

    const pollInterval = setInterval(async () => {
      try {
        const latest = await apiClient.getZaloPersonalQrStatus(qrSession.sessionId);
        if (latest && latest.status !== qrSession.status) {
          setQrSession(latest as any);
          if (latest.status === 'SCANNED') {
            notify.info('Đã quét mã! Vui lòng bấm "Đăng nhập" trên ứng dụng Zalo trên điện thoại.');
          } else if (latest.status === 'SUCCESS') {
            notify.success(
              `Đăng nhập Zalo cá nhân "${latest.account?.displayName || ''}" thành công!`,
            );
          } else if (latest.status === 'EXPIRED') {
            notify.warning('Mã QR Zalo đã hết hạn. Vui lòng bấm tạo lại mã mới.');
          }
        }
      } catch {
        // Bỏ qua lỗi tạm thời khi polling mạng
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [qrSession]);

  // Tạo phiên quét mã QR Đăng nhập Zalo cá nhân qua zca-js
  const handleGenerateZcaQr = async () => {
    setIsGeneratingQr(true);
    try {
      const res = await apiClient.initZaloPersonalQr();
      setQrSession(res);
      setQrCountdown(Math.max(1, Math.round((res.expiresAt - Date.now()) / 1000)));
      setIsGeneratingQr(false);
      notify.info('Đã tạo mã QR Zalo thật! Mở ứng dụng Zalo trên điện thoại để quét mã.');
    } catch (err) {
      setIsGeneratingQr(false);
      notify.error(`Không thể tạo mã QR Zalo: ${(err as Error).message}`);
    }
  };

  // Xác nhận lưu tài khoản sau khi quét mã thành công
  const handleConfirmZcaQr = async () => {
    if (!qrSession) return;
    try {
      const res = await apiClient.confirmZaloPersonalQr({
        sessionId: qrSession.sessionId,
      });
      setQrSession(res as any);
      notify.success('Đã xác thực phiên đăng nhập Zalo cá nhân thành công!');
    } catch (err) {
      notify.error(`Lỗi xác nhận: ${(err as Error).message}`);
    }
  };

  // Lưu tài khoản Zalo cá nhân vào Workspace
  const handleActivateZcaAccount = () => {
    if (!qrSession?.account) {
      notify.warning('Chưa có phiên đăng nhập Zalo cá nhân hợp lệ.');
      return;
    }

    const personalAccount: DiscoveredPageDto = {
      id: qrSession.account.id,
      externalAccountId: qrSession.account.externalAccountId,
      name: qrSession.account.displayName,
      category: 'Zalo Cá nhân',
      avatarUrl: qrSession.account.avatarUrl,
      channel: 'ZALO',
      accessToken: qrSession.account.accessToken,
      isVerified: true,
      metadata: {
        isPersonal: true,
        engine: 'zca-js',
        phone: qrSession.account.phone,
        safetyConfig,
      },
    };

    notify.success(`Đã thêm Zalo cá nhân "${qrSession.account.displayName}" vào Workspace!`);
    onSuccess(channel, [personalAccount]);
    onClose();
  };

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
        'Truy cập thông tin Official Account (Tên, Ảnh đại diện - scope oa.info)',
        'Nhận tin nhắn người quan tâm gửi đến OA qua Webhook (user_send_text, user_send_image)',
        'Gửi tin nhắn phản hồi trực tiếp cho khách hàng (scope oa.customer_support, oa.message)',
        'Đọc danh sách và tương tác khách hàng tiềm năng',
      ],
      notice: 'Lấy Access Token từ Zalo for Developers (Công cụ & Kiểm thử -> API Explorer).',
      pageIdLabel: 'OA ID (Official Account ID)',
      pageIdPlaceholder: 'Ví dụ: 3141592653589793 (Tự động nhận diện từ Token nếu để trống)',
      tokenLabel: 'Zalo Access Token',
      tokenPlaceholder: 'Dán chuỗi Access Token từ Zalo for Developers (API Explorer)',
      tokenHint: 'Lấy từ Zalo for Developers (developers.zalo.me) -> Công cụ & Kiểm thử -> API Explorer với đủ scope.',
      webhookEndpoint: '/api/webhook/zalo',
      fields: 'user_send_text, user_send_image, oa_send_text',
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

  // Thực thi kiểm thử kết nối thực tế với máy chủ Zalo OpenAPI / Meta Graph API
  const handleRunConnectionTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (channel === 'FACEBOOK' && !pageIdInput.trim()) {
      notify.warning('Vui lòng nhập ID Trang Fanpage (Page ID) để kiểm thử.');
      return;
    }

    if (channel === 'FACEBOOK' && !accessTokenInput.trim()) {
      notify.warning('Vui lòng nhập Page Access Token (bắt đầu bằng EAA...) để kiểm thử kết nối.');
      return;
    }

    if (channel === 'ZALO' && !accessTokenInput.trim()) {
      notify.warning('Vui lòng nhập Zalo Access Token được cấp từ Zalo for Developers (API Explorer) để kiểm thử.');
      return;
    }

    setTestStatus('TESTING');
    setIsProcessing(true);
    setTestResult(null);
    setTestMessageResult(null);

    try {
      const result = await apiClient.exchangeOAuthToken(channel, {
        pageId: pageIdInput.trim() || undefined,
        pageName: pageNameInput.trim() || undefined,
        accessToken: accessTokenInput.trim() || undefined,
      });

      setIsProcessing(false);

      if (result.pages && result.pages.length > 0) {
        const verifiedPage = result.pages[0];
        const channelLabel = channel === 'ZALO' ? 'Zalo Official Account' : 'Fanpage';
        setTestStatus('SUCCESS');
        setTestResult({
          success: true,
          message:
            (result as any).testResult?.message ||
            `Xác thực thành công ${channelLabel} "${verifiedPage.name}"!`,
          page: verifiedPage as DiscoveredPageDto,
          details: (result as any).testResult?.details,
        });
        notify.success(`Đã kiểm thử và xác thực thành công ${channelLabel} "${verifiedPage.name}"!`);
      } else {
        setTestStatus('FAILED');
        setTestResult({
          success: false,
          message: `Không tìm thấy thông tin tài khoản từ ${channel === 'ZALO' ? 'Zalo' : 'Meta'}.`,
          error:
            channel === 'ZALO'
              ? 'Zalo OpenAPI không trả về Official Account nào. Vui lòng kiểm tra lại Token hoặc cấp quyền scope oa.info trên developers.zalo.me.'
              : 'Meta Graph API không trả về trang nào. Vui lòng kiểm tra lại quyền quản trị của tài khoản.',
        });
        notify.error('Xác thực thất bại. Vui lòng kiểm tra lại Token và quyền hạn.');
      }
    } catch (err) {
      setIsProcessing(false);
      setTestStatus('FAILED');
      const errorMsg =
        (err as Error).message ||
        `Không thể xác thực với máy chủ ${channel === 'ZALO' ? 'Zalo OpenAPI' : 'Meta Facebook'}`;
      setTestResult({
        success: false,
        message: 'Kiểm thử kết nối không thành công',
        error: errorMsg,
      });
      notify.error(`Xác thực thất bại: ${errorMsg}`);
    }
  };

  // Gửi tin nhắn thử nghiệm (Test Outbound Message)
  const handleSendTestMessage = async () => {
    if (!testRecipientId.trim()) {
      notify.warning(
        channel === 'ZALO'
          ? 'Vui lòng nhập Zalo User ID của người nhận để thử nghiệm gửi tin.'
          : 'Vui lòng nhập ID người nhận để thử nghiệm gửi tin.',
      );
      return;
    }

    if (!testMessageText.trim()) {
      notify.warning('Vui lòng nhập nội dung tin nhắn thử nghiệm.');
      return;
    }

    setIsSendingTestMessage(true);
    setTestMessageResult(null);

    try {
      const res = await apiClient.sendMessage({
        channel,
        recipientId: testRecipientId.trim(),
        content: testMessageText.trim(),
        channelAccountId: testResult?.page?.externalAccountId,
      });

      setIsSendingTestMessage(false);
      setTestMessageResult({
        success: true,
        message: `Đã gửi tin thành công qua ${channel === 'ZALO' ? 'Zalo OA API' : channel}! Mã tin nhắn: ${res.messageId}`,
        messageId: res.messageId,
      });
      notify.success(`Đã gửi tin nhắn thử nghiệm thành công! (Mã: ${res.messageId})`);
    } catch (err) {
      setIsSendingTestMessage(false);
      const errMsg = (err as Error).message || 'Gửi tin nhắn thất bại';
      setTestMessageResult({
        success: false,
        message: errMsg,
      });
      notify.error(`Gửi tin nhắn thử nghiệm thất bại: ${errMsg}`);
    }
  };

  // Xác nhận lưu trang sau khi kiểm thử ĐẠT ĐIỀU KIỆN
  const handleConfirmActivation = () => {
    if (!testResult?.page) {
      notify.warning('Chưa có dữ liệu tài khoản được xác thực hợp lệ.');
      return;
    }

    const channelLabel = channel === 'ZALO' ? 'Zalo Official Account' : 'Fanpage';
    notify.success(`Đã thêm ${channelLabel} "${testResult.page.name}" vào danh sách kích hoạt của Workspace!`);
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
            {channel === 'ZALO' ? <QrCode size={14} /> : <Globe size={14} />}
            <span>{channel === 'ZALO' ? '3. Zalo Cá nhân (QR)' : '3. Đăng nhập OAuth'}</span>
            {channel === 'ZALO' && qrSession?.status === 'SUCCESS' && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            )}
          </button>
        </div>

        {/* Body Modal */}
        <div className="crm-oauth-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px' }}>
          {/* TAB 1: TUTORIAL LẤY TOKEN */}
          {connectTab === 'TUTORIAL' && (
            <div>
              {channel === 'ZALO' ? (
                /* HƯỚNG DẪN DÀNH CHO ZALO OFFICIAL ACCOUNT (OA) */
                <div>
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '12.5px',
                      color: '#1e40af',
                    }}
                  >
                    <strong>🎯 Mục tiêu:</strong> Để CRM tự động nhận tin nhắn từ Zalo của khách hàng và gửi phản hồi từ tư vấn viên, bạn cần <strong>OA ID</strong> và <strong>Access Token</strong> được cấp từ công cụ <strong>Zalo for Developers</strong>.
                  </div>

                  {/* Bước 1 Zalo */}
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
                      <span>Lấy Official Account ID (OA ID)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                      <p style={{ margin: '0 0 6px 0' }}>
                        • Đăng nhập trang quản trị Zalo OA:{' '}
                        <a
                          href="https://oa.zalo.me/manage"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0068FF', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          oa.zalo.me/manage <ExternalLink size={12} />
                        </a>
                      </p>
                      <p style={{ margin: '0 0 6px 0' }}>• Chọn Official Account bạn đang quản lý.</p>
                      <p style={{ margin: '0 0 6px 0' }}>• Vào menu <strong>Quản lý</strong> → <strong>Thông tin tài khoản</strong> → Sao chép dòng <strong>Official Account ID</strong> (dãy 18 chữ số, ví dụ: <code>3141592653589793</code>).</p>
                      <p style={{ margin: 0, color: '#059669', fontWeight: 500 }}>
                        💡 <em>Mẹo: Nếu bạn để trống ô OA ID ở bước sau, hệ thống CRM vẫn có thể tự động truy xuất OA ID từ Token qua Zalo OpenAPI!</em>
                      </p>
                    </div>
                  </div>

                  {/* Bước 2 Zalo */}
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
                      <span>Lấy Access Token từ Công cụ Developer (Zalo for Developers)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                      <p style={{ margin: '0 0 8px 0' }}>
                        Mở công cụ chính thức của Zalo:{' '}
                        <a
                          href="https://developers.zalo.me/tools/explorer"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0068FF', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          Mở Zalo API Explorer <ExternalLink size={12} />
                        </a>
                      </p>
                      <p style={{ margin: '0 0 6px 0' }}>• Tại mục <strong>Ứng dụng & Official Account</strong>: Chọn App và OA cần kết nối.</p>
                      <p style={{ margin: '0 0 6px 0' }}>• Tại mục <strong>Phạm vi quyền (Scopes)</strong>: Tích chọn đủ các quyền sau:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '6px 0 8px 0' }}>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>oa.message (Gửi & nhận tin)</code>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>oa.customer_support (CSKH)</code>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>oa.info (Tên & ảnh đại diện)</code>
                      </div>
                      <p style={{ margin: '0 0 6px 0' }}>• Nhấp nút <strong>Lấy Access Token</strong> $\rightarrow$ Xác nhận cấp quyền và sao chép chuỗi token vừa tạo.</p>
                    </div>
                  </div>

                  {/* Bước 3 Zalo */}
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
                      <span>Cài đặt Webhook nhận tin nhắn tự động từ Zalo</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginLeft: '30px' }}>
                      <p style={{ margin: '0 0 6px 0' }}>• Trên Zalo for Developers $\rightarrow$ Vào App của bạn $\rightarrow$ Menu <strong>Webhook</strong>.</p>
                      <p style={{ margin: '0 0 6px 0' }}>
                        • Điền Webhook URL:{' '}
                        <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#0f172a', fontWeight: 600 }}>
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/zalo` : '/api/webhook/zalo'}
                        </code>
                      </p>
                      <p style={{ margin: '0 0 4px 0' }}>• Bật theo dõi sự kiện: <code>user_send_text</code>, <code>user_send_image</code> và bấm <strong>Lưu</strong>.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* HƯỚNG DẪN DÀNH CHO FACEBOOK FANPAGE */
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
                    <strong>🎯 Mục tiêu:</strong> Để CRM tự động nhận tin nhắn từ Facebook khách hàng gửi đến Fanpage, bạn cần <strong>Page ID</strong> và <strong>Page Access Token</strong> có quyền nhận tin nhắn (<code>pages_messaging</code>).
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
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  style={{
                    background: channelConfig.bg,
                    minWidth: '240px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onClick={() => setConnectTab('TOKEN')}
                >
                  <span>Tôi đã có ID &amp; Token ➔ Tiến hành Kiểm thử kết nối</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: NHẬP VÀ KIỂM THỬ KẾT NỐI */}
          {connectTab === 'TOKEN' && (
            <div>
              <form id="token-test-form" onSubmit={handleRunConnectionTest}>
                {/* ID Trang / OA ID */}
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
                    {channelConfig.pageIdLabel}{' '}
                    {channel === 'FACEBOOK' ? (
                      <span style={{ color: '#ef4444' }}>*</span>
                    ) : (
                      <span style={{ color: '#64748b', fontWeight: 'normal', fontSize: '11px' }}>(Tùy chọn)</span>
                    )}
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
                    required={channel === 'FACEBOOK'}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                    {channel === 'ZALO'
                      ? 'Mã Official Account ID (dãy 18 số). Có thể để trống nếu đã nhập Token (CRM sẽ tự động truy xuất từ Zalo OpenAPI).'
                      : 'Dãy số định danh Fanpage từ Facebook (Ví dụ: 102938475610293).'}
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
                    Tên gợi nhớ {channel === 'ZALO' ? 'Official Account' : 'Trang'} (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={
                      channel === 'ZALO'
                        ? 'Tự động lấy tên Official Account chính thức từ Zalo OpenAPI nếu để trống'
                        : 'Tự động lấy tên chính thức từ Meta Graph API nếu để trống'
                    }
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
                    required={channel === 'FACEBOOK' || channel === 'ZALO'}
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
                        <span>
                          {channel === 'ZALO'
                            ? 'Đang kết nối Zalo OpenAPI để kiểm tra và lấy thông tin OA...'
                            : 'Đang kết nối Meta Graph API để kiểm tra điều kiện...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>
                          {channel === 'ZALO'
                            ? 'Kiểm tra kết nối (Lấy Tên & Ảnh đại diện Zalo OA)'
                            : 'Kiểm tra & Xác thực kết nối Meta'}
                        </span>
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
                    <span>
                      Xác thực thành công! Đáp ứng đầy đủ điều kiện kết nối {channel === 'ZALO' ? 'Zalo Official Account' : 'Fanpage'}:
                    </span>
                  </div>

                  {/* Card thông tin tài khoản kết nối (Lấy Tên và Ảnh đại diện) */}
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
                        alt="Channel avatar"
                        style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0068FF' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: channel === 'ZALO' ? '#0068FF' : '#1877f2',
                          color: '#fff',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                        }}
                      >
                        {channel === 'ZALO' ? 'OA' : 'FB'}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '14.5px' }}>
                          {testResult.page.name}
                        </span>
                        {testResult.page.isVerified && (
                          <span
                            style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              fontSize: '10.5px',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              fontWeight: 600,
                            }}
                          >
                            ✓ Đã xác thực
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        {channel === 'ZALO' ? 'OA ID: ' : 'ID Trang: '}
                        <strong>{testResult.page.externalAccountId}</strong>
                        {testResult.page.followerCount ? ` • ${testResult.page.followerCount.toLocaleString()} người quan tâm/theo dõi` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Checklist 3 điều kiện chuẩn */}
                  <div style={{ fontSize: '12px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span>
                        <strong>Token hợp lệ:</strong>{' '}
                        {channel === 'ZALO'
                          ? 'Máy chủ Zalo Open Platform xác thực Access Token còn nguyên hiệu lực.'
                          : 'Meta Graph API đã xác thực mã truy cập còn nguyên hiệu lực.'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span>
                        <strong>Quyền quản trị {channel === 'ZALO' ? 'Official Account' : 'Fanpage'}:</strong>{' '}
                        Token có đầy đủ thẩm quyền đọc dữ liệu tài khoản "{testResult.page.name}".
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span>
                        <strong>Sẵn sàng Nhận &amp; Gửi tin:</strong> Sẵn sàng nhận tin qua Webhook{' '}
                        <code>{channelConfig.webhookEndpoint}</code> và gửi tin phản hồi khách hàng qua Open API.
                      </span>
                    </div>
                  </div>

                  {testResult.details?.warning && (
                    <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '6px' }}>
                      ⚠️ {testResult.details.warning}
                    </div>
                  )}

                  {/* KHUNG THỬ NGHIỆM GỬI TIN NHẮN (TEST OUTBOUND MESSAGE) */}
                  <div
                    style={{
                      marginTop: '14px',
                      background: '#ffffff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        color: '#1e40af',
                        marginBottom: '8px',
                      }}
                    >
                      <Webhook size={14} />
                      <span>Thử nghiệm gửi tin nhắn {channel === 'ZALO' ? 'Zalo OA' : channel}:</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '3px', fontWeight: 500 }}>
                          {channel === 'ZALO' ? 'Zalo User ID người nhận:' : 'ID người nhận:'}
                        </label>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          placeholder={channel === 'ZALO' ? 'Ví dụ: 82947192841' : 'ID khách hàng'}
                          value={testRecipientId}
                          onChange={(e) => setTestRecipientId(e.target.value)}
                          style={{ width: '100%', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '3px', fontWeight: 500 }}>
                          Nội dung tin nhắn thử:
                        </label>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          value={testMessageText}
                          onChange={(e) => setTestMessageText(e.target.value)}
                          style={{ width: '100%', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                        {channel === 'ZALO'
                          ? 'Ghi chú: Zalo quy định OA gửi tin CSKH cho người dùng đã gửi tin cho OA trong 7 ngày.'
                          : ''}
                      </span>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary crm-btn-sm"
                        onClick={handleSendTestMessage}
                        disabled={isSendingTestMessage}
                        style={{
                          borderColor: '#2563eb',
                          color: '#1d4ed8',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 12px',
                          fontSize: '11.5px',
                        }}
                      >
                        {isSendingTestMessage ? <Loader2 size={13} className="crm-btn-spinner" /> : <ArrowRight size={13} />}
                        <span>Gửi tin thử nghiệm</span>
                      </button>
                    </div>
                    {testMessageResult && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          background: testMessageResult.success ? '#f0fdf4' : '#fef2f2',
                          color: testMessageResult.success ? '#15803d' : '#b91c1c',
                          border: `1px solid ${testMessageResult.success ? '#bbf7d0' : '#fecaca'}`,
                        }}
                      >
                        {testMessageResult.success ? '✅ ' : '❌ '}
                        {testMessageResult.message}
                      </div>
                    )}
                  </div>

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

          {/* TAB 3: OAUTH HOẶC ZALO CÁ NHÂN (ZCA-JS QR LOGIN) */}
          {connectTab === 'OAUTH' && (
            <div>
              {channel === 'ZALO' ? (
                /* GIAO DIỆN ZALO CÁ NHÂN QUA ZCA-JS & GIỚI HẠN TẦN SUẤT CHỐNG KHÓA NICK */
                <div>
                  {/* Banner giải pháp */}
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '12.5px',
                      color: '#166534',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                      <Smartphone size={16} style={{ color: '#16a34a' }} />
                      <span>Giải pháp Không cần OA: Liên kết nick Zalo cá nhân qua zca-js</span>
                    </div>
                    <div>
                      Dành cho cá nhân hoặc nhân viên tư vấn chưa có tài khoản OA Doanh nghiệp. Quét mã QR bằng ứng dụng Zalo trên điện thoại để CRM đồng bộ tin nhắn cá nhân vào Hộp thư.
                    </div>
                  </div>

                  {/* KHUNG QUÉT MÃ QR (ZCA-JS QR LOGIN) */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {!qrSession ? (
                      <div>
                        <div style={{ margin: '16px 0', color: '#64748b', fontSize: '13px' }}>
                          Nhấp nút bên dưới để sinh mã QR phiên đăng nhập Zalo Web:
                        </div>
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          onClick={handleGenerateZcaQr}
                          disabled={isGeneratingQr}
                          style={{
                            background: '#0068FF',
                            fontWeight: 600,
                            padding: '10px 20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {isGeneratingQr ? <Loader2 size={16} className="crm-btn-spinner" /> : <QrCode size={16} />}
                          <span>Tạo mã QR Đăng nhập Zalo</span>
                        </button>
                      </div>
                    ) : qrSession.status === 'SUCCESS' && qrSession.account ? (
                      /* Đăng nhập thành công */
                      <div style={{ textAlign: 'left' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#15803d',
                            fontWeight: 700,
                            fontSize: '14px',
                            marginBottom: '12px',
                          }}
                        >
                          <CheckCircle2 size={18} />
                          <span>Đã xác thực và kết nối tài khoản Zalo cá nhân thành công!</span>
                        </div>
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <img
                            src={qrSession.account.avatarUrl}
                            alt="Zalo Avatar"
                            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0068FF' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14.5px' }}>
                              {qrSession.account.displayName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              SĐT: <strong>{qrSession.account.phone}</strong> • ID: <code>{qrSession.account.externalAccountId}</code>
                            </div>
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '4px',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: '11px',
                                padding: '1px 7px',
                                borderRadius: '10px',
                                fontWeight: 600,
                              }}
                            >
                              Giao thức: zca-js Engine (Zalo Web)
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : qrSession.status === 'EXPIRED' ? (
                      /* Mã QR hết hạn */
                      <div>
                        <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                          Mã QR đã hết hạn (quá 120 giây).
                        </div>
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary crm-btn-sm"
                          onClick={handleGenerateZcaQr}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RefreshCw size={13} />
                          <span>Tạo lại mã QR mới</span>
                        </button>
                      </div>
                    ) : (
                      /* Đang chờ quét mã QR */
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px', marginBottom: '4px' }}>
                          Quét mã QR bằng ứng dụng Zalo trên điện thoại
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '12px' }}>
                          Mở Zalo → Chọn biểu tượng Quét mã QR ở góc trên → Hướng vào mã bên dưới
                        </div>

                        {/* Hình ảnh QR Code SVG */}
                        <div style={{ display: 'inline-block', padding: '8px', background: '#ffffff', border: '1.5px solid #0068FF', borderRadius: '12px' }}>
                          <img
                            src={qrSession.qrCodeUrl}
                            alt="Zalo Login QR Code"
                            style={{ width: '180px', height: '180px', display: 'block' }}
                          />
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                          ⏱️ Mã còn hiệu lực trong: {qrCountdown}s
                        </div>

                        {/* Trạng thái xác thực theo thời gian thực từ Zalo Web */}
                        {qrSession.status === 'SCANNED' ? (
                          <div
                            style={{
                              marginTop: '12px',
                              background: '#f0fdf4',
                              border: '1.5px solid #86efac',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              color: '#15803d',
                              fontSize: '12.5px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                            }}
                          >
                            <Loader2 size={16} className="crm-btn-spinner" />
                            <span>
                              Đã quét mã! Vui lòng bấm <strong>"Đăng nhập"</strong> trên ứng dụng Zalo điện thoại để hoàn tất.
                            </span>
                            <button
                              type="button"
                              onClick={handleConfirmZcaQr}
                              className="crm-btn crm-btn-sm"
                              style={{ marginLeft: '8px', padding: '3px 8px', fontSize: '11px', background: '#16a34a', color: '#fff' }}
                            >
                              Xác nhận ngay
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: '10px',
                              fontSize: '12px',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <Loader2 size={13} className="crm-btn-spinner" />
                            <span>Đang chờ bạn quét mã bằng ứng dụng Zalo trên điện thoại...</span>
                          </div>
                        )}

                        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="crm-btn crm-btn-secondary crm-btn-sm"
                            onClick={handleGenerateZcaQr}
                            disabled={isGeneratingQr}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {isGeneratingQr ? <Loader2 size={13} className="crm-btn-spinner" /> : <RefreshCw size={13} />}
                            <span>Làm mới mã QR</span>
                          </button>
                          <a
                            href="https://chat.zalo.me"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="crm-btn crm-btn-secondary crm-btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: '#0068FF' }}
                          >
                            <ExternalLink size={13} />
                            <span>Mở Zalo Web (chat.zalo.me)</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KHUNG CẤU HÌNH AN TOÀN & GIỚI HẠN TẦN SUẤT (ANTI-BAN RATE LIMITER) */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        <ShieldAlert size={16} style={{ color: '#0284c7' }} />
                        <span>Cơ chế An toàn Chống khóa nick Zalo (Anti-Ban Guard)</span>
                      </div>
                      <span
                        style={{
                          background: safetyConfig.enabled ? '#dcfce7' : '#fee2e2',
                          color: safetyConfig.enabled ? '#15803d' : '#b91c1c',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {safetyConfig.enabled ? '● Đang kích hoạt' : '○ Tắt bảo vệ'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <Check size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Giãn cách gõ phím ngẫu nhiên (Human Typing Delay):</strong> Tự động tạo khoảng nghỉ ngẫu nhiên từ <strong>2.5s – 4.5s</strong> giữa 2 tin nhắn liên tiếp để mô phỏng hành vi gõ thật, ngăn thuật toán Zalo nhận diện là bot.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <Check size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Giới hạn tốc độ gửi (Rate Limit):</strong> Tối đa <strong>{safetyConfig.maxMessagesPerMinute} tin nhắn / phút</strong>. Khi vượt ngưỡng, hệ thống sẽ tạm dừng gửi để tránh bị Zalo đưa vào danh sách kiểm duyệt spam.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <Check size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Hạn mức người lạ (Stranger Quota):</strong> Tối đa <strong>{safetyConfig.maxStrangerPerDay} cuộc trò chuyện người mới / ngày</strong> để nick không bị khóa tính năng nhắn tin cho người chưa kết bạn.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <Check size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Tự động làm mát (Auto Cooldown):</strong> Tạm dừng gửi <strong>{safetyConfig.autoCooldownMinutes} phút</strong> ngay khi phát hiện cảnh báo hoặc mã lỗi nghi ngờ từ máy chủ Zalo.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* GIAO DIỆN OAUTH DÀNH CHO FACEBOOK HOẶC CÁC KÊNH KHÁC */
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

          {connectTab === 'OAUTH' && channel === 'ZALO' && qrSession?.status === 'SUCCESS' && (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{ background: '#16a34a', minWidth: '220px' }}
              onClick={handleActivateZcaAccount}
            >
              <CheckCircle2 size={16} />
              <span>Lưu &amp; Kích hoạt Zalo Cá nhân vào CRM</span>
            </button>
          )}

          {connectTab === 'OAUTH' && channel === 'ZALO' && qrSession?.status !== 'SUCCESS' && (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{ background: '#0068FF', minWidth: '200px' }}
              onClick={handleGenerateZcaQr}
              disabled={isGeneratingQr}
            >
              {isGeneratingQr ? (
                <>
                  <Loader2 size={16} className="crm-btn-spinner" />
                  <span>Đang sinh mã QR...</span>
                </>
              ) : (
                <>
                  <QrCode size={16} />
                  <span>{qrSession ? 'Làm mới mã QR' : 'Tạo mã QR Đăng nhập'}</span>
                </>
              )}
            </button>
          )}

          {connectTab === 'OAUTH' && channel !== 'ZALO' && (
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
