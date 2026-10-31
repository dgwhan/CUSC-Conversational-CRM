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
  RefreshCw,
} from 'lucide-react';
import type { ChannelKey, FanpageItem, DiscoveredPageDto } from '../../types.js';
import { OAuthSimulationModal } from '../OAuthSimulationModal.js';
import { useTranslation } from '../../../../i18n/index.js';
import { apiClient } from '../../../../lib/api-client.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

export interface ChannelConnectStepProps {
  connectedChannels: ChannelKey[];
  pages: FanpageItem[];
  onConnectChannel: (channel: ChannelKey, pages?: DiscoveredPageDto[]) => void;
  onTogglePage: (pageId: string) => void;
  onDisconnectPage?: (pageId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Bước 2: Kết nối các kênh mạng xã hội & hội thoại (Facebook, Zalo OA, TikTok, Instagram...)
 */
export const ChannelConnectStep: React.FC<ChannelConnectStepProps> = ({
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
  const [syncingPageId, setSyncingPageId] = useState<string | null>(null);

  const handleSyncMessages = async (pageId: string) => {
    setSyncingPageId(pageId);
    try {
      const res = await apiClient.syncChannel(pageId);
      notify.success(
        `Đã kéo thành công ${res.syncedCount} tin nhắn từ ${res.conversationsCount} cuộc hội thoại trên ${res.pageName}!`,
        'Đồng bộ tin nhắn Facebook',
      );
    } catch (err) {
      notify.error(`Không thể đồng bộ tin nhắn: ${(err as Error).message}`);
    } finally {
      setSyncingPageId(null);
    }
  };

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
      gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)',
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
    <div className="flex flex-col gap-6">
      {/* Modal Kết nối Kênh Chuẩn hóa (OAuth + Nhập trực tiếp Page Token) */}
      {activeOAuthChannel && (
        <OAuthSimulationModal
          channel={activeOAuthChannel}
          isOpen={!!activeOAuthChannel}
          onClose={() => setActiveOAuthChannel(null)}
          onSuccess={(ch, discoveredPages) => onConnectChannel(ch, discoveredPages)}
        />
      )}

      {/* Header đề mục Bước 2 chuẩn Flat Design */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-slate-200">
        <div className="w-10 h-10 border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-blue-600 rounded-none">
          <Share2 size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 m-0">{t('onboarding.step2.title')}</h2>
          <p className="text-xs text-slate-500 mt-1 m-0">
            {t('onboarding.step2.desc')}
          </p>
        </div>
      </div>

      {/* Lưới các Card Kênh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {channelsConfig.map((ch) => {
          const isConnected = connectedChannels.includes(ch.key);
          const channelPages = pages.filter((p) => p.channel === ch.key);
          const activeCount = channelPages.filter((p) => p.selected).length;

          return (
            <div
              key={ch.key}
              className={`p-4 border transition-colors flex flex-col justify-between ${
                isConnected
                  ? 'border-blue-600 bg-blue-50/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                    style={{ background: ch.gradient }}
                  >
                    {ch.iconText}
                  </div>
                  {ch.badge && !isConnected && (
                    <span className="px-2 py-0.5 text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {ch.badge}
                    </span>
                  )}
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} />
                      <span>{t('common.connected')} ({activeCount})</span>
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-bold text-slate-900 m-0 mb-1">
                  {ch.title}
                </h3>
                <p className="text-[11.5px] text-slate-500 m-0 leading-relaxed line-clamp-2">
                  {ch.description}
                </p>
              </div>

              <div className="pt-3.5 mt-3 border-t border-slate-100">
                {ch.key === 'ZALO' && isConnected ? (
                  <button
                    type="button"
                    disabled
                    title="Tài khoản Zalo đã được kết nối và đang hoạt động. Mỗi Workspace chỉ liên kết 1 tài khoản Zalo. Để đổi tài khoản khác, vui lòng bấm nút Xóa ở danh sách bên dưới."
                    className="w-full py-2 px-3 text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Đã kết nối Zalo</span>
                  </button>
                ) : isConnected ? (
                  <button
                    type="button"
                    onClick={() => setActiveOAuthChannel(ch.key)}
                    className="w-full py-2 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-none"
                  >
                    <Plus size={14} />
                    <span>{t('onboarding.step2.addAnotherPage')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveOAuthChannel(ch.key)}
                    className="w-full py-2 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-none"
                  >
                    <ExternalLink size={14} />
                    <span>{t('common.connectNow')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checklist Danh Sách Fanpage / Kênh Đã Kết Nối */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-bold text-slate-900 m-0 uppercase tracking-wider">
              {t('onboarding.step2.fanpagesFound')} ({pages.length})
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5 m-0">
              {t('onboarding.step2.fanpagesHint')}
            </p>
          </div>
          <span className="text-xs text-slate-600">
            {t('onboarding.step2.activatedPages')}: <strong className="text-slate-900 font-bold">{selectedPagesCount}</strong>
          </span>
        </div>

        {pages.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-300 bg-slate-50/50 text-center">
            <AlertCircle size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 m-0 max-w-lg mx-auto leading-relaxed">
              Chưa có tài khoản mạng xã hội nào được liên kết. Vui lòng bấm <strong>&ldquo;{t('common.connectNow')}&rdquo;</strong> ở các kênh phía trên để kết nối Fanpage hoặc Zalo OA thực tế của bạn.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 divide-y divide-slate-100 bg-white">
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => onTogglePage(page.id)}
                className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  page.selected ? 'bg-blue-50/30' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {page.avatarUrl ? (
                    <img
                      src={page.avatarUrl}
                      alt={page.name}
                      className="w-9 h-9 object-cover border border-slate-200 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-xs shrink-0 border border-blue-200">
                      {page.channel === 'FACEBOOK' ? 'FB' : page.channel === 'ZALO' ? 'OA' : page.channel.slice(0, 2)}
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {page.name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 border border-slate-200 bg-slate-100 text-slate-600">
                        {page.channel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{page.category || `Kênh ${page.channel}`}</span>
                      {page.followerCount ? (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Users size={11} />
                            {page.followerCount.toLocaleString()} {t('onboarding.step2.followers')}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Nút Đồng bộ tin nhắn từ Facebook */}
                  {page.channel === 'FACEBOOK' && (
                    <button
                      type="button"
                      disabled={syncingPageId === page.id}
                      onClick={() => handleSyncMessages(page.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer transition-colors shadow-none"
                      title="Kéo các tin nhắn và cuộc trò chuyện hiện có từ Fanpage về CRM"
                    >
                      <RefreshCw size={12} className={syncingPageId === page.id ? 'animate-spin' : ''} />
                      <span>{syncingPageId === page.id ? 'Đang kéo...' : 'Kéo tin nhắn'}</span>
                    </button>
                  )}

                  {/* Switch Toggle Bật/Tắt đồng bộ tin nhắn */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={page.selected}
                    onClick={() => onTogglePage(page.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      page.selected ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                    title={page.selected ? 'Đang bật nhận tin nhắn' : 'Đang tạm dừng nhận tin nhắn'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform bg-white shadow-sm transition duration-200 ease-in-out ${
                        page.selected ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Nút Ngắt kết nối kênh khỏi hệ thống */}
                  {onDisconnectPage && (
                    <button
                      type="button"
                      onClick={() => onDisconnectPage(page.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors shadow-none"
                      title="Ngắt kết nối trang này khỏi Workspace"
                    >
                      <Trash2 size={12} />
                      <span>Ngắt</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="pt-6 border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer shadow-none"
        >
          <ArrowLeft size={15} />
          <span>{t('onboarding.step2.backBtn')}</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer transition-colors"
            title="Bỏ qua bước kết nối và thiết lập sau"
          >
            <span>Bỏ qua (Skip)</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs border-0 transition-colors cursor-pointer shadow-none"
          >
            <span>{t('onboarding.step2.continueBtn')}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Alias tương thích ngược
export const Step2ChannelConnect = ChannelConnectStep;
export type Step2ChannelConnectProps = ChannelConnectStepProps;
