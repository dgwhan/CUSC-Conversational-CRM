import React from 'react';
import { RotateCcw, RefreshCw, Trash2 } from 'lucide-react';
import { Modal, StatusBadge } from '../../../../../../components/ui/index.js';
import type { ChannelKey } from '../../../../types.js';
import {
  getChannelStatus,
  getTransparentWebhookStatus,
} from '../../workspace.config.js';
import type { ConnectedChannelItem } from '../WorkspaceChannelsTab.js';

export interface ChannelDetailModalProps {
  channel: ConnectedChannelItem | null;
  onClose: () => void;
  onOpenConnectModal: (channelKey: ChannelKey) => void;
  onSyncChannel: (channelId: string) => void;
  onDisconnectChannel: (channelId: string, displayName: string) => void;
  isSyncing?: boolean;
}

export const ChannelDetailModal: React.FC<ChannelDetailModalProps> = ({
  channel,
  onClose,
  onOpenConnectModal,
  onSyncChannel,
  onDisconnectChannel,
  isSyncing = false,
}) => {
  if (!channel) return null;

  const status = getChannelStatus(channel, isSyncing);
  const webhookMeta = getTransparentWebhookStatus(channel);

  const platformName =
    channel.channel === 'FACEBOOK'
      ? 'Facebook Messenger'
      : channel.channel === 'ZALO'
        ? 'Zalo Official Account'
        : 'TikTok';

  const modalTitle = (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-slate-500">
        {platformName}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-slate-900">
          {channel.displayName}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={Boolean(channel)}
      onClose={onClose}
      variant="flat"
      size="md"
      showCloseButton
      title={modalTitle}
    >
      <div className="flex flex-col gap-4">
        {/* Thông tin kết nối */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 m-0">
            Thông tin kết nối
          </h4>
          <div className="border border-slate-200 rounded-none divide-y divide-slate-100 text-xs">
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Tên trang / Tài khoản</span>
              <span className="font-semibold text-slate-900">{channel.displayName}</span>
            </div>
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Trạng thái kết nối</span>
              <span className="font-semibold text-slate-900">
                {channel.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
              </span>
            </div>
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Lần đồng bộ gần nhất</span>
              <span className="font-mono text-slate-700">
                {channel.lastSyncAt
                  ? new Date(channel.lastSyncAt).toLocaleString('vi-VN')
                  : 'Chưa đồng bộ'}
              </span>
            </div>
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Định danh tài khoản</span>
              <span className="font-mono text-slate-700">{channel.externalAccountId}</span>
            </div>
          </div>
        </div>

        {/* Tính năng & Thiết lập */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 m-0">
            Tính năng & Thiết lập
          </h4>
          <div className="border border-slate-200 rounded-none divide-y divide-slate-100 text-xs">
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Đồng bộ tin nhắn</span>
              <span className="font-semibold text-emerald-600">
                {channel.isActive ? 'Đang bật' : 'Đang tắt'}
              </span>
            </div>
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Trạng thái Webhook</span>
              <span className={webhookMeta.className}>
                {webhookMeta.label}
              </span>
            </div>
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500">Tự động phân bổ tư vấn viên</span>
              <span className="font-semibold text-slate-400">Đang tắt</span>
            </div>
          </div>
        </div>

        {/* Dãy nút hành động Footer */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-200 mt-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onOpenConnectModal(channel.channel);
                onClose();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-blue-600 hover:text-blue-600 text-slate-700 rounded-none cursor-pointer transition-colors shadow-none flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Kết nối lại</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSyncChannel(channel.id);
                onClose();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-none border-none cursor-pointer transition-colors shadow-none flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Đồng bộ ngay</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const id = channel.id;
              const name = channel.displayName;
              onClose();
              onDisconnectChannel(id, name);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-none cursor-pointer transition-colors shadow-none flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Ngắt kết nối</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
