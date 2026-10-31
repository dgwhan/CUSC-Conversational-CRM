import React, { useState } from 'react';
import {
  Share2,
  Plus,
  RefreshCw,
  Trash2,
  Power,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import type { ChannelKey } from '../../../types.js';
import {
  PageToolbar,
  SearchInput,
  Select,
  Button,
  StatusBadge,
  EmptyState,
  LoadingState,
  PageSection,
} from '../../../../../components/ui/index.js';
import {
  type ConnectionStatus,
  CHANNEL_PLATFORMS_CONFIG,
  getChannelStatus,
} from '../workspace.config.js';
import { PlatformPickerModal, ChannelDetailModal } from './modals/index.js';

export interface ConnectedChannelItem {
  id: string;
  workspaceId: string;
  channel: ChannelKey;
  externalAccountId: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  isWebhookSubscribed?: boolean;
  hasToken?: boolean;
  status?: ConnectionStatus;
  lastSyncAt?: string;
  webhookStatus?: 'Healthy' | 'Degraded' | 'Down';
  metadata?: {
    category?: string;
    followerCount?: number;
    isPersonal?: boolean;
    phone?: string;
    autoAssign?: boolean;
  };
  createdAt?: string;
}

export interface WorkspaceChannelsTabProps {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  channels: ConnectedChannelItem[];
  isLoading: boolean;
  syncingChannelId: string | null;
  togglingChannelId: string | null;
  onSyncChannel: (channelId: string) => Promise<void>;
  onToggleChannel: (channelId: string, currentActive: boolean) => Promise<void>;
  onDisconnectChannel: (channelId: string, displayName: string) => Promise<void>;
  onOpenConnectModal: (channelKey: ChannelKey) => void;
}

export const WorkspaceChannelsTab: React.FC<WorkspaceChannelsTabProps> = ({
  channels,
  isLoading,
  syncingChannelId,
  togglingChannelId,
  onSyncChannel,
  onToggleChannel,
  onDisconnectChannel,
  onOpenConnectModal,
}) => {
  const [isPlatformPickerOpen, setIsPlatformPickerOpen] = useState(false);
  const [selectedChannelDetail, setSelectedChannelDetail] = useState<ConnectedChannelItem | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');

  const filteredChannels = channels.filter((ch) => {
    if (platformFilter !== 'ALL' && ch.channel !== platformFilter) {
      return false;
    }
    const q = channelSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      ch.displayName.toLowerCase().includes(q) ||
      ch.externalAccountId.toLowerCase().includes(q) ||
      ch.channel.toLowerCase().includes(q)
    );
  });

  const platformFilterOptions = [
    { value: 'ALL', label: 'Tất cả nền tảng' },
    { value: 'FACEBOOK', label: 'Facebook Messenger' },
    { value: 'ZALO', label: 'Zalo OA' },
    { value: 'TIKTOK', label: 'TikTok' },
  ];

  return (
    <div className="pt-6">
      {/* 1. Header & Toolbar tìm kiếm kênh */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900 m-0">
          Kênh kết nối
        </h2>
        <p className="text-xs text-slate-500 mt-1 m-0">
          Kết nối và quản lý các kênh giao tiếp đa nền tảng của bạn.
        </p>
      </div>

      <PageToolbar
        search={
          <SearchInput
            value={channelSearch}
            onChange={setChannelSearch}
            placeholder="Tìm kiếm kênh kết nối theo tên hoặc ID... (Nhấn /)"
            shortcutHint="/"
            size="md"
          />
        }
        filters={
          <Select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            options={platformFilterOptions}
            size="md"
          />
        }
        actions={
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={14} />}
            onClick={() => setIsPlatformPickerOpen(true)}
          >
            Thêm kênh
          </Button>
        }
      />

      {/* 2. Danh sách kênh kết nối */}
      <div className="mb-6">
        {isLoading && (
          <LoadingState message="Đang tải danh sách kênh kết nối..." />
        )}

        {!isLoading && filteredChannels.length === 0 && (
          <EmptyState
            icon={<Share2 size={30} className="text-slate-400 mx-auto" />}
            title={channelSearch || platformFilter !== 'ALL' ? 'Không tìm thấy kênh phù hợp' : 'Chưa có kênh nào được kết nối vào không gian này'}
            description={
              channelSearch || platformFilter !== 'ALL'
                ? 'Không có kết quả nào khớp với bộ lọc hiện tại. Vui lòng thử từ khóa hoặc chọn nền tảng khác.'
                : 'Nhấn "Thêm kênh" để kết nối Facebook Pages, Zalo OA hoặc TikTok và bắt đầu tiếp nhận tin nhắn khách hàng.'
            }
            action={
              !channelSearch && platformFilter === 'ALL' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setIsPlatformPickerOpen(true)}
                >
                  Thêm kênh đầu tiên
                </Button>
              ) : undefined
            }
          />
        )}

        {!isLoading && filteredChannels.length > 0 && (
          <div className="border border-slate-200 rounded-none bg-white">
            {/* Header thanh lịch cho danh sách kênh */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>Kênh đã kết nối</span>
                <span className="px-1.5 py-0.5 text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                  {filteredChannels.length}
                </span>
              </div>
              <span className="normal-case text-slate-400 font-normal text-[11px]">
                {filteredChannels.length === 1 ? '1 kênh đang tích hợp' : `${filteredChannels.length} kênh đang tích hợp`}
              </span>
            </div>

            {/* Hàng từng kênh kết nối */}
            <div className="divide-y divide-slate-200">
              {filteredChannels.map((ch) => {
                const status = getChannelStatus(ch, syncingChannelId === ch.id);

                const platformLabel =
                  ch.channel === 'FACEBOOK'
                    ? 'Facebook Messenger'
                    : ch.channel === 'ZALO'
                      ? ch.metadata?.isPersonal
                        ? 'Zalo Cá nhân'
                        : 'Zalo Official Account'
                      : ch.channel === 'TIKTOK'
                        ? 'TikTok'
                        : ch.channel;

                return (
                  <div
                    key={ch.id}
                    className="p-4 flex items-center justify-between flex-wrap gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Left: Tên nền tảng, Tên trang & StatusBadge */}
                    <div className="flex items-center gap-3.5 min-w-[260px]">
                      {/* Platform Icon Badge */}
                      <div className="w-10 h-10 border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                        {ch.channel === 'FACEBOOK' && (
                          <span className="font-bold text-xs text-blue-600 tracking-wider">FB</span>
                        )}
                        {ch.channel === 'ZALO' && (
                          <span className="font-bold text-xs text-sky-600 tracking-wider">ZL</span>
                        )}
                        {ch.channel === 'TIKTOK' && (
                          <span className="font-bold text-xs text-slate-900 tracking-wider">TT</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">
                            {ch.displayName}
                          </span>
                          <StatusBadge status={status} />
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-600">{platformLabel}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-400">ID: {ch.externalAccountId}</span>
                          {ch.lastSyncAt && (
                            <>
                              <span>•</span>
                              <span>Đồng bộ: {new Date(ch.lastSyncAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Nút thao tác Đồng bộ, Kết nối lại, Quản lý, Tắt, Xóa */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={syncingChannelId === ch.id}
                        icon={syncingChannelId !== ch.id ? <RefreshCw size={13} /> : undefined}
                        onClick={() => onSyncChannel(ch.id)}
                        title="Đồng bộ tin nhắn mới nhất"
                      >
                        Đồng bộ
                      </Button>

                      {(status === 'Expired' || status === 'Error') && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<RotateCcw size={13} />}
                          onClick={() => onOpenConnectModal(ch.channel)}
                          title="Cấp lại quyền truy cập"
                        >
                          Kết nối lại
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Sliders size={13} />}
                        onClick={() => setSelectedChannelDetail(ch)}
                      >
                        Quản lý
                      </Button>

                      <button
                        type="button"
                        onClick={() => onToggleChannel(ch.id, ch.isActive)}
                        disabled={togglingChannelId === ch.id}
                        className="inline-flex items-center justify-center w-[30px] h-[30px] text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-none cursor-pointer transition-colors"
                        title={ch.isActive ? 'Tạm dừng nhận tin nhắn' : 'Kích hoạt lại kênh'}
                      >
                        <Power size={13} className={ch.isActive ? 'text-slate-400' : 'text-emerald-600'} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDisconnectChannel(ch.id, ch.displayName)}
                        className="inline-flex items-center justify-center w-[30px] h-[30px] text-xs font-medium bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-none cursor-pointer transition-colors"
                        title="Ngắt kết nối trang này khỏi không gian làm việc"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Nền tảng khả dụng (Sử dụng PageSection chuẩn hệ thống) */}
      <PageSection
        title="Nền tảng khả dụng"
        subtitle="Khám phá các tích hợp bổ sung để mở rộng kênh tiếp cận khách hàng."
        className="pt-6 border-t border-slate-200"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CHANNEL_PLATFORMS_CONFIG.map((platform) => (
            <div
              key={platform.key}
              className="border border-slate-200 rounded-none bg-white p-4 flex flex-col justify-between gap-3 hover:border-blue-500 transition-colors"
            >
              <div>
                <div className="text-sm font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>{platform.name}</span>
                  <span className={`badge ${platform.badgeClass}`}>
                    {platform.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0 leading-relaxed">
                  {platform.description}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                icon={<Plus size={13} />}
                onClick={() => onOpenConnectModal(platform.key)}
              >
                {platform.actionLabel}
              </Button>
            </div>
          ))}
        </div>
      </PageSection>

      {/* 4. Modal Chọn nền tảng */}
      <PlatformPickerModal
        isOpen={isPlatformPickerOpen}
        onClose={() => setIsPlatformPickerOpen(false)}
        onSelectPlatform={onOpenConnectModal}
      />

      {/* 5. Modal Chi tiết kết nối */}
      <ChannelDetailModal
        channel={selectedChannelDetail}
        onClose={() => setSelectedChannelDetail(null)}
        onOpenConnectModal={onOpenConnectModal}
        onSyncChannel={onSyncChannel}
        onDisconnectChannel={onDisconnectChannel}
        isSyncing={selectedChannelDetail ? syncingChannelId === selectedChannelDetail.id : false}
      />
    </div>
  );
};
