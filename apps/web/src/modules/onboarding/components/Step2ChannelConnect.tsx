import React, { useState } from 'react';
import {
  Share2,
  CheckCircle2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Users,
  AlertCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import type { ChannelKey, FanpageItem, DiscoveredPageDto } from '../types.js';
import { OAuthSimulationModal } from './OAuthSimulationModal.js';
import { useTranslation } from '../../../i18n/index.js';

export interface Step2ChannelConnectProps {
  connectedChannels: ChannelKey[];
  pages: FanpageItem[];
  onConnectChannel: (channel: ChannelKey, pages?: DiscoveredPageDto[]) => void;
  onTogglePage: (pageId: string) => void;
  onDisconnectPage?: (pageId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2ChannelConnect: React.FC<Step2ChannelConnectProps> = ({
  connectedChannels,
  pages,
  onConnectChannel,
  onTogglePage,
  onDisconnectPage,
  onNext,
  onBack,
}) => {
  const { t } = useTranslation();
  const [activeOAuthChannel, setActiveOAuthChannel] = useState<ChannelKey | null>(null);

  const channelsConfig: {
    key: ChannelKey;
    title: string;
    description: string;
    badge?: string;
    brandColor: string;
    gradient: string;
    iconText: string;
  }[] = [
    {
      key: 'FACEBOOK',
      title: 'Facebook Fanpage',
      description: t('onboarding.step2.channels.facebookDesc'),
      badge: t('onboarding.step2.popularBadge'),
      brandColor: '#1877F2',
      gradient: 'linear-gradient(135deg, #1877F2 0%, #0d5bbd 100%)',
      iconText: 'FB',
    },
    {
      key: 'ZALO',
      title: 'Zalo Official Account (OA)',
      description: t('onboarding.step2.channels.zaloDesc'),
      badge: t('onboarding.step2.highResponseBadge'),
      brandColor: '#0068FF',
      gradient: 'linear-gradient(135deg, #0068FF 0%, #004ecc 100%)',
      iconText: 'OA',
    },
    {
      key: 'TIKTOK',
      title: 'TikTok Shop / Messaging',
      description: t('onboarding.step2.channels.tiktokDesc'),
      brandColor: '#000000',
      gradient: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
      iconText: 'TT',
    },
    {
      key: 'INSTAGRAM',
      title: 'Instagram Direct',
      description: t('onboarding.step2.channels.instagramDesc'),
      brandColor: '#E1306C',
      gradient: 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
      iconText: 'IG',
    },
  ];

  const selectedPagesCount = pages.filter((p) => p.selected).length;

  return (
    <div className="onboarding-step-form">
      {/* Modal Kết nối Kênh Chuẩn hóa (OAuth + Nhập trực tiếp Page Token) */}
      {activeOAuthChannel && (
        <OAuthSimulationModal
          channel={activeOAuthChannel}
          isOpen={!!activeOAuthChannel}
          onClose={() => setActiveOAuthChannel(null)}
          onSuccess={(ch, discoveredPages) => onConnectChannel(ch, discoveredPages)}
        />
      )}

      <div className="onboarding-card-header">
        <div className="header-icon-wrapper" style={{ background: 'var(--gradient-indigo)' }}>
          <Share2 size={24} />
        </div>
        <div>
          <h2 className="onboarding-card-title">{t('onboarding.step2.title')}</h2>
          <p className="onboarding-card-desc">
            {t('onboarding.step2.desc')}
          </p>
        </div>
      </div>

      {/* Lưới các Card Kênh */}
      <div className="channel-cards-grid">
        {channelsConfig.map((ch) => {
          const isConnected = connectedChannels.includes(ch.key);
          const channelPages = pages.filter((p) => p.channel === ch.key);
          const activeCount = channelPages.filter((p) => p.selected).length;

          return (
            <div
              key={ch.key}
              className={`channel-card ${isConnected ? 'connected' : ''}`}
            >
              <div className="channel-card-top">
                <div
                  className="channel-avatar-circle"
                  style={{ background: ch.gradient, color: '#ffffff' }}
                >
                  {ch.iconText}
                </div>
                {ch.badge && !isConnected && (
                  <span className="channel-badge">{ch.badge}</span>
                )}
                {isConnected && (
                  <span className="channel-connected-pill">
                    <CheckCircle2 size={13} />
                    {t('common.connected')} ({activeCount} Page)
                  </span>
                )}
              </div>

              <h3 className="channel-name">{ch.title}</h3>
              <p className="channel-desc">{ch.description}</p>

              <div className="channel-card-action">
                {isConnected ? (
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary crm-btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => setActiveOAuthChannel(ch.key)}
                  >
                    <Plus size={14} />
                    {t('onboarding.step2.addAnotherPage')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary crm-btn-sm"
                    style={{
                      background: ch.gradient,
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    }}
                    onClick={() => setActiveOAuthChannel(ch.key)}
                  >
                    <ExternalLink size={14} />
                    {t('common.connectNow')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checklist Danh Sách Fanpage / Kênh Đã Kết Nối */}
      <div className="onboarding-fanpages-section">
        <div className="fanpages-header">
          <div>
            <h3 className="fanpages-title">
              {t('onboarding.step2.fanpagesFound')} ({pages.length})
            </h3>
            <p className="fanpages-subtitle">
              {t('onboarding.step2.fanpagesHint')}
            </p>
          </div>
          <span className="pages-selected-count">
            {t('onboarding.step2.activatedPages')}: <strong>{selectedPagesCount}</strong>
          </span>
        </div>

        {pages.length === 0 ? (
          <div className="empty-fanpages-box" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <AlertCircle size={28} className="empty-alert-icon" style={{ margin: '0 auto 10px auto', color: '#94a3b8' }} />
            <p className="empty-text" style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
              Chưa có tài khoản mạng xã hội nào được liên kết. Vui lòng bấm <strong>&ldquo;{t('common.connectNow')}&rdquo;</strong> ở các kênh phía trên để kết nối Fanpage hoặc Zalo OA thực tế của bạn.
            </p>
          </div>
        ) : (
          <div className="fanpages-list">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`fanpage-row ${page.selected ? 'active' : ''}`}
                onClick={() => onTogglePage(page.id)}
              >
                {page.avatarUrl ? (
                  <img
                    src={page.avatarUrl}
                    alt={page.name}
                    className="fanpage-avatar"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="fanpage-avatar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#e0f2fe',
                      color: '#0284c7',
                      fontWeight: 700,
                      fontSize: '12px',
                    }}
                  >
                    {page.channel === 'FACEBOOK' ? 'FB' : page.channel === 'ZALO' ? 'OA' : page.channel.slice(0, 2)}
                  </div>
                )}

                <div className="fanpage-info">
                  <div className="fanpage-name-row">
                    <span className="fanpage-name">{page.name}</span>
                    <span className={`fanpage-channel-tag ${page.channel.toLowerCase()}`}>
                      {page.channel}
                    </span>
                  </div>
                  <div className="fanpage-meta">
                    <span>{page.category || `Kênh ${page.channel}`}</span>
                    {page.followerCount ? (
                      <>
                        <span>•</span>
                        <span className="fanpage-followers">
                          <Users size={12} />
                          {page.followerCount.toLocaleString()} {t('onboarding.step2.followers')}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                  {/* Switch Toggle Bật/Tắt đồng bộ tin nhắn */}
                  <div className="fanpage-toggle-wrapper">
                    <label className="crm-switch" title={page.selected ? 'Đang bật nhận tin nhắn' : 'Đang tạm dừng nhận tin nhắn'}>
                      <input
                        type="checkbox"
                        checked={page.selected}
                        onChange={() => onTogglePage(page.id)}
                      />
                      <span className="crm-slider round"></span>
                    </label>
                  </div>

                  {/* Nút Ngắt kết nối kênh khỏi hệ thống */}
                  {onDisconnectPage && (
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary crm-btn-sm"
                      style={{
                        padding: '4px 8px',
                        color: '#ef4444',
                        borderColor: '#fecaca',
                        background: '#fff5f5',
                      }}
                      title="Ngắt kết nối trang này khỏi Workspace"
                      onClick={() => onDisconnectPage(page.id)}
                    >
                      <Trash2 size={13} />
                      <span style={{ fontSize: '11px' }}>Ngắt</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="onboarding-card-footer split-footer">
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          <span>{t('onboarding.step2.backBtn')}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="crm-btn crm-btn-secondary skip-btn"
            onClick={onNext}
            title="Bỏ qua bước kết nối và thiết lập sau"
          >
            <span>Bỏ qua (Skip)</span>
          </button>

          <button
            type="button"
            className="crm-btn crm-btn-primary crm-btn-gradient-primary continue-btn"
            style={{ minWidth: '180px' }}
            onClick={onNext}
          >
            <span>{t('onboarding.step2.continueBtn')}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
