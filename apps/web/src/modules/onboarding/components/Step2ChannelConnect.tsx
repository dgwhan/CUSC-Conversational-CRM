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
} from 'lucide-react';
import type { ChannelKey, FanpageItem, DiscoveredPageDto } from '../types.js';
import { OAuthSimulationModal } from './OAuthSimulationModal.js';
import { useTranslation } from '../../../i18n/index.js';

export interface Step2ChannelConnectProps {
  connectedChannels: ChannelKey[];
  pages: FanpageItem[];
  onConnectChannel: (channel: ChannelKey, pages?: DiscoveredPageDto[]) => void;
  onTogglePage: (pageId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2ChannelConnect: React.FC<Step2ChannelConnectProps> = ({
  connectedChannels,
  pages,
  onConnectChannel,
  onTogglePage,
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
      {/* Modal Giả lập OAuth Cấp Quyền */}
      {activeOAuthChannel && (
        <OAuthSimulationModal
          channel={activeOAuthChannel}
          isOpen={!!activeOAuthChannel}
          onClose={() => setActiveOAuthChannel(null)}
          onSuccess={(ch, pages) => onConnectChannel(ch, pages)}
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

      {/* Checklist Danh Sách Fanpage Đã Cấp Quyền */}
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
          <div className="empty-fanpages-box">
            <AlertCircle size={24} className="empty-alert-icon" />
            <p className="empty-text">
              {t('onboarding.step2.noPagesYet')}
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
                <img
                  src={page.avatarUrl}
                  alt={page.name}
                  className="fanpage-avatar"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="fanpage-info">
                  <div className="fanpage-name-row">
                    <span className="fanpage-name">{page.name}</span>
                    <span className={`fanpage-channel-tag ${page.channel.toLowerCase()}`}>
                      {page.channel}
                    </span>
                  </div>
                  <div className="fanpage-meta">
                    <span>{page.category}</span>
                    <span>•</span>
                    <span className="fanpage-followers">
                      <Users size={12} />
                      {page.followerCount.toLocaleString()} {t('onboarding.step2.followers')}
                    </span>
                  </div>
                </div>

                {/* Switch Toggle */}
                <div className="fanpage-toggle-wrapper" onClick={(e) => e.stopPropagation()}>
                  <label className="crm-switch">
                    <input
                      type="checkbox"
                      checked={page.selected}
                      onChange={() => onTogglePage(page.id)}
                    />
                    <span className="crm-slider round"></span>
                  </label>
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
          <ArrowLeft size={18} />
          <span>{t('onboarding.step2.backBtn')}</span>
        </button>

        <button
          type="button"
          className="crm-btn crm-btn-primary crm-btn-gradient-primary"
          style={{ minWidth: '220px' }}
          onClick={onNext}
        >
          <span>{t('onboarding.step2.continueBtn')}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
